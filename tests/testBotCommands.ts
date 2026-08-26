import assert from 'assert'
import { calculateExpensesSummary, filterReceiptsByPeriod } from '../src/lib/relief/calculateExpenses'
import { calculateReliefProgress, ReliefRule, Receipt } from '../src/lib/relief/calculateRelief'
import {
  welcomeMessageLinked,
  welcomeMessageUnlinked,
  unlinkedAccountMessage,
  expensesEmptyState,
  expensesSummaryMessage,
  reliefEmptyState,
  reliefSummaryMessage,
} from '../src/bot/messages'

console.log('🧪 Testing calculateExpensesSummary & Bot Query Formats...')

// Mock receipts
const mockReceipts: Receipt[] = [
  {
    id: 'r-1',
    merchant: 'Lotus Grocer',
    total_amount: 150.0,
    claimed_amount: null,
    transaction_date: '2026-08-26', // today
    spending_category: 'groceries',
    relief_category: 'none',
    status: 'confirmed',
    needs_review: false,
    assessment_year: 2026,
  },
  {
    id: 'r-2',
    merchant: 'Klinik Mediviron',
    total_amount: 200.0,
    claimed_amount: 120.0, // 80 excluded
    transaction_date: '2026-08-25', // this week / month
    spending_category: 'medical',
    relief_category: 'medical_serious_vaccination_dental',
    status: 'confirmed',
    needs_review: false,
    assessment_year: 2026,
    receipt_line_items: [
      {
        id: 'li-1',
        description: 'Vaccine Injection',
        amount: 120.0,
        spending_category: 'medical',
        relief_category: 'medical_serious_vaccination_dental',
        is_claimable: true,
        include_in_records: true,
      },
      {
        id: 'li-2',
        description: 'Supplements',
        amount: 80.0,
        spending_category: 'medical',
        relief_category: 'none',
        is_claimable: false,
        include_in_records: false,
      },
    ],
  },
  {
    id: 'r-3',
    merchant: 'Pending Store',
    total_amount: 50.0,
    claimed_amount: null,
    transaction_date: '2026-08-26',
    spending_category: 'shopping',
    relief_category: 'none',
    status: 'pending_review', // should be excluded
    needs_review: false,
    assessment_year: 2026,
  },
]

const now = new Date('2026-08-26T12:00:00')

// Test 1: Today period
const summaryToday = calculateExpensesSummary(mockReceipts, 'today', now)
assert.strictEqual(summaryToday.receiptCount, 1, 'Today should only include 1 confirmed receipt')
assert.strictEqual(summaryToday.totalSpent, 150.0, 'Today total should be RM150')
console.log('✅ Test 1: Today expenses filter passed')

// Test 2: Month period
const summaryMonth = calculateExpensesSummary(mockReceipts, 'month', now)
assert.strictEqual(summaryMonth.receiptCount, 2, 'Month should include 2 confirmed receipts')
assert.strictEqual(summaryMonth.totalSpent, 270.0, 'Month total should be RM270 (150 + 120)')
assert.strictEqual(summaryMonth.categories.length, 2, 'Should have 2 spending categories')
console.log('✅ Test 2: Month expenses filter passed with COALESCE claimed_amount')

// Test 3: Expenses summary message formatting
const msg = expensesSummaryMessage({
  periodLabel: 'This Month',
  totalSpent: summaryMonth.totalSpent,
  receiptCount: summaryMonth.receiptCount,
  categories: summaryMonth.categories,
  webUrl: 'http://localhost:3000',
})
assert(msg.includes('RM 270.00'), 'Formatted total in msg')
assert(msg.includes('Groceries'), 'Category in msg')
console.log('✅ Test 3: Expenses message formatting passed')

// Test 4: Relief calculation integration
const mockRules: ReliefRule[] = [
  {
    id: 'rule-med',
    assessment_year: 2026,
    rule_version: 1,
    status: 'active',
    category_key: 'medical_serious_vaccination_dental',
    category_label_en: 'Medical & Dental Examination',
    limit_amount: 10000,
    sub_cap_parent_id: null,
    enforces_combined_cap: false,
  },
]

const reliefRes = calculateReliefProgress(mockRules, mockReceipts, 2026)
assert.strictEqual(reliefRes.total_relief_claimed, 120.0, 'Relief claimed should match included items')

const reliefMsg = reliefSummaryMessage({
  year: 2026,
  totalClaimed: reliefRes.total_relief_claimed,
  totalAvailable: reliefRes.total_relief_available,
  activeCategories: [
    {
      name: 'Medical & Dental Examination',
      claimed: 120.0,
      limit: 10000,
      percentage: 1.2,
    },
  ],
  unclaimedCategoryCount: 30,
  webUrl: 'http://localhost:3000',
})
assert(reliefMsg.includes('RM 120.00'), 'Relief message includes RM 120.00')
console.log('✅ Test 4: Relief calculation and message passed')

console.log('🎉 All bot command logic unit tests passed!')
