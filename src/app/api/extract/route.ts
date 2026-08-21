import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { GoogleGenAI } from '@google/genai'

interface LineItem {
  description: string
  amount: number
  spending_category: string
  relief_category: string
  is_claimable: boolean
}

interface ExtractionResponse {
  is_legible: boolean
  merchant: string | null
  transaction_date: string | null
  total_amount: number | null
  assessment_year: number
  spending_category: string
  relief_category: string
  line_items: LineItem[]
  extraction_notes?: string
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing GEMINI_API_KEY in environment variables' },
        { status: 500 }
      )
    }

    // 1. Accept multipart form or JSON (base64)
    let imageBase64: string = ''
    let mimeType: string = 'image/jpeg'
    let userId: string | null = null

    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      userId = (formData.get('user_id') as string) || null

      if (!file) {
        return NextResponse.json({ error: 'No file provided in form-data' }, { status: 400 })
      }
      mimeType = file.type || 'image/jpeg'
      const arrayBuffer = await file.arrayBuffer()
      imageBase64 = Buffer.from(arrayBuffer).toString('base64')
    } else if (contentType.includes('application/json')) {
      const body = await req.json()
      imageBase64 = body.image_base64 || ''
      mimeType = body.mime_type || 'image/jpeg'
      userId = body.user_id || null

      if (!imageBase64) {
        return NextResponse.json({ error: 'No image_base64 provided in JSON body' }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: 'Unsupported Content-Type. Use multipart/form-data or application/json' }, { status: 400 })
    }

    const supabase = createServerClient()

    // If userId not provided, get the first existing user id
    if (!userId) {
      const { data: usersList, error: uErr } = await supabase.from('users').select('id').limit(1)
      if (uErr) console.error('Error fetching default user:', uErr)
      if (usersList && usersList.length > 0) {
        userId = usersList[0].id
      } else {
        userId = '8fd180b8-e569-4f19-ae6d-fca7305fd3a1'
      }
    }

    // 2 & 3. Fetch relief rules for assessment_year (default 2025)
    const targetYear = 2025
    // Attempt active rules first, fallback to draft
    let { data: rules } = await supabase
      .from('relief_rules')
      .select('id, category_key, category_label, limit_amount, description, rule_version, status')
      .eq('assessment_year', targetYear)
      .eq('status', 'active')

    let rulesStatusUsed = 'active'

    if (!rules || rules.length === 0) {
      console.warn(`[extract] WARNING: No ACTIVE relief rules found for assessment_year ${targetYear}. Falling back to DRAFT rules. (Phase 9 approval flow pending)`)
      const { data: draftRules } = await supabase
        .from('relief_rules')
        .select('id, category_key, category_label, limit_amount, description, rule_version, status')
        .eq('assessment_year', targetYear)
        .eq('status', 'draft')

      rules = draftRules || []
      rulesStatusUsed = 'draft'
    }

    // Format rules for prompt injection
    const rulesContext = rules.map((r) => `- "${r.category_key}": ${r.category_label} (Limit: RM${r.limit_amount ?? 'N/A'})`).join('\n')

    // 4. Initialize Gemini client and call
    const ai = new GoogleGenAI({ apiKey })

    const prompt = `You are an expert Malaysian receipt data extraction system following the ResitKu schema specification.
Analyze the provided image and extract structured receipt data.

### Legibility Check:
First determine if the image is a legible receipt.
- Set "is_legible": true if text, merchant name, amounts, and dates are reasonably discernible.
- Set "is_legible": false if the image is too blurry, dark, corrupt, blank, or completely unreadable.

### Tax Relief Rules Context for Assessment Year ${targetYear}:
The valid Malaysian tax relief category keys are:
${rulesContext}
- "none": Use this if the expense does not qualify for any tax relief.

### Output JSON Schema:
Return ONLY a valid JSON object matching this schema precisely without markdown code fences:
{
  "is_legible": true or false,
  "merchant": "string (name of merchant/store) or null if unreadable",
  "transaction_date": "YYYY-MM-DD or null if unreadable",
  "total_amount": 0.00 (numeric total paid, or null if unreadable),
  "assessment_year": ${targetYear},
  "spending_category": "groceries | dining | transport | utilities | medical | shopping | education | entertainment | other",
  "relief_category": "string (must be one of the category_key values above or 'none')",
  "line_items": [
    {
      "description": "string",
      "amount": 0.00,
      "spending_category": "string",
      "relief_category": "string (valid category_key or 'none')",
      "is_claimable": true or false
    }
  ],
  "extraction_notes": "string (optional — note any ambiguity, smudged text, or assumptions made)"
}

Guidelines:
- If is_legible is false, you can set merchant, transaction_date, total_amount to null, line_items to [], and state why in extraction_notes.
- If the receipt has mixed items (e.g. pharmacy with both medication and cosmetics), split them into separate line_items.
- spending_category and relief_category are independent.
- Do NOT output any confidence score field.`

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: imageBase64,
                mimeType: mimeType,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    })

    const rawText = response.text || '{}'
    let extracted: ExtractionResponse
    try {
      extracted = JSON.parse(rawText)
    } catch (e) {
      console.error('[extract] Failed to parse JSON from LLM:', rawText)
      return NextResponse.json(
        {
          error: 'Failed to parse JSON response from LLM',
          raw_response: rawText,
        },
        { status: 502 }
      )
    }

    // -------------------------------------------------------------
    // REJECTION PATH: Handle unreadable/blurry receipts
    // -------------------------------------------------------------
    const isExplicitlyIllegible = extracted.is_legible === false
    const isAllCoreFieldsMissing = !extracted.merchant && !extracted.total_amount && !extracted.transaction_date

    if (isExplicitlyIllegible || isAllCoreFieldsMissing) {
      const rejectReason = extracted.extraction_notes || 'Image is blurry, unreadable, or missing core transaction details'
      console.warn(`[extract] REJECTED receipt upload: ${rejectReason}`)

      return NextResponse.json({
        status: 'rejected',
        reason: 'image_unreadable',
        details: rejectReason,
        raw_llm_response: extracted,
      })
    }

    // 5. Compute needs_review heuristic in code (per receipt-extraction-schema skill)
    const validCategoryKeys = new Set(rules.map((r) => r.category_key).concat(['none']))
    let needsReview = false
    const reviewReasons: string[] = []

    // Check 1: total_amount missing, zero, or not a number
    if (extracted.total_amount === null || extracted.total_amount === undefined || isNaN(Number(extracted.total_amount)) || Number(extracted.total_amount) <= 0) {
      needsReview = true
      reviewReasons.push('Total amount is missing, zero, or unparseable')
    }

    // Check 2: line items sum check (if line items exist)
    if (extracted.line_items && extracted.line_items.length > 0 && extracted.total_amount) {
      const itemsSum = extracted.line_items.reduce((acc, item) => acc + (Number(item.amount) || 0), 0)
      const diff = Math.abs(itemsSum - Number(extracted.total_amount))
      if (diff > 0.05 && itemsSum > 0) {
        needsReview = true
        reviewReasons.push(`Line items sum (RM${itemsSum.toFixed(2)}) differs from total (RM${extracted.total_amount}) by > RM0.05`)
      }
    }

    // Check 3: relief_category validity
    if (!validCategoryKeys.has(extracted.relief_category)) {
      needsReview = true
      reviewReasons.push(`Relief category '${extracted.relief_category}' is not in active/draft relief rules`)
    }

    // Check 4: transaction_date validity
    if (!extracted.transaction_date || !/^\d{4}-\d{2}-\d{2}$/.test(extracted.transaction_date)) {
      needsReview = true
      reviewReasons.push('Transaction date is missing or not in YYYY-MM-DD format')
    }

    // Check 5: Ambiguity flagged in notes
    if (extracted.extraction_notes && /(ambiguous|unclear|unsure|smudged|guess|estimate|unreadable)/i.test(extracted.extraction_notes)) {
      needsReview = true
      reviewReasons.push(`Model indicated ambiguity in notes: "${extracted.extraction_notes}"`)
    }

    // -------------------------------------------------------------
    // Determine rule_version_id
    // If the receipt matched a specific relief rule (including the 'none' placeholder),
    // link that rule's UUID.
    // -------------------------------------------------------------
    let ruleVersionId: string | null = null
    const matchedRule = rules.find((r) => r.category_key === extracted.relief_category)
    if (matchedRule) {
      ruleVersionId = matchedRule.id
    } else if (rules.length > 0) {
      const noneRule = rules.find((r) => r.category_key === 'none')
      const fallbackRule = noneRule || rules[0]
      ruleVersionId = fallbackRule ? fallbackRule.id : null
    }

    console.log(`[extract] Assigning rule_version_id: ${ruleVersionId} (matched category_key: ${matchedRule?.category_key || 'fallback to none/first'})`)

    const status = needsReview ? 'pending_review' : 'confirmed'

    // 6. Insert into Supabase receipts & receipt_line_items
    let insertedReceipt = null
    if (userId) {
      const insertPayload = {
        user_id: userId,
        merchant: extracted.merchant || 'Unknown Merchant',
        total_amount: extracted.total_amount ? Number(extracted.total_amount) : null,
        transaction_date: extracted.transaction_date || null,
        assessment_year: extracted.assessment_year || targetYear,
        spending_category: extracted.spending_category || 'other',
        relief_category: extracted.relief_category || 'none',
        needs_review: needsReview,
        status: status,
        rule_version_id: ruleVersionId,
      }

      const { data: receiptRow, error: receiptError } = await supabase
        .from('receipts')
        .insert(insertPayload)
        .select()
        .single()

      if (receiptError) {
        console.error('Error inserting receipt to Supabase:', receiptError)
      } else {
        insertedReceipt = receiptRow

        // Insert line items if present
        if (extracted.line_items && extracted.line_items.length > 0 && receiptRow) {
          const lineItemsToInsert = extracted.line_items.map((item) => ({
            receipt_id: receiptRow.id,
            description: item.description,
            amount: item.amount ? Number(item.amount) : 0,
            spending_category: item.spending_category || extracted.spending_category || 'other',
            relief_category: item.relief_category || 'none',
            is_claimable: Boolean(item.is_claimable),
          }))

          const { error: lineItemsError } = await supabase
            .from('receipt_line_items')
            .insert(lineItemsToInsert)

          if (lineItemsError) {
            console.error('Error inserting receipt_line_items:', lineItemsError)
          }
        }
      }
    }

    // 7. Return response
    return NextResponse.json({
      success: true,
      raw_llm_response: extracted,
      needs_review: needsReview,
      review_reasons: reviewReasons,
      status: status,
      rules_status_used: rulesStatusUsed,
      db_receipt: insertedReceipt,
    })
  } catch (error: any) {
    console.error('Error in /api/extract:', error)
    return NextResponse.json(
      {
        error: error.message || 'Internal server error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
