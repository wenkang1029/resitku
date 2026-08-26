import { Receipt } from './calculateRelief'

export type ExpensePeriod = 'today' | 'week' | 'month' | 'year'

export interface CategoryExpense {
  category: string
  amount: number
  percentage: number
}

export interface ExpensesCalculationResult {
  period: ExpensePeriod
  totalSpent: number
  receiptCount: number
  categories: CategoryExpense[]
  startDateISO?: string
  endDateISO?: string
}

/**
 * Filters confirmed receipts by time period.
 * 
 * Period definitions:
 * - 'today': receipts on current local date (YYYY-MM-DD)
 * - 'week': receipts from Monday of the current week to today (or past 7 days)
 * - 'month': receipts within the current calendar month
 * - 'year': receipts within the current assessment / calendar year
 */
export function filterReceiptsByPeriod(
  receipts: Receipt[],
  period: ExpensePeriod = 'month',
  now: Date = new Date()
): Receipt[] {
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() // 0-indexed
  const currentDate = now.getDate()

  // Format local YYYY-MM-DD
  const formatYMD = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const todayStr = formatYMD(now)

  // Start of current week (Monday)
  const dayOfWeek = now.getDay() // 0 is Sunday, 1 is Monday...
  const diffToMonday = (dayOfWeek + 6) % 7 // 0 for Mon, 6 for Sun
  const startOfWeek = new Date(now)
  startOfWeek.setDate(currentDate - diffToMonday)
  startOfWeek.setHours(0, 0, 0, 0)
  const startOfWeekStr = formatYMD(startOfWeek)

  return receipts.filter((r) => {
    // Only confirmed, non-flagged receipts
    if (r.status !== 'confirmed' || r.needs_review) {
      return false
    }

    if (!r.transaction_date) {
      // If transaction_date missing, fallback to assessment_year if period is 'year'
      if (period === 'year') {
        return (r.assessment_year || 2025) === currentYear
      }
      return false
    }

    const txDate = r.transaction_date.slice(0, 10) // Ensure YYYY-MM-DD

    switch (period) {
      case 'today':
        return txDate === todayStr

      case 'week':
        return txDate >= startOfWeekStr && txDate <= todayStr

      case 'month': {
        const txYear = parseInt(txDate.slice(0, 4), 10)
        const txMonth = parseInt(txDate.slice(5, 7), 10) - 1
        return txYear === currentYear && txMonth === currentMonth
      }

      case 'year': {
        const txYear = parseInt(txDate.slice(0, 4), 10)
        return txYear === currentYear || (r.assessment_year === currentYear)
      }

      default:
        return false
    }
  })
}

/**
 * Aggregates spending totals and category breakdown from a list of receipts.
 * Exactly matches the dashboard expenses aggregation logic:
 *   amount = COALESCE(claimed_amount, total_amount)
 *   category = spending_category || 'other'
 */
export function calculateExpensesSummary(
  receipts: Receipt[],
  period: ExpensePeriod = 'month',
  now: Date = new Date()
): ExpensesCalculationResult {
  const eligibleReceipts = filterReceiptsByPeriod(receipts, period, now)

  let totalSpent = 0
  const categoryTotals: Record<string, number> = {}

  for (const r of eligibleReceipts) {
    const amount = Number(r.claimed_amount ?? r.total_amount) || 0
    const cat = r.spending_category || 'other'

    totalSpent += amount
    categoryTotals[cat] = (categoryTotals[cat] || 0) + amount
  }

  const categories: CategoryExpense[] = Object.entries(categoryTotals)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalSpent > 0 ? (amount / totalSpent) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)

  return {
    period,
    totalSpent,
    receiptCount: eligibleReceipts.length,
    categories,
  }
}
