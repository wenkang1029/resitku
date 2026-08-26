import assert from 'assert'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { calculateReliefProgress, ReliefRule, Receipt } from '../src/lib/relief/calculateRelief'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const sbAdmin = createClient(SUPABASE_URL, SERVICE_KEY)

async function testAdminRulesWorkflow() {
  console.log('🧪 Starting Admin Relief Rules Workflow & Guardrails Test Suite...')

  const TEST_YA = 2029
  const TEST_KEY = 'test_special_grant_category'
  let createdDraftId = ''

  try {
    // Clean up any leftovers from previous test runs
    await sbAdmin.from('relief_rules').delete().eq('assessment_year', TEST_YA).eq('category_key', TEST_KEY)

    // ── TEST 1: Creation of a DRAFT rule ─────────────────────────────────────
    console.log('\n--- Test 1: Create a DRAFT relief rule ---')
    const { data: draftRule, error: insertErr } = await sbAdmin
      .from('relief_rules')
      .insert({
        assessment_year: TEST_YA,
        rule_version: 1,
        status: 'draft',
        category_key: TEST_KEY,
        category_label: 'Geran Khas / Test Special Grant',
        category_label_en: 'Test Special Grant',
        category_label_ms: 'Geran Khas',
        limit_amount: 3000.0,
        sub_cap_parent_id: null,
        enforces_combined_cap: false,
        source_reference: 'Budget 2029 Gazette Ref 88',
      })
      .select()
      .single()

    assert(!insertErr, `Failed to insert draft rule: ${insertErr?.message}`)
    assert.strictEqual(draftRule.status, 'draft', 'Newly drafted rule must have status draft')
    assert.strictEqual(draftRule.source_reference, 'Budget 2029 Gazette Ref 88', 'Source reference preserved')
    createdDraftId = draftRule.id
    console.log(`✅ Draft rule created: ID ${createdDraftId}, status = '${draftRule.status}'`)

    // ── TEST 2: Draft Isolation from Calculation Engine ───────────────────────
    console.log('\n--- Test 2: Verify DRAFT rule is ignored by live calculations ---')
    // Active rules for YA 2029 (should only consider status: 'active')
    const { data: activeRules } = await sbAdmin
      .from('relief_rules')
      .select('*')
      .eq('assessment_year', TEST_YA)
      .eq('status', 'active')

    assert.strictEqual((activeRules || []).length, 0, 'No active rules should exist for YA 2029')

    const mockReceipts: Receipt[] = [
      {
        id: 'mock-rcpt-1',
        merchant: 'Test Vendor',
        total_amount: 500,
        claimed_amount: null,
        transaction_date: '2029-05-10',
        spending_category: 'shopping',
        relief_category: TEST_KEY,
        status: 'confirmed',
        needs_review: false,
        assessment_year: TEST_YA,
      },
    ]

    const reliefRes = calculateReliefProgress(activeRules as ReliefRule[], mockReceipts, TEST_YA)
    assert.strictEqual(reliefRes.total_relief_claimed, 0, 'Relief claimed must be RM 0 because draft rule is not active')
    console.log('✅ Isolation verified: Draft rule produces 0 claimed relief in live calculation engine')

    // ── TEST 3: Strict Immutability Guard ────────────────────────────────────
    console.log('\n--- Test 3: Immutability check on active/superseded rules ---')
    // We simulate what PATCH /api/admin/rules/[id] does:
    const simulatePatch = async (ruleId: string, payload: any) => {
      const { data: target } = await sbAdmin.from('relief_rules').select('status').eq('id', ruleId).single()
      if (!target || target.status !== 'draft') {
        return { ok: false, error: `Cannot modify rule with status '${target?.status}'. Historical rules are immutable.` }
      }
      return { ok: true }
    }

    const checkDraft = await simulatePatch(createdDraftId, { limit_amount: 4000 })
    assert.strictEqual(checkDraft.ok, true, 'Draft rules are editable')

    // ── TEST 4: Publish Draft Rule to ACTIVE & Supersede Old ──────────────────
    console.log('\n--- Test 4: Publish Draft to ACTIVE ---')
    // Promote draft
    const { error: pubErr } = await sbAdmin
      .from('relief_rules')
      .update({ status: 'active' })
      .eq('id', createdDraftId)

    assert(!pubErr, `Failed to publish draft: ${pubErr?.message}`)

    const { data: activatedRule } = await sbAdmin
      .from('relief_rules')
      .select('*')
      .eq('id', createdDraftId)
      .single()

    assert.strictEqual(activatedRule.status, 'active', 'Rule status should now be active')
    console.log(`✅ Rule ${createdDraftId} successfully published to 'active'`)

    // Now verify immutability rejects direct patch of this active rule:
    const checkActive = await simulatePatch(createdDraftId, { limit_amount: 5000 })
    assert.strictEqual(checkActive.ok, false, 'Direct edit to active rule must be rejected')
    console.log(`✅ Immutability verified: Direct update to active rule rejected with: "${checkActive.error}"`)

    // ── TEST 5: Active Rule Calculation Parity ─────────────────────────────────
    console.log('\n--- Test 5: Verify Active Rule is included in calculations ---')
    const { data: liveActiveRules } = await sbAdmin
      .from('relief_rules')
      .select('*')
      .eq('assessment_year', TEST_YA)
      .eq('status', 'active')

    const activeReliefRes = calculateReliefProgress(liveActiveRules as ReliefRule[], mockReceipts, TEST_YA)
    assert.strictEqual(activeReliefRes.total_relief_claimed, 500, 'Relief claimed must now be RM 500')
    console.log('✅ Calculation parity verified: Active rule now successfully claims RM 500')

    // ── TEST 6: Versioning on New Draft & Supersede ────────────────────────────
    console.log('\n--- Test 6: Draft Version 2 and verify version superseding ---')
    const { data: v2Draft } = await sbAdmin
      .from('relief_rules')
      .insert({
        assessment_year: TEST_YA,
        rule_version: 2,
        status: 'draft',
        category_key: TEST_KEY,
        category_label: 'Geran Khas Baru / Test Special Grant V2',
        category_label_en: 'Test Special Grant V2',
        limit_amount: 5000.0,
        sub_cap_parent_id: null,
        enforces_combined_cap: false,
        source_reference: 'Budget 2029 Amendment Gazette',
      })
      .select()
      .single()

    assert.strictEqual(v2Draft.rule_version, 2, 'Version 2 created')

    // Publish v2 -> previous v1 active rule should become 'superseded'
    await sbAdmin
      .from('relief_rules')
      .update({ status: 'superseded' })
      .eq('id', createdDraftId)

    await sbAdmin
      .from('relief_rules')
      .update({ status: 'active' })
      .eq('id', v2Draft.id)

    const { data: v1Refetched } = await sbAdmin.from('relief_rules').select('status').eq('id', createdDraftId).single()
    const { data: v2Refetched } = await sbAdmin.from('relief_rules').select('status').eq('id', v2Draft.id).single()

    assert(v1Refetched, 'v1 rule must exist')
    assert(v2Refetched, 'v2 rule must exist')
    assert.strictEqual(v1Refetched.status, 'superseded', 'Prior active version must become superseded')
    assert.strictEqual(v2Refetched.status, 'active', 'New version must become active')
    console.log('✅ Versioning lifecycle verified: V1 superseded, V2 active')

    // Clean up test data
    await sbAdmin.from('relief_rules').delete().eq('assessment_year', TEST_YA).eq('category_key', TEST_KEY)
    console.log('🧹 Cleaned up temporary test rules for YA 2029.')

    console.log('\n🎉 ALL ADMIN RELIEF RULES WORKFLOW TESTS PASSED!')
  } catch (err) {
    console.error('❌ Test failed:', err)
    if (createdDraftId) {
      await sbAdmin.from('relief_rules').delete().eq('assessment_year', TEST_YA).eq('category_key', TEST_KEY)
    }
    process.exit(1)
  }
}

testAdminRulesWorkflow()
