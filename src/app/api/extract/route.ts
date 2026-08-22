import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { GoogleGenAI } from '@google/genai'
import { validateReceiptDate } from '@/lib/extraction/validateDate'

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
  visible_date_raw: string | null
  invoice_reference_raw: string | null
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
        return NextResponse.json({ error: 'Missing image_base64 in JSON body' }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: 'Unsupported Content-Type. Use multipart/form-data or application/json' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // If userId not provided in body, check active session from cookies
    if (!userId) {
      const { createServerClient } = await import('@/lib/supabase/server')
      const sessionClient = await createServerClient()
      const { data: { user } } = await sessionClient.auth.getUser()
      if (user) {
        userId = user.id
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: User not authenticated or user_id not provided' }, { status: 401 })
    }

    // 2 & 3. Fetch relief rules for assessment_year (default 2026/2025)
    const targetYear = 2026
    let { data: rules } = await supabase
      .from('relief_rules')
      .select('id, category_key, category_label, limit_amount, description, rule_version, status')
      .eq('assessment_year', targetYear)
      .eq('status', 'active')

    let rulesStatusUsed = 'active'

    if (!rules || rules.length === 0) {
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
Analyze the provided image and extract raw structured text and details from the receipt.

### Legibility Check:
- Set "is_legible": true if text, merchant name, amounts, and numbers are reasonably discernible.
- Set "is_legible": false if the image is too blurry, dark, corrupt, blank, or completely unreadable.

### Tax Relief Rules Context for Assessment Year ${targetYear}:
The valid Malaysian tax relief category keys are:
${rulesContext}
- "none": Use this if the expense does not qualify for any tax relief.

### Extraction Instructions:
- Report "visible_date_raw": the exact date text printed on the receipt verbatim, unparsed (e.g. "22/08/26", "22-AUG-2026", "22/08/2026", "2026-08-22").
- Report "invoice_reference_raw": the invoice number, receipt ID, or transaction number as printed verbatim (e.g. "INV260822-091", "RCPT-1029", "POS-20260822-999") or null if none is printed.
- Do NOT internally attempt to reconcile or alter the raw values. Report exactly what is visible on the image.

### Output JSON Schema:
Return ONLY a valid JSON object matching this schema precisely without markdown code fences:
{
  "is_legible": true or false,
  "merchant": "string (name of merchant/store) or null if unreadable",
  "visible_date_raw": "string or null if unreadable",
  "invoice_reference_raw": "string or null if unreadable",
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
  "extraction_notes": "string (optional — note any smudged text, unreadable fields, or assumptions)"
}

Guidelines:
- If is_legible is false, you can set merchant, visible_date_raw, invoice_reference_raw, total_amount to null, line_items to [], and state why in extraction_notes.
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
    const isAllCoreFieldsMissing = !extracted.merchant && !extracted.total_amount && !extracted.visible_date_raw && !extracted.transaction_date

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

    // -------------------------------------------------------------
    // 5. Programmatic Validation & Heuristics
    // -------------------------------------------------------------
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

    // Check 4: Deterministic Date Validation & Cross-Check (src/lib/extraction/validateDate.ts)
    const dateValidation = validateReceiptDate(
      extracted.visible_date_raw,
      extracted.invoice_reference_raw,
      extracted.transaction_date
    )

    const finalResolvedDate = dateValidation.resolved_date
    if (dateValidation.needs_review && dateValidation.review_reason) {
      needsReview = true
      reviewReasons.push(dateValidation.review_reason)
    }

    // Check 5: Ambiguity flagged in notes
    if (extracted.extraction_notes && /(ambiguous|unclear|unsure|smudged|guess|estimate|unreadable)/i.test(extracted.extraction_notes)) {
      needsReview = true
      reviewReasons.push(`Model indicated ambiguity in notes: "${extracted.extraction_notes}"`)
    }

    // -------------------------------------------------------------
    // Embed raw extraction signals in notes for full auditability
    // -------------------------------------------------------------
    const rawSignalsNotes = `[Raw Signals] Visible Date: "${extracted.visible_date_raw || 'N/A'}", Invoice Ref: "${extracted.invoice_reference_raw || 'N/A'}".`
    const combinedNotes = extracted.extraction_notes
      ? `${extracted.extraction_notes} | ${rawSignalsNotes}`
      : rawSignalsNotes

    // -------------------------------------------------------------
    // Determine rule_version_id
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

    // -------------------------------------------------------------
    // Duplicate Detection Check (Soft Warning)
    // -------------------------------------------------------------
    let isPossibleDuplicate = false
    let duplicateOfId: string | null = null

    if (userId && extracted.total_amount && finalResolvedDate) {
      const { data: existingMatches } = await supabase
        .from('receipts')
        .select('id, merchant, total_amount, transaction_date')
        .eq('user_id', userId)
        .eq('transaction_date', finalResolvedDate)
        .eq('total_amount', Number(extracted.total_amount))

      if (existingMatches && existingMatches.length > 0) {
        const cleanMerchant = (extracted.merchant || '').toLowerCase().replace(/[^a-z0-9]/g, '')
        const match = existingMatches.find((m) => {
          const mClean = (m.merchant || '').toLowerCase().replace(/[^a-z0-9]/g, '')
          return mClean === cleanMerchant || cleanMerchant.includes(mClean) || mClean.includes(cleanMerchant)
        })

        if (match) {
          isPossibleDuplicate = true
          duplicateOfId = match.id
          needsReview = true
          reviewReasons.push(`Possible duplicate of existing receipt (${match.merchant} on ${match.transaction_date})`)
        }
      }
    }

    // -------------------------------------------------------------
    // Upload image to Supabase Storage bucket (receipts-images)
    // -------------------------------------------------------------
    let storedImagePath: string | null = null
    if (imageBase64 && userId) {
      try {
        const fileExt = mimeType.includes('png') ? 'png' : 'jpg'
        const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`
        const buffer = Buffer.from(imageBase64, 'base64')

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('receipts-images')
          .upload(fileName, buffer, {
            contentType: mimeType,
            upsert: true,
          })

        if (uploadError) {
          console.error('[extract] Storage upload error:', JSON.stringify(uploadError))
        } else if (uploadData) {
          storedImagePath = uploadData.path
          console.log('[extract] Successfully uploaded receipt image to:', storedImagePath)
        }
      } catch (storageErr) {
        console.error('[extract] Error uploading image to storage:', storageErr)
      }
    }

    // Determine status: if flagged with reviewReasons (including duplicate/date discrepancy), pending_review
    const status = needsReview ? 'pending_review' : 'confirmed'

    // 6. Insert into Supabase receipts & receipt_line_items via insert_receipt_admin RPC
    let insertedReceipt = null
    if (userId) {
      const lineItemsPayload = (extracted.line_items || []).map((item) => ({
        description: item.description,
        amount: item.amount ? Number(item.amount) : 0,
        spending_category: item.spending_category || extracted.spending_category || 'other',
        relief_category: item.relief_category || 'none',
        is_claimable: Boolean(item.is_claimable),
      }))

      // Compute assessment year from the resolved date if available
      const resolvedAssessmentYear = finalResolvedDate
        ? new Date(finalResolvedDate).getFullYear()
        : targetYear

      const { data: receiptRow, error: receiptError } = await supabase
        .rpc('insert_receipt_admin', {
          p_user_id: userId,
          p_image_url: storedImagePath,
          p_merchant: extracted.merchant || 'Unknown Merchant',
          p_total_amount: extracted.total_amount ? Number(extracted.total_amount) : null,
          p_transaction_date: finalResolvedDate,
          p_assessment_year: resolvedAssessmentYear,
          p_spending_category: extracted.spending_category || 'other',
          p_relief_category: extracted.relief_category || 'none',
          p_needs_review: needsReview,
          p_status: status,
          p_rule_version_id: ruleVersionId,
          p_possible_duplicate: isPossibleDuplicate,
          p_duplicate_of_id: duplicateOfId,
          p_line_items: lineItemsPayload,
        })

      if (receiptError) {
        console.error('Error inserting receipt to Supabase via RPC:', JSON.stringify(receiptError))
      } else {
        insertedReceipt = receiptRow
      }
    }

    // 7. Return response
    return NextResponse.json({
      success: true,
      raw_llm_response: {
        ...extracted,
        transaction_date: finalResolvedDate,
        extraction_notes: combinedNotes,
      },
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
        error: error.message || 'Unknown server error during extraction',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
