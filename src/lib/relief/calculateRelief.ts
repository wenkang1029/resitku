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

export interface Receipt {
  id: string
  total_amount: number | null
  transaction_date: string | null
  spending_category: string | null
  relief_category: string | null
  status: 'pending_review' | 'confirmed'
  needs_review: boolean
  assessment_year: number | null
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
}

/**
 * Calculates Malaysian tax relief progress for confirmed receipts.
 * 
 * Rules:
 * 1. Exclude receipts with status !== 'confirmed' or needs_review === true or relief_category === 'none'
 * 2. effectiveClaim = min(claimed, rule.limit_amount)
 * 3. If parent.enforces_combined_cap is true (e.g. medical_combined_umbrella):
 *    Cap the aggregate sum of all children against the parent limit_amount.
 * 4. Sub-caps under parents inherit cap constraints.
 */
export function calculateReliefProgress(
  rules: ReliefRule[],
  receipts: Receipt[],
  assessmentYear: number = 2025
): ReliefCalculationResult {
  // 1. Filter eligible confirmed receipts
  const eligibleReceipts = receipts.filter(
    (r) =>
      r.status === 'confirmed' &&
      !r.needs_review &&
      r.relief_category &&
      r.relief_category !== 'none' &&
      (r.assessment_year === assessmentYear || (!r.assessment_year && assessmentYear === 2025))
  )

  // 2. Aggregate raw claims by category_key
  const claimedByCategory: Record<string, number> = {}
  for (const receipt of eligibleReceipts) {
    const key = receipt.relief_category!
    const amt = Number(receipt.total_amount) || 0
    claimedByCategory[key] = (claimedByCategory[key] || 0) + amt
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
        // Total effective claim for this umbrella is sum of its children's effective claims
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
  }
}
