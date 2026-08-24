import { ReliefRule, Receipt } from '@/lib/relief/calculateRelief'
import { buildExportReliefData, generateReliefCSV } from '@/lib/relief/exportRelief'
import { calculateReliefProgress } from '@/lib/relief/calculateRelief'

const mockRules: ReliefRule[] = [
  {
    id: 'rule-1',
    assessment_year: 2025,
    rule_version: 1,
    status: 'draft',
    category_key: 'medical_combined_umbrella',
    category_label_en: 'Medical expenses for self, spouse or child (umbrella)',
    category_label_ms: 'Perbelanjaan perubatan diri, pasangan atau anak',
    limit_amount: 10000,
    sub_cap_parent_id: null,
    enforces_combined_cap: true,
  },
  {
    id: 'rule-2',
    assessment_year: 2025,
    rule_version: 1,
    status: 'draft',
    category_key: 'medical_fullexam_covid_mental_selftest',
    category_label_en: 'Full medical exam, COVID-19 test, mental health',
    category_label_ms: 'Pemeriksaan perubatan penuh',
    limit_amount: 1000,
    sub_cap_parent_id: 'rule-1',
    enforces_combined_cap: false,
  },
  {
    id: 'rule-3',
    assessment_year: 2025,
    rule_version: 1,
    status: 'draft',
    category_key: 'lifestyle_general',
    category_label_en: 'Lifestyle: books, computer/phone, internet',
    category_label_ms: 'Gaya hidup',
    limit_amount: 2500,
    sub_cap_parent_id: null,
    enforces_combined_cap: false,
  },
]

const mockReceipts: Receipt[] = [
  {
    id: 'rcpt-1',
    merchant: 'CARING PHARMACY',
    transaction_date: '2025-04-12',
    total_amount: 250.0,
    claimed_amount: 150.0, // 1 item excluded
    spending_category: 'medical',
    relief_category: 'medical_combined_umbrella',
    status: 'confirmed',
    needs_review: false,
    assessment_year: 2025,
    receipt_line_items: [
      {
        id: 'li-1',
        description: 'Blood Pressure Monitor (Self-test device)',
        amount: 150.0,
        spending_category: 'medical',
        relief_category: 'medical_fullexam_covid_mental_selftest',
        is_claimable: true,
        include_in_records: true,
      },
      {
        id: 'li-2',
        description: 'Shampoo (Excluded)',
        amount: 100.0,
        spending_category: 'shopping',
        relief_category: 'none',
        is_claimable: false,
        include_in_records: false,
      },
    ],
  },
  {
    id: 'rcpt-2',
    merchant: 'POPULAR BOOKSTORE',
    transaction_date: '2025-06-20',
    total_amount: 180.0,
    claimed_amount: null,
    spending_category: 'shopping',
    relief_category: 'lifestyle_general',
    status: 'confirmed',
    needs_review: false,
    assessment_year: 2025,
    receipt_line_items: [
      {
        id: 'li-3',
        description: 'Tax Planning Guide 2025 Book',
        amount: 180.0,
        spending_category: 'shopping',
        relief_category: 'lifestyle_general',
        is_claimable: true,
        include_in_records: true,
      },
    ],
  },
]

function testMockCalculations() {
  console.log('=====================================================')
  console.log('🧪 TEST 3: Mock Data with Mixed & Excluded Line Items')
  console.log('=====================================================')

  const dashboardCalc = calculateReliefProgress(mockRules, mockReceipts, 2025)
  const exportData = buildExportReliefData(mockRules, mockReceipts, 2025, 'wenkang@example.com')
  const csv = generateReliefCSV(exportData)

  console.log('Dashboard Total Claimed: RM', dashboardCalc.total_relief_claimed.toFixed(2))
  console.log('Export Total Claimed:    RM', exportData.total_relief_claimed.toFixed(2))
  console.log('Parity Verified:        ', dashboardCalc.total_relief_claimed === exportData.total_relief_claimed ? '✅ EXACT MATCH' : '❌ MISMATCH')

  console.log('\n--- Contributing Items in Export ---')
  exportData.all_contributing_items.forEach((item) => {
    console.log(` • [${item.relief_category}] ${item.merchant} - ${item.description}: RM ${item.amount.toFixed(2)}`)
  })

  console.log('\n--- Generated CSV Output ---')
  console.log(csv)
}

testMockCalculations()
