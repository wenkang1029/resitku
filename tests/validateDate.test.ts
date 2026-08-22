import {
  validateReceiptDate,
  parseMalaysianDateString,
  extractDateFromInvoiceReference,
} from '../src/lib/extraction/validateDate'

console.log('🧪 Running ResitKu Deterministic Date Validation Test Suite...\n')

let passed = 0
let total = 0

function assert(condition: boolean, name: string) {
  total++
  if (condition) {
    console.log(`✅ PASS: ${name}`)
    passed++
  } else {
    console.error(`❌ FAIL: ${name}`)
    process.exitCode = 1
  }
}

// Test Case 1: MY HERO Hypermarket (Single date signal only, DD/MM/YY)
const t1 = validateReceiptDate('22/08/26', null)
assert(t1.resolved_date === '2026-08-22', 'Test 1: Resolves 22/08/26 to 2026-08-22 via DD/MM/YY convention')
assert(t1.needs_review === false, 'Test 1: No needs_review flag for single valid date')

// Test Case 2: Disagreeing signals (Discrepancy)
const t2 = validateReceiptDate('22/08/26', 'INV-20260715-099')
assert(t2.resolved_date === '2026-08-22', 'Test 2: Retains candidate date on discrepancy')
assert(t2.needs_review === true, 'Test 2: Discrepancy triggers needs_review = true')
assert(
  Boolean(t2.review_reason?.includes('2026-08-22') && t2.review_reason?.includes('2026-07-15')),
  'Test 2: Review reason displays both candidate dates'
)

// Test Case 3: Agreeing signals
const t3 = validateReceiptDate('22/08/26', 'POS260822-0041')
assert(t3.resolved_date === '2026-08-22', 'Test 3: Resolves date when signals agree')
assert(t3.needs_review === false, 'Test 3: No false positive flag when visible date and invoice agree')

// Test Case 4: Agreeing with YYYYMMDD in invoice reference
const t4 = validateReceiptDate('22/08/2026', 'INV20260822-0091')
assert(t4.resolved_date === '2026-08-22', 'Test 4: Matches YYYYMMDD invoice pattern')
assert(t4.needs_review === false, 'Test 4: No flag on match')

// Test Case 5: Future Date Protection
const t5 = validateReceiptDate('30/12/2030', null)
assert(t5.needs_review === true, 'Test 5: Future date correctly flagged')
assert(Boolean(t5.review_reason?.includes('future relative to today')), 'Test 5: Clear future date message')

// Test Case 6: Textual Month formats (e.g. 22-Aug-2026 / 22 Ogos 2026)
const t6 = validateReceiptDate('22-Aug-2026', null)
assert(t6.resolved_date === '2026-08-22', 'Test 6: Parses textual month abbreviations')
assert(t6.needs_review === false, 'Test 6: Clean parse for textual dates')

console.log(`\n🎉 Test Results: ${passed}/${total} assertions passed.\n`)
