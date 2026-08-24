import {
  calculateReliefProgress,
  ReliefRule,
  Receipt,
  ReliefCalculationResult,
  CategoryReliefProgress,
} from './calculateRelief'

export interface ContributingItem {
  receipt_id: string
  merchant: string
  transaction_date: string
  description: string
  amount: number
  spending_category: string
  relief_category: string
  is_line_item: boolean
}

export interface ExportCategoryDetail {
  rule_id: string
  category_key: string
  category_label_en: string
  category_label_ms: string
  limit_amount: number | null
  claimed_raw: number
  claimed_effective: number
  enforces_combined_cap: boolean
  items: ContributingItem[]
  sub_caps: ExportCategoryDetail[]
}

export interface ExportReliefData {
  assessment_year: number
  user_email: string | null
  generated_at: string
  total_relief_claimed: number
  total_relief_available: number
  categories: ExportCategoryDetail[]
  all_contributing_items: ContributingItem[]
}

/**
 * Extracts all contributing (included) line items or receipt items that match confirmed relief claims.
 */
export function getContributingItems(
  receipts: Receipt[],
  assessmentYear: number,
  knownCategoryKeys: Set<string>
): ContributingItem[] {
  const eligibleReceipts = receipts.filter(
    (r) =>
      r.status === 'confirmed' &&
      !r.needs_review &&
      (r.assessment_year === assessmentYear || (!r.assessment_year && assessmentYear === 2025))
  )

  const items: ContributingItem[] = []

  for (const r of eligibleReceipts) {
    const lineItems = r.receipt_line_items
    if (lineItems && lineItems.length > 0) {
      // Path A: line items
      for (const li of lineItems) {
        if (li.include_in_records === false) continue
        const cat = li.relief_category
        if (!cat || cat === 'none') continue
        if (!knownCategoryKeys.has(cat)) continue

        items.push({
          receipt_id: r.id,
          merchant: r.merchant || 'Unknown Merchant',
          transaction_date: r.transaction_date || 'N/A',
          description: li.description || 'Item',
          amount: Number(li.amount || 0),
          spending_category: li.spending_category || r.spending_category || 'other',
          relief_category: cat,
          is_line_item: true,
        })
      }
    } else {
      // Path B: receipt level
      const cat = r.relief_category
      if (!cat || cat === 'none') continue
      if (!knownCategoryKeys.has(cat)) continue

      items.push({
        receipt_id: r.id,
        merchant: r.merchant || 'Unknown Merchant',
        transaction_date: r.transaction_date || 'N/A',
        description: 'Total Receipt Claim',
        amount: Number(r.claimed_amount ?? r.total_amount ?? 0),
        spending_category: r.spending_category || 'other',
        relief_category: cat,
        is_line_item: false,
      })
    }
  }

  return items
}

/**
 * Builds the canonical ExportReliefData by reusing calculateReliefProgress directly.
 */
export function buildExportReliefData(
  rules: ReliefRule[],
  receipts: Receipt[],
  assessmentYear: number,
  userEmail: string | null = null
): ExportReliefData {
  // 1. Calculate the exact official totals using the canonical engine
  const calculation: ReliefCalculationResult = calculateReliefProgress(rules, receipts, assessmentYear)
  const knownKeys = new Set(rules.map((r) => r.category_key))

  // 2. Collect all individual contributing item records
  const allItems = getContributingItems(receipts, assessmentYear, knownKeys)

  // Map item list into hierarchical category progress structure
  function mapCategory(cat: CategoryReliefProgress): ExportCategoryDetail {
    const catItems = allItems.filter((item) => item.relief_category === cat.category_key)
    return {
      rule_id: cat.rule_id,
      category_key: cat.category_key,
      category_label_en: cat.category_label_en,
      category_label_ms: cat.category_label_ms,
      limit_amount: cat.limit_amount,
      claimed_raw: cat.claimed_raw,
      claimed_effective: cat.claimed_effective,
      enforces_combined_cap: cat.enforces_combined_cap,
      items: catItems,
      sub_caps: cat.sub_caps.map(mapCategory),
    }
  }

  const enrichedCategories = calculation.categories.map(mapCategory)

  return {
    assessment_year: assessmentYear,
    user_email: userEmail,
    generated_at: new Date().toISOString(),
    total_relief_claimed: calculation.total_relief_claimed,
    total_relief_available: calculation.total_relief_available,
    categories: enrichedCategories,
    all_contributing_items: allItems,
  }
}

/**
 * Formats canonical ExportReliefData into a clean CSV format aligned with Form BE.
 */
export function generateReliefCSV(data: ExportReliefData): string {
  const lines: string[] = []

  // 1. Header Metadata
  lines.push(`"ResitKu - LHDN Form BE Tax Relief Supporting Record"`)
  lines.push(`"Assessment Year",${data.assessment_year}`)
  lines.push(`"Generated At","${data.generated_at}"`)
  if (data.user_email) lines.push(`"Account","${data.user_email}"`)
  lines.push(`"Notice","This export is for personal record-keeping only. It does not submit anything to LHDN."`)
  lines.push(``)

  // 2. Summary Section by Category
  lines.push(`"=== TAX RELIEF SUMMARY (FORM BE ALIGNED) ==="`)
  lines.push(`"Category Code","Category Description (EN)","Statutory Limit (RM)","Claimed (RM)","Status"`)

  for (const cat of data.categories) {
    const limitStr = cat.limit_amount !== null ? cat.limit_amount.toFixed(2) : "Unlimited"
    const status = cat.limit_amount !== null && cat.claimed_effective >= cat.limit_amount ? "MAXED OUT" : "OK"
    lines.push(
      `"${cat.category_key}","${cat.category_label_en.replace(/"/g, '""')}",${limitStr},${cat.claimed_effective.toFixed(2)},"${status}"`
    )

    // Include sub-caps indented under umbrella
    for (const sub of cat.sub_caps) {
      const subLimitStr = sub.limit_amount !== null ? sub.limit_amount.toFixed(2) : "Shared"
      lines.push(
        `"  ↳ ${sub.category_key}","  ↳ ${sub.category_label_en.replace(/"/g, '""')}",${subLimitStr},${sub.claimed_effective.toFixed(2)},"Sub-cap"`
      )
    }
  }

  lines.push(
    `"TOTAL","TOTAL TAX RELIEF CLAIMED",${data.total_relief_available.toFixed(2)},${data.total_relief_claimed.toFixed(2)},""`
  )
  lines.push(``)

  // 3. Itemized Supporting Receipts Section
  lines.push(`"=== ITEMIZED CONTRIBUTING RECEIPTS & EXPENSES ==="`)
  lines.push(
    `"Relief Category (EN)","Relief Key","Merchant","Transaction Date","Item Description","Amount Claimed (RM)","Receipt ID"`
  )

  if (data.all_contributing_items.length === 0) {
    lines.push(`"No confirmed relief-eligible expenses recorded for YA ${data.assessment_year}"`)
  } else {
    for (const item of data.all_contributing_items) {
      // Find matching label
      const catObj = data.categories.find(
        (c) => c.category_key === item.relief_category || c.sub_caps.some((s) => s.category_key === item.relief_category)
      )
      let label = item.relief_category
      if (catObj) {
        if (catObj.category_key === item.relief_category) {
          label = catObj.category_label_en
        } else {
          const sub = catObj.sub_caps.find((s) => s.category_key === item.relief_category)
          if (sub) label = sub.category_label_en
        }
      }

      lines.push(
        `"${label.replace(/"/g, '""')}","${item.relief_category}","${item.merchant.replace(/"/g, '""')}","${item.transaction_date}","${item.description.replace(/"/g, '""')}",${item.amount.toFixed(2)},"${item.receipt_id}"`
      )
    }
  }

  return lines.join('\r\n')
}
