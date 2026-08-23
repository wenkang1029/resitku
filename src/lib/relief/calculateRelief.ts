export interface ReliefRule {
  id: string
  assessment_year: number
  rule_version: number
  status: string
  category_key: string
  category_label?: string | null
  category_label_en?: string | null
  category_label_ms?: string | null
  limit_amount: number | null
  sub_cap_parent_id: string | null
  enforces_combined_cap: boolean
}

export interface ReceiptLineItem {
  id: string
  description: string
  amount: number | null
  spending_category: string | null
  /** Each line item carries its own relief category, independent of the receipt level. */
  relief_category: string | null
  is_claimable: boolean
  /** false = user excluded this item at confirm time. */
  include_in_records: boolean
}

export interface Receipt {
  id: string
  merchant?: string | null
  total_amount: number | null
  /** Set at confirm when items were excluded; null means nothing excluded — use total_amount. */
  claimed_amount: number | null
  transaction_date: string | null
  spending_category: string | null
  /**
   * Receipt-level relief category — used ONLY as fallback when no line items are present.
   * When line items exist, their individual relief_category fields are used instead (see below).
   */
  relief_category: string | null
  status: 'pending_review' | 'confirmed'
  needs_review: boolean
  assessment_year: number | null
  /** Embedded line items. Present when fetched with ?include_line_items=true. */
  receipt_line_items?: ReceiptLineItem[]
}

export interface CategoryReliefProgress {
  rule_id: string
  category_key: string
  category_label_en: string
  category_label_ms: string
  limit_amount: number | null
  claimed_raw: number
  claimed_effective: number
  enforces_combined_cap: boolean
  sub_caps: CategoryReliefProgress[]
}

export interface ReliefCalculationResult {
  assessment_year: number
  total_relief_claimed: number
  total_relief_available: number
  categories: CategoryReliefProgress[]
  /**
   * Non-empty when a line item's relief_category is not found in the active rules.
   * These amounts are NOT counted anywhere — they are surfaced here so the
   * dashboard can alert the user rather than silently dropping them.
   */
  unmapped_category_warnings: UnmappedCategoryWarning[]
}

export interface UnmappedCategoryWarning {
  receipt_id: string
  merchant: string | null
  item_description: string
  item_amount: number
  relief_category: string
}

/**
 * Calculates Malaysian tax relief progress for confirmed receipts.
 *
 * Aggregation strategy:
 * ─ If a receipt has embedded line items (receipt_line_items is non-empty):
 *     → Aggregate each INCLUDED line item (include_in_records !== false) by its OWN
 *       relief_category. This is the correct path for mixed-category receipts (e.g. a
 *       pharmacy receipt with medical + lifestyle + none items).
 * ─ If a receipt has NO line items (simple single-category receipt):
 *     → Fall back to receipt-level relief_category + COALESCE(claimed_amount, total_amount).
 *
 * Why this matters:
 *   A pharmacy receipt with receipt.relief_category = "medical" may contain line items with
 *   different categories. Using the receipt-level field as a single bucket would misattribute
 *   lifestyle items as medical claims, and would not correctly reflect which items were excluded.
 *
 * Rules:
 * 1. Exclude receipts with status !== 'confirmed' or needs_review === true.
 * 2. effectiveClaim = min(claimed, rule.limit_amount).
 * 3. If parent.enforces_combined_cap: cap aggregate of children against parent limit.
 */
export function calculateReliefProgress(
  rules: ReliefRule[],
  receipts: Receipt[],
  assessmentYear: number = 2025
): ReliefCalculationResult {
  // 1. Filter eligible confirmed receipts (universal across both paths)
  const eligibleReceipts = receipts.filter(
    (r) =>
      r.status === 'confirmed' &&
      !r.needs_review &&
      (r.assessment_year === assessmentYear || (!r.assessment_year && assessmentYear === 2025))
  )

  // 2. Build claimedByCategory — the core aggregation
  //
  // PATH A — Line-item-level (preferred):
  //   Used when the receipt has embedded line items. Each included item is attributed
  //   to its own relief_category, so mixed-category receipts are handled correctly.
  //   Items with include_in_records = false are silently skipped.
  //   Items with relief_category = "none" or null don't contribute to any relief bucket.
  //
  // PATH B — Receipt-level fallback:
  //   Used when no line items are present. Uses receipt.relief_category (must be non-none)
  //   and COALESCE(claimed_amount, total_amount) as the amount.

  // Build set of all known category_keys from the provided rules (including 'none').
  // This is the ground truth for what is a valid category.
  const knownCategoryKeys = new Set(rules.map((r) => r.category_key))
  // Unmapped warnings accumulator — amounts here are NOT counted in any bucket.
  const unmappedWarnings: UnmappedCategoryWarning[] = []

  const claimedByCategory: Record<string, number> = {}

  for (const receipt of eligibleReceipts) {
    const lineItems = receipt.receipt_line_items

    if (lineItems && lineItems.length > 0) {
      // ── PATH A: per-item attribution ──────────────────────────────────────────────
      for (const item of lineItems) {
        // Skip excluded items (toggled off by user at confirm time)
        if (item.include_in_records === false) continue

        const cat = item.relief_category
        if (!cat || cat === 'none') continue

        // ⚠️ UNMAPPED CATEGORY: not in active relief_rules.
        // Record a warning and skip — do NOT silently add to any bucket.
        if (!knownCategoryKeys.has(cat)) {
          unmappedWarnings.push({
            receipt_id: receipt.id,
            merchant: receipt.merchant ?? null,
            item_description: item.description,
            item_amount: Number(item.amount) || 0,
            relief_category: cat,
          })
          continue
        }

        const amt = Number(item.amount) || 0
        claimedByCategory[cat] = (claimedByCategory[cat] || 0) + amt
      }
    } else {
      // ── PATH B: receipt-level fallback ────────────────────────────────────────
      const cat = receipt.relief_category
      if (!cat || cat === 'none') continue

      // COALESCE: claimed_amount is set when items were excluded; otherwise use original total
      const amt = Number(receipt.claimed_amount ?? receipt.total_amount) || 0
      claimedByCategory[cat] = (claimedByCategory[cat] || 0) + amt
    }
  }

  // 3. Separate top-level root rules vs children
  const activeRules = rules.filter((r) => r.category_key !== 'none')
  const rootRules = activeRules.filter((r) => !r.sub_cap_parent_id)
  const childRulesByParentId: Record<string, ReliefRule[]> = {}

  for (const rule of activeRules) {
    if (rule.sub_cap_parent_id) {
      if (!childRulesByParentId[rule.sub_cap_parent_id]) {
        childRulesByParentId[rule.sub_cap_parent_id] = []
      }
      childRulesByParentId[rule.sub_cap_parent_id].push(rule)
    }
  }

  // 4. Helper to calculate node & recursively process its children
  function processRuleNode(rule: ReliefRule, remainingParentCap?: number): CategoryReliefProgress {
    const rawClaimed = claimedByCategory[rule.category_key] || 0
    const children = childRulesByParentId[rule.id] || []

    let effectiveClaim = rawClaimed
    if (rule.limit_amount !== null && rule.limit_amount !== undefined) {
      effectiveClaim = Math.min(effectiveClaim, Number(rule.limit_amount))
    }

    if (remainingParentCap !== undefined) {
      effectiveClaim = Math.min(effectiveClaim, Math.max(0, remainingParentCap))
    }

    // Process children
    const childProgressList: CategoryReliefProgress[] = []
    if (children.length > 0) {
      if (rule.enforces_combined_cap) {
        // Shared umbrella constraint (e.g. medical_combined_umbrella RM10,000)
        let parentBudgetRemaining = rule.limit_amount !== null ? Number(rule.limit_amount) : Infinity
        for (const child of children) {
          const childProgress = processRuleNode(child, parentBudgetRemaining)
          childProgressList.push(childProgress)
          parentBudgetRemaining = Math.max(0, parentBudgetRemaining - childProgress.claimed_effective)
        }
        const sumChildren = childProgressList.reduce((acc, c) => acc + c.claimed_effective, 0)
        effectiveClaim = Math.min(sumChildren + rawClaimed, rule.limit_amount !== null ? Number(rule.limit_amount) : sumChildren)
      } else {
        // Independent sub-caps (e.g. epf + life insurance under life_insurance_epf)
        for (const child of children) {
          const childProgress = processRuleNode(child)
          childProgressList.push(childProgress)
        }
        const sumChildren = childProgressList.reduce((acc, c) => acc + c.claimed_effective, 0)
        const totalNode = rawClaimed + sumChildren
        effectiveClaim = rule.limit_amount !== null ? Math.min(totalNode, Number(rule.limit_amount)) : totalNode
      }
    }

    const labelEn = rule.category_label_en || rule.category_label?.split('/')[1]?.trim() || rule.category_label || rule.category_key
    const labelMs = rule.category_label_ms || rule.category_label?.split('/')[0]?.trim() || ''

    return {
      rule_id: rule.id,
      category_key: rule.category_key,
      category_label_en: labelEn,
      category_label_ms: labelMs,
      limit_amount: rule.limit_amount !== null ? Number(rule.limit_amount) : null,
      claimed_raw: rawClaimed,
      claimed_effective: effectiveClaim,
      enforces_combined_cap: rule.enforces_combined_cap,
      sub_caps: childProgressList,
    }
  }

  // 5. Calculate for all root categories
  const categories = rootRules.map((root) => processRuleNode(root))
  const totalReliefClaimed = categories.reduce((sum, c) => sum + c.claimed_effective, 0)
  const totalReliefAvailable = categories.reduce((sum, c) => sum + (c.limit_amount || 0), 0)

  return {
    assessment_year: assessmentYear,
    total_relief_claimed: totalReliefClaimed,
    total_relief_available: totalReliefAvailable,
    categories,
    unmapped_category_warnings: unmappedWarnings,
  }
}
