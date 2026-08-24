import { createClient } from '@supabase/supabase-js'
import { buildExportReliefData, generateReliefCSV } from '@/lib/relief/exportRelief'
import { calculateReliefProgress } from '@/lib/relief/calculateRelief'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function runVerification() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('Missing supabase credentials in env')
    return
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  // 1. Fetch rules for YA2025
  const { data: rules } = await supabase
    .from('relief_rules')
    .select('*')
    .eq('assessment_year', 2025)

  // 2. Fetch confirmed receipts
  const { data: receipts } = await supabase
    .from('receipts')
    .select('*, receipt_line_items(*)')
    .eq('status', 'confirmed')

  console.log('=====================================================')
  console.log('📊 TEST 1: YA 2025 - Dashboard vs Export Parity Test')
  console.log('=====================================================')
  const dashboardCalc = calculateReliefProgress(rules || [], receipts || [], 2025)
  const exportData = buildExportReliefData(rules || [], receipts || [], 2025, 'user@example.com')
  const csv = generateReliefCSV(exportData)

  console.log('Confirmed Receipts Count:', receipts?.length || 0)
  console.log('Dashboard Total Claimed: RM', dashboardCalc.total_relief_claimed.toFixed(2))
  console.log('Export Total Claimed:    RM', exportData.total_relief_claimed.toFixed(2))
  console.log('Export Available Cap:    RM', exportData.total_relief_available.toFixed(2))
  console.log('Mathematical Parity:    ', dashboardCalc.total_relief_claimed === exportData.total_relief_claimed ? '✅ EXACT MATCH' : '❌ MISMATCH')

  console.log('\n--- Active Category Comparison ---')
  const activeDashboard = dashboardCalc.categories.filter((c) => c.claimed_effective > 0)
  const activeExport = exportData.categories.filter((c) => c.claimed_effective > 0)

  console.log(`Active categories: Dashboard (${activeDashboard.length}), Export (${activeExport.length})`)
  activeExport.forEach((c) => {
    console.log(` • [${c.category_key}] ${c.category_label_en}: Claimed RM ${c.claimed_effective.toFixed(2)} / Limit RM ${c.limit_amount}`)
  })

  console.log('\n--- All Contributing Items in Export ---')
  exportData.all_contributing_items.forEach((item) => {
    console.log(` • [${item.relief_category}] ${item.merchant} - ${item.description}: RM ${item.amount.toFixed(2)} (${item.transaction_date})`)
  })

  console.log('\n--- Generated CSV (First 20 lines) ---')
  console.log(csv.split('\r\n').slice(0, 20).join('\n'))

  console.log('\n=====================================================')
  console.log('📊 TEST 2: YA 2024 - Zero-Receipts / Empty Year Test')
  console.log('=====================================================')
  const emptyCalc = calculateReliefProgress([], [], 2024)
  const emptyExport = buildExportReliefData([], [], 2024, 'user@example.com')
  const emptyCsv = generateReliefCSV(emptyExport)

  console.log('YA 2024 Total Claimed: RM', emptyExport.total_relief_claimed.toFixed(2))
  console.log('YA 2024 CSV Output:')
  console.log(emptyCsv)
}

runVerification()
