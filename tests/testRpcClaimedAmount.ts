import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testWebConfirm() {
  console.log('1. Inserting test receipt...')
  const { data: user, error: userErr } = await supabase.from('users').select('id').limit(1).single()
  if (userErr || !user) {
    console.error('No user found:', userErr)
    process.exit(1)
  }

  const receiptId = '00000000-0000-0000-0000-000000000099'
  
  // Clean up existing test row if any
  await supabase.from('receipt_line_items').delete().eq('receipt_id', receiptId)
  await supabase.from('receipts').delete().eq('id', receiptId)

  // Insert test receipt with total 100
  const { error: insRecErr } = await supabase.from('receipts').insert({
    id: receiptId,
    user_id: user.id,
    merchant: 'TEST EXCLUSION RECEIPT',
    total_amount: 100.00,
    claimed_amount: null,
    transaction_date: '2025-05-15',
    assessment_year: 2025,
    status: 'pending_review',
    needs_review: false
  })
  if (insRecErr) {
    console.error('Insert Receipt Error:', insRecErr)
    process.exit(1)
  }

  // Insert 2 line items: item1 (RM60, included), item2 (RM40, excluded)
  const { error: insItemsErr } = await supabase.from('receipt_line_items').insert([
    {
      receipt_id: receiptId,
      description: 'Medical Exam (Claimable)',
      amount: 60.00,
      spending_category: 'medical',
      relief_category: 'medical_fullexam_covid_mental_selftest',
      is_claimable: true,
      include_in_records: true
    },
    {
      receipt_id: receiptId,
      description: 'Snacks (Excluded)',
      amount: 40.00,
      spending_category: 'groceries',
      relief_category: 'none',
      is_claimable: false,
      include_in_records: false
    }
  ])
  if (insItemsErr) {
    console.error('Insert Line Items Error:', insItemsErr)
    process.exit(1)
  }

  console.log('2. Executing confirm_receipt_admin RPC (exact web confirmation call)...')
  const { data: confirmed, error } = await supabase.rpc('confirm_receipt_admin', { p_receipt_id: receiptId })
  if (error) {
    console.error('RPC Error:', error)
    process.exit(1)
  }

  console.log('3. Result from confirm_receipt_admin:')
  console.log('   - ID:             ', confirmed.id)
  console.log('   - Status:         ', confirmed.status)
  console.log('   - Total Amount:   ', confirmed.total_amount)
  console.log('   - Claimed Amount: ', confirmed.claimed_amount)

  const pass = Number(confirmed.claimed_amount) === 60 && confirmed.status === 'confirmed'
  console.log(pass ? '✅ TEST PASSED: claimed_amount is exactly RM60.00' : '❌ TEST FAILED')

  // Clean up
  await supabase.from('receipt_line_items').delete().eq('receipt_id', receiptId)
  await supabase.from('receipts').delete().eq('id', receiptId)
  console.log('4. Cleaned up test receipt.')
}

testWebConfirm()
