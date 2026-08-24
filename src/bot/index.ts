import { Bot, InlineKeyboard } from 'grammy'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
import { createClient } from '@supabase/supabase-js'

// Load .env.local if present (for local development convenience)
const localEnvPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath })
} else {
  // Try default .env if present
  dotenv.config()
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
if (!BOT_TOKEN) {
  console.error('CRITICAL ERROR: Missing TELEGRAM_BOT_TOKEN in process.env (or .env.local).')
  process.exit(1)
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
if (!SUPABASE_URL) {
  console.error('CRITICAL ERROR: Missing NEXT_PUBLIC_SUPABASE_URL in process.env.')
  console.error('Please configure NEXT_PUBLIC_SUPABASE_URL in your deployment platform (e.g. Railway).')
  process.exit(1)
}

const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!SUPABASE_KEY) {
  console.error('CRITICAL ERROR: Missing SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) in process.env.')
  console.error('Please configure SUPABASE_SERVICE_ROLE_KEY in your deployment platform (e.g. Railway).')
  process.exit(1)
}

const API_URL = process.env.API_BASE_URL || 'http://localhost:3000'
const WEB_URL = process.env.NGROK_URL || process.env.API_BASE_URL || 'http://localhost:3000'

const bot = new Bot(BOT_TOKEN)
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const escapeHtml = (str: string | null | undefined) =>
  (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const truncate = (str: string, maxLen = 22) =>
  str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str

// In-memory session: stores line-item toggle states per confirmation message
// Key: `${chatId}:${messageId}`, Value: Map<itemId, included>
const toggleSessions = new Map<string, Map<string, boolean>>()

// ─────────────────────────────────────────────────────────────────────────────
// BUILD CONFIRMATION CARD
// Returns { text, keyboard } for both Path A and Path B
// ─────────────────────────────────────────────────────────────────────────────

interface LineItem {
  id: string
  description: string
  amount: number
  is_claimable: boolean
  include_in_records: boolean
}

interface ConfirmCardOptions {
  receiptId: string
  merchant: string
  total: number
  date: string
  assessmentYear?: number
  spendCat: string
  reliefCat: string
  needsReview: boolean
  reviewReasons: string[]
  isPossibleDuplicate: boolean
  lineItems: LineItem[]
  sessionKey?: string
  toggleStates?: Map<string, boolean>
}

function buildConfirmCard(opts: ConfirmCardOptions): { text: string; keyboard: InlineKeyboard } {
  const {
    receiptId, merchant, total, date, assessmentYear = 2025, spendCat, reliefCat,
    needsReview, reviewReasons, isPossibleDuplicate, lineItems,
    sessionKey, toggleStates,
  } = opts

  const m = escapeHtml(merchant)
  const d = escapeHtml(date)
  const ya = assessmentYear
  const sc = escapeHtml(spendCat)
  const rc = reliefCat === 'none' ? 'None (Not claimable)' : escapeHtml(reliefCat)

  let duplicateWarning = ''
  if (isPossibleDuplicate) {
    duplicateWarning =
      `⚠️ <b>Possible Duplicate Detected!</b>\n` +
      `This receipt may already exist in your records.\n` +
      `<a href="${WEB_URL}/dashboard/receipts/${receiptId}">Compare on dashboard →</a>\n\n`
  }

  let reviewBlock = ''
  if (needsReview && reviewReasons.length > 0) {
    const reasons = reviewReasons.map(r => `  • ${escapeHtml(r)}`).join('\n')
    reviewBlock = `\n⚠️ <b>Flagged for Review:</b>\n${reasons}\n`
  }

  const keyboard = new InlineKeyboard()

  // ── PATH A: ≤6 line items OR no line items ──────────────────────────────────
  if (lineItems.length <= 6) {

    // Simple card for receipts with NO extracted line items
    if (lineItems.length === 0) {
      const text =
        `${duplicateWarning}📋 <b>Receipt Ready to Confirm</b>\n\n` +
        `🏪 <b>Merchant:</b> ${m}\n` +
        `💰 <b>Total:</b> RM ${total.toFixed(2)}\n` +
        `📅 <b>Date:</b> ${d}\n` +
        `🗓️ <b>Tax Year:</b> YA ${ya}\n` +
        `🏷️ <b>Category:</b> ${sc}\n` +
        `🏛️ <b>Tax Relief:</b> ${rc}` +
        reviewBlock

      keyboard
        .text(`🗓️ YA ${ya}`, `y:${receiptId}`)
        .row()
        .text('✅ Confirm', `c:${receiptId}`)
        .text('✏️ Edit Details', `e:${receiptId}`)

      return { text, keyboard }
    }

    // Path A: Line-item toggles
    const states = toggleStates || new Map(lineItems.map(li => [li.id, li.include_in_records !== false]))
    const includedTotal = lineItems
      .filter(li => states.get(li.id) !== false)
      .reduce((sum, li) => sum + Number(li.amount), 0)

    // Full item list in message body
    const itemLines = lineItems.map((li, i) => {
      const incl = states.get(li.id) !== false
      const icon = incl ? '✅' : '❌'
      return `${icon} ${escapeHtml(li.description)} — RM ${Number(li.amount).toFixed(2)}`
    }).join('\n')

    const text =
      `${duplicateWarning}📋 <b>Receipt Ready to Confirm</b>\n\n` +
      `🏪 <b>Merchant:</b> ${m}\n` +
      `💰 <b>Total:</b> RM ${total.toFixed(2)}\n` +
      `📅 <b>Date:</b> ${d}\n` +
      `🗓️ <b>Tax Year:</b> YA ${ya}\n` +
      `🏷️ <b>Category:</b> ${sc}\n` +
      `🏛️ <b>Tax Relief:</b> ${rc}\n\n` +
      `<b>Line Items</b> (tap to toggle inclusion):\n${itemLines}\n\n` +
      `<b>Included Total: RM ${includedTotal.toFixed(2)}</b>` +
      reviewBlock

    // One toggle button per line item using 0-based index `t:<receiptId>:<index>` (~43 bytes)
    lineItems.forEach((li, i) => {
      const incl = states.get(li.id) !== false
      const icon = incl ? '✅' : '❌'
      const label = `${icon} ${truncate(li.description)}`
      keyboard.text(label, `t:${receiptId}:${i}`)
      if ((i + 1) % 2 === 0) keyboard.row()
    })

    keyboard.row()
      .text(`🗓️ YA ${ya}`, `y:${receiptId}`)
      .row()
      .text('✅ Confirm', `c:${receiptId}`)
      .text('✏️ Edit Details', `e:${receiptId}`)

    return { text, keyboard }
  }

  // ── PATH B: >6 line items — summary card ──────────────────────────────────
  const text =
    `${duplicateWarning}📋 <b>Receipt Ready to Confirm</b>\n\n` +
    `🏪 <b>Merchant:</b> ${m}\n` +
    `💰 <b>Total:</b> RM ${total.toFixed(2)}\n` +
    `📅 <b>Date:</b> ${d}\n` +
    `🗓️ <b>Tax Year:</b> YA ${ya}\n` +
    `🏷️ <b>Category:</b> ${sc}\n` +
    `🏛️ <b>Tax Relief:</b> ${rc}\n\n` +
    `📦 <b>${lineItems.length} line items</b> — too many to toggle here.\n` +
    `Use the web dashboard to review individual items.` +
    reviewBlock

  keyboard
    .text(`🗓️ YA ${ya}`, `y:${receiptId}`)
    .row()
    .text('✅ Confirm All', `c:${receiptId}`)
    .text('🌐 Review on Web', `w:${receiptId}`)

  return { text, keyboard }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMANDS
// ─────────────────────────────────────────────────────────────────────────────

bot.command('start', async (ctx) => {
  const telegramId = ctx.from?.id
  let isLinked = false

  if (telegramId) {
    const { data: user } = await supabase
      .from('users').select('id').eq('telegram_id', telegramId).single()
    if (user) isLinked = true
  }

  if (isLinked) {
    await ctx.reply(
      `👋 <b>Welcome back to ResitKu!</b>\n\n` +
      `Your Telegram account is connected.\n\n` +
      `📸 <b>Send a receipt photo</b> to start recording expenses.\n` +
      `📋 Use /pending to review unconfirmed receipts.`,
      { parse_mode: 'HTML' }
    )
  } else {
    await ctx.reply(
      `👋 <b>Welcome to ResitKu Bot!</b>\n\n` +
      `To start scanning receipts, connect your Telegram account:\n\n` +
      `1️⃣ Log in to your ResitKu dashboard\n` +
      `2️⃣ Go to <b>Tax Profile &amp; Settings</b>\n` +
      `3️⃣ Click <b>Generate Link Code</b>\n` +
      `4️⃣ Send: <code>/link &lt;6-digit-code&gt;</code>`,
      { parse_mode: 'HTML' }
    )
  }
})

// /link <code> command
bot.command('link', async (ctx) => {
  const telegramId = ctx.from?.id
  if (!telegramId) { await ctx.reply('❌ Unable to detect your Telegram user ID.'); return }

  const rawCode = (ctx.match || '').toString().trim()
  if (!rawCode) {
    await ctx.reply(
      `⚠️ <b>Missing Link Code</b>\n\nExample: <code>/link 123456</code>`,
      { parse_mode: 'HTML' }
    )
    return
  }

  try {
    const { data: existingLinkedUser } = await supabase
      .from('users').select('id, email').eq('telegram_id', telegramId).single()

    const username = ctx.from?.username ? `@${ctx.from.username}` : 'none'
    const userDisplay = `${ctx.from?.first_name || ''} ${ctx.from?.last_name || ''}`.trim() || 'Unknown'

    const { data: codeRecord, error: codeErr } = await supabase
      .from('link_codes').select('id, code, user_id, expires_at, used').eq('code', rawCode).single()

    if (codeErr || !codeRecord) {
      console.warn(
        `[SECURITY AUDIT] Failed /link attempt (code not found): code="${rawCode}", telegramId=${telegramId}, username=${username}, name="${userDisplay}"`
      )
      await ctx.reply(`❌ <b>Invalid Link Code</b>\n\nCode <code>${rawCode}</code> not found. Generate a new one on your dashboard.`, { parse_mode: 'HTML' })
      return
    }
    if (codeRecord.used) {
      console.warn(
        `[SECURITY AUDIT] Failed /link attempt (code already used): code="${rawCode}", telegramId=${telegramId}, username=${username}, targetUserId=${codeRecord.user_id}`
      )
      await ctx.reply(`❌ <b>Code Already Used</b>\n\nGenerate a new code on your dashboard.`, { parse_mode: 'HTML' })
      return
    }
    if (new Date(codeRecord.expires_at).getTime() < Date.now()) {
      console.warn(
        `[SECURITY AUDIT] Failed /link attempt (code expired): code="${rawCode}", telegramId=${telegramId}, username=${username}, expiredAt=${codeRecord.expires_at}`
      )
      await ctx.reply(`⏳ <b>Code Expired</b>\n\nGenerate a new code (valid 10 min) on your dashboard.`, { parse_mode: 'HTML' })
      return
    }
    if (existingLinkedUser && existingLinkedUser.id !== codeRecord.user_id) {
      console.warn(
        `[SECURITY AUDIT] Failed /link attempt (account conflict): telegramId=${telegramId}, currentlyLinkedTo=${existingLinkedUser.id}, targetUserId=${codeRecord.user_id}`
      )
      await ctx.reply(
        `⚠️ <b>Account Conflict</b>\n\nThis Telegram is already linked to <b>${existingLinkedUser.email || 'another account'}</b>.\nUnlink first from the web dashboard.`,
        { parse_mode: 'HTML' }
      )
      return
    }

    await supabase.from('link_codes').update({ used: true }).eq('id', codeRecord.id)
    const { error: updateErr } = await supabase.from('users').update({ telegram_id: telegramId }).eq('id', codeRecord.user_id)

    if (updateErr) {
      console.error(`[SECURITY AUDIT] Failed to link account in database:`, updateErr)
      await ctx.reply(`❌ Failed to link account: ${updateErr.message}`)
      return
    }

    console.log(
      `[SECURITY AUDIT] Successful /link pairing: userId=${codeRecord.user_id}, telegramId=${telegramId}, username=${username}`
    )

    await ctx.reply(
      `🎉 <b>Account Connected!</b>\n\nYour Telegram is paired with ResitKu.\n\n📸 Send a receipt photo to start tracking!`,
      { parse_mode: 'HTML' }
    )
  } catch (err: any) {
    await ctx.reply(`❌ Error: ${err.message || 'Unknown error'}`)
  }
})

// /pending command — re-sends confirmation card for oldest unconfirmed receipt
bot.command('pending', async (ctx) => {
  const telegramId = ctx.from?.id
  if (!telegramId) return

  const { data: userRow } = await supabase
    .from('users').select('id').eq('telegram_id', telegramId).single()
  if (!userRow) {
    await ctx.reply('🔒 Please link your account first. See /start for instructions.')
    return
  }

  const { data: pendingReceipts } = await supabase
    .from('receipts')
    .select('id, merchant, total_amount, transaction_date, assessment_year, needs_review, possible_duplicate, spending_category, relief_category')
    .eq('user_id', userRow.id)
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true })
    .limit(1)

  if (!pendingReceipts || pendingReceipts.length === 0) {
    await ctx.reply('✅ <b>No pending receipts!</b>\n\nAll your receipts are confirmed.', { parse_mode: 'HTML' })
    return
  }

  const r = pendingReceipts[0]
  const { data: lineItems } = await supabase
    .from('receipt_line_items').select('id, description, amount, is_claimable, include_in_records').eq('receipt_id', r.id)

  const card = buildConfirmCard({
    receiptId: r.id,
    merchant: r.merchant || 'Unknown',
    total: Number(r.total_amount || 0),
    date: r.transaction_date || 'Unknown',
    assessmentYear: r.assessment_year || 2025,
    spendCat: r.spending_category || 'other',
    reliefCat: r.relief_category || 'none',
    needsReview: r.needs_review,
    reviewReasons: [],
    isPossibleDuplicate: r.possible_duplicate || false,
    lineItems: (lineItems || []) as LineItem[],
  })

  const sentMsg = await ctx.reply(card.text, { parse_mode: 'HTML', reply_markup: card.keyboard })

  // Store toggle session
  if (lineItems && lineItems.length > 0 && lineItems.length <= 6) {
    const sessionKey = `${ctx.chat.id}:${sentMsg.message_id}`
    const states = new Map(lineItems.map(li => [li.id, li.include_in_records !== false]))
    toggleSessions.set(sessionKey, states)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// PHOTO HANDLER
// ─────────────────────────────────────────────────────────────────────────────

bot.on('message:photo', async (ctx) => {
  const telegramId = ctx.from?.id
  if (!telegramId) { await ctx.reply('❌ Unable to identify sender.'); return }

  // Look up linked user FIRST
  const { data: userRow } = await supabase
    .from('users').select('id').eq('telegram_id', telegramId).single()

  if (!userRow) {
    await ctx.reply(
      `🔒 <b>Account Not Linked</b>\n\n` +
      `Connect your Telegram to ResitKu first:\n\n` +
      `1️⃣ Log in to your ResitKu dashboard\n` +
      `2️⃣ Open <b>Tax Profile &amp; Settings</b>\n` +
      `3️⃣ Click <b>Generate Link Code</b>\n` +
      `4️⃣ Send: <code>/link &lt;6-digit-code&gt;</code>\n\n` +
      `<i>No receipt was processed.</i>`,
      { parse_mode: 'HTML' }
    )
    return
  }

  const statusMsg = await ctx.reply('🔍 <i>Processing your receipt...</i>', { parse_mode: 'HTML' })

  try {
    const photo = ctx.message.photo[ctx.message.photo.length - 1]
    const file = await ctx.api.getFile(photo.file_id)

    if (!file.file_path) {
      await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, '❌ Failed to download photo.')
      return
    }

    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`
    const imgRes = await fetch(fileUrl)
    const arrayBuffer = await imgRes.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    const extractRes = await fetch(`${API_URL}/api/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: base64, mime_type: 'image/jpeg', user_id: userRow.id }),
    })

    const data = await extractRes.json()

    // Rejection path
    if (data.status === 'rejected' || data.reason === 'image_unreadable') {
      await ctx.api.editMessageText(
        ctx.chat.id, statusMsg.message_id,
        `⚠️ <b>Receipt Unreadable</b>\n\n${escapeHtml(data.details || 'Too blurry or missing details.')}\n\n📸 Please resend a clearer photo.`,
        { parse_mode: 'HTML' }
      )
      return
    }

    if (!data.success && data.error) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        `⚠️ <b>Unable to Read Receipt</b>\n\n` +
        `We had trouble extracting information from this photo.\n\n` +
        `📸 <i>Tips for best results:</i>\n` +
        `• Ensure good lighting without shadows or glare\n` +
        `• Flatten the receipt on a dark background\n` +
        `• Keep store name, date, and total amount clearly visible\n\n` +
        `Please try sending a clearer photo!`,
        { parse_mode: 'HTML' }
      )
      return
    }

    const receipt = data.db_receipt
    const llm = data.raw_llm_response || {}

    // Fetch full line items with IDs from DB
    const { data: lineItems } = await supabase
      .from('receipt_line_items')
      .select('id, description, amount, is_claimable, include_in_records')
      .eq('receipt_id', receipt?.id || '')

    const card = buildConfirmCard({
      receiptId: receipt?.id || '',
      merchant: llm.merchant || 'Unknown',
      total: Number(llm.total_amount || 0),
      date: llm.transaction_date || 'Unknown',
      assessmentYear: receipt?.assessment_year || 2025,
      spendCat: llm.spending_category || 'other',
      reliefCat: llm.relief_category || 'none',
      needsReview: data.needs_review || false,
      reviewReasons: data.review_reasons || [],
      isPossibleDuplicate: receipt?.possible_duplicate || false,
      lineItems: (lineItems || []) as LineItem[],
    })

    await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, card.text, {
      parse_mode: 'HTML',
      reply_markup: card.keyboard,
    })

    // Store toggle session for Path A receipts
    if (lineItems && lineItems.length > 0 && lineItems.length <= 6) {
      const sessionKey = `${ctx.chat.id}:${statusMsg.message_id}`
      const states = new Map(lineItems.map((li: LineItem) => [li.id, li.include_in_records !== false]))
      toggleSessions.set(sessionKey, states)
    }

  } catch (error: any) {
    console.error('Error handling photo:', error)
    try {
      await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id,
        `❌ Error: ${escapeHtml(error.message || 'Unknown error')}`)
    } catch {}
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// CALLBACK HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

// Toggle line item inclusion: matches `t:<receiptId>:<itemIndex>` or legacy `toggle:<receiptId>:<itemId>`
bot.callbackQuery(/^(?:t|toggle):([^:]+):(.+)$/, async (ctx) => {
  const receiptId = ctx.match[1]
  const indexOrId = ctx.match[2]
  const msgId = ctx.callbackQuery.message?.message_id
  const chatId = ctx.chat?.id
  if (!msgId || !chatId) { await ctx.answerCallbackQuery(); return }

  const sessionKey = `${chatId}:${msgId}`

  // Fetch current line items from DB
  const { data: lineItems } = await supabase
    .from('receipt_line_items')
    .select('id, description, amount, is_claimable, include_in_records')
    .eq('receipt_id', receiptId)

  if (!lineItems || lineItems.length === 0) {
    await ctx.answerCallbackQuery({ text: 'Receipt line items not found.' })
    return
  }

  // Resolve target item by index (if numeric) or direct ID (if legacy UUID)
  let targetItem = null
  const itemIndex = parseInt(indexOrId, 10)
  if (!isNaN(itemIndex) && itemIndex >= 0 && itemIndex < lineItems.length) {
    targetItem = lineItems[itemIndex]
  } else {
    targetItem = lineItems.find((li: any) => li.id === indexOrId)
  }

  if (!targetItem) {
    await ctx.answerCallbackQuery({ text: 'Item not found.' })
    return
  }

  let states = toggleSessions.get(sessionKey)
  if (!states) {
    states = new Map(lineItems.map((li: any) => [li.id, li.include_in_records !== false]))
    toggleSessions.set(sessionKey, states)
  }

  // Toggle the tapped item in memory & database
  const current = states.get(targetItem.id) !== false
  const newValue = !current
  states.set(targetItem.id, newValue)

  // Write directly to DB
  await supabase
    .from('receipt_line_items')
    .update({ include_in_records: newValue })
    .eq('id', targetItem.id)

  // Fetch receipt data to rebuild card
  const { data: receipt } = await supabase
    .from('receipts')
    .select('id, merchant, total_amount, transaction_date, assessment_year, spending_category, relief_category, needs_review, possible_duplicate')
    .eq('id', receiptId).single()

  if (!receipt) { await ctx.answerCallbackQuery({ text: 'Receipt not found.' }); return }

  const card = buildConfirmCard({
    receiptId,
    merchant: receipt.merchant || 'Unknown',
    total: Number(receipt.total_amount || 0),
    date: receipt.transaction_date || 'Unknown',
    assessmentYear: receipt.assessment_year || 2025,
    spendCat: receipt.spending_category || 'other',
    reliefCat: receipt.relief_category || 'none',
    needsReview: receipt.needs_review || false,
    reviewReasons: [],
    isPossibleDuplicate: receipt.possible_duplicate || false,
    lineItems: (lineItems || []) as LineItem[],
    sessionKey,
    toggleStates: states,
  })

  await ctx.answerCallbackQuery()
  try {
    await ctx.editMessageText(card.text, { parse_mode: 'HTML', reply_markup: card.keyboard })
  } catch {}
})

// Cycle Assessment Year button: matches `y:<receiptId>`
bot.callbackQuery(/^(?:y|year):(.+)$/, async (ctx) => {
  const receiptId = ctx.match[1]
  const msgId = ctx.callbackQuery.message?.message_id
  const chatId = ctx.chat?.id
  if (!msgId || !chatId) { await ctx.answerCallbackQuery(); return }

  const sessionKey = `${chatId}:${msgId}`

  // Fetch current receipt
  const { data: receipt } = await supabase
    .from('receipts')
    .select('id, merchant, total_amount, transaction_date, assessment_year, spending_category, relief_category, needs_review, possible_duplicate')
    .eq('id', receiptId).single()

  if (!receipt) { await ctx.answerCallbackQuery({ text: 'Receipt not found.' }); return }

  // Cycle year: 2025 -> 2026 -> 2024 -> 2025
  const currentYear = receipt.assessment_year || 2025
  const nextYear = currentYear === 2025 ? 2026 : currentYear === 2026 ? 2024 : 2025

  // Fetch corresponding rule_version_id for target nextYear
  let { data: rules } = await supabase
    .from('relief_rules')
    .select('id, category_key, rule_version, status')
    .eq('assessment_year', nextYear)
    .eq('status', 'active')

  if (!rules || rules.length === 0) {
    const { data: draftRules } = await supabase
      .from('relief_rules')
      .select('id, category_key, rule_version, status')
      .eq('assessment_year', nextYear)
      .eq('status', 'draft')
    rules = draftRules || []
  }

  const hasRules = rules && rules.length > 0
  let newRuleVersionId: string | null = null
  if (hasRules) {
    const matchedRule = rules.find((r) => r.category_key === receipt.relief_category)
    if (matchedRule) {
      newRuleVersionId = matchedRule.id
    } else {
      const noneRule = rules.find((r) => r.category_key === 'none')
      const fallbackRule = noneRule || rules[0]
      newRuleVersionId = fallbackRule ? fallbackRule.id : null
    }
  }

  // Update DB with both assessment_year and rule_version_id
  await supabase
    .from('receipts')
    .update({
      assessment_year: nextYear,
      rule_version_id: newRuleVersionId,
    })
    .eq('id', receiptId)

  // Fetch line items
  const { data: lineItems } = await supabase
    .from('receipt_line_items')
    .select('id, description, amount, is_claimable, include_in_records')
    .eq('receipt_id', receiptId)

  const states = toggleSessions.get(sessionKey)

  const reviewReasons: string[] = []
  if (!hasRules) {
    reviewReasons.push(`⚠️ Tax relief rules for YA ${nextYear} have not been published yet. Claims will be calculated once rules are released.`)
  }

  const card = buildConfirmCard({
    receiptId,
    merchant: receipt.merchant || 'Unknown',
    total: Number(receipt.total_amount || 0),
    date: receipt.transaction_date || 'Unknown',
    assessmentYear: nextYear,
    spendCat: receipt.spending_category || 'other',
    reliefCat: receipt.relief_category || 'none',
    needsReview: (!hasRules) || (receipt.needs_review || false),
    reviewReasons,
    isPossibleDuplicate: receipt.possible_duplicate || false,
    lineItems: (lineItems || []) as LineItem[],
    sessionKey,
    toggleStates: states,
  })

  const popupText = hasRules
    ? `Switched to YA ${nextYear}`
    : `Switched to YA ${nextYear} (Notice: YA ${nextYear} rules pending release)`

  await ctx.answerCallbackQuery({ text: popupText })
  try {
    await ctx.editMessageText(card.text, { parse_mode: 'HTML', reply_markup: card.keyboard })
  } catch {}
})

// Confirm button: matches `c:<receiptId>` or legacy `confirm:<receiptId>`
bot.callbackQuery(/^(?:c|confirm):(.+)$/, async (ctx) => {
  const receiptId = ctx.match[1]
  const msgId = ctx.callbackQuery.message?.message_id
  const chatId = ctx.chat?.id
  const sessionKey = msgId && chatId ? `${chatId}:${msgId}` : null

  try {
    // include_in_records is already correct in the DB (written on each tap).
    // Compute the included-items sum to store in claimed_amount.
    const { data: lineItems } = await supabase
      .from('receipt_line_items')
      .select('id, amount, include_in_records')
      .eq('receipt_id', receiptId)

    const hasLineItems = lineItems && lineItems.length > 0
    const includedItems = (lineItems || []).filter((li: any) => li.include_in_records !== false)
    const excludedCount = (lineItems || []).length - includedItems.length

    // Write claimed_amount ONLY if items were excluded.
    // total_amount is NEVER mutated — it stays as the original document total.
    // Dashboards use COALESCE(claimed_amount, total_amount) for correct figures.
    if (hasLineItems && excludedCount > 0) {
      const includedTotal = includedItems.reduce((sum: number, li: any) => sum + Number(li.amount || 0), 0)
      await supabase
        .from('receipts')
        .update({ claimed_amount: includedTotal })
        .eq('id', receiptId)
    }

    // Confirm receipt via RPC (sets status = 'confirmed', needs_review = false)
    const { error } = await supabase.rpc('confirm_receipt_admin', { p_receipt_id: receiptId })
    if (error) throw error

    // Clean up in-memory session
    if (sessionKey) toggleSessions.delete(sessionKey)

    await ctx.answerCallbackQuery({ text: '✅ Receipt confirmed!' })

    const note = excludedCount > 0
      ? `\n<i>${excludedCount} item(s) excluded — dashboard total adjusted.</i>`
      : ''

    const existingText = ctx.callbackQuery.message?.text || ''
    await ctx.editMessageText(
      `${existingText}\n\n✅ <b>Confirmed &amp; saved to your dashboard.</b>${note}`,
      { parse_mode: 'HTML' }
    )
  } catch (err: any) {
    await ctx.answerCallbackQuery({ text: 'Failed to confirm receipt.' })
    console.error('Confirm error:', err)
  }
})

// Web view button: matches `w:<receiptId>` or legacy `webview:<receiptId>`
bot.callbackQuery(/^(?:w|webview):(.+)$/, async (ctx) => {
  const receiptId = ctx.match[1]
  await ctx.answerCallbackQuery()
  await ctx.reply(
    `🌐 <b>Review on Web Dashboard</b>\n\n` +
    `Open the receipt detail page to toggle individual line items:\n` +
    `<a href="${WEB_URL}/dashboard/receipts/${receiptId}">View Receipt →</a>`,
    { parse_mode: 'HTML' }
  )
})

// Edit button: matches `e:<receiptId>` or legacy `edit:<receiptId>`
bot.callbackQuery(/^(?:e|edit):(.+)$/, async (ctx) => {
  const receiptId = ctx.match[1]
  await ctx.answerCallbackQuery()
  await ctx.reply(
    `✏️ <b>Edit Receipt</b>\n\n` +
    `Open your dashboard to correct extracted fields:\n` +
    `<a href="${WEB_URL}/dashboard/receipts/${receiptId}">Edit on Dashboard →</a>`,
    { parse_mode: 'HTML' }
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// PERIODIC DIGEST & AUTO-EXPIRE (runs at startup and every 24 hours)
// ─────────────────────────────────────────────────────────────────────────────

async function runDailyMaintenance() {
  console.log('[maintenance] Running daily digest and auto-expire check...')

  // Step 1: Auto-expire receipts pending_review for > 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: staleReceipts } = await supabase
    .from('receipts')
    .select('id, user_id, merchant, total_amount')
    .eq('status', 'pending_review')
    .lt('created_at', sevenDaysAgo)

  if (staleReceipts && staleReceipts.length > 0) {
    // Group by user for notification
    const byUser = new Map<string, typeof staleReceipts>()
    for (const r of staleReceipts) {
      const existing = byUser.get(r.user_id) || []
      existing.push(r)
      byUser.set(r.user_id, existing)
    }

    // Auto-confirm all stale receipts
    for (const r of staleReceipts) {
      await supabase
        .from('receipts')
        .update({ status: 'confirmed', auto_confirmed: true })
        .eq('id', r.id)
    }

    // Notify each affected user via Telegram
    for (const [userId, receipts] of byUser.entries()) {
      const { data: userRow } = await supabase
        .from('users').select('telegram_id').eq('id', userId).single()

      if (userRow?.telegram_id) {
        const count = receipts.length
        const list = receipts.slice(0, 5).map(r =>
          `• ${escapeHtml(r.merchant || 'Unknown')} — RM ${Number(r.total_amount || 0).toFixed(2)}`
        ).join('\n')

        try {
          await bot.api.sendMessage(
            userRow.telegram_id,
            `🕐 <b>${count} receipt${count > 1 ? 's' : ''} auto-confirmed</b>\n\n` +
            `These receipts were pending for over 7 days and have been automatically confirmed:\n${list}` +
            (receipts.length > 5 ? `\n<i>...and ${receipts.length - 5} more</i>` : '') +
            `\n\nReview anytime on your <a href="${WEB_URL}/dashboard/pending">dashboard →</a>`,
            { parse_mode: 'HTML' }
          )
        } catch (e) {
          console.error(`[maintenance] Failed to notify user ${userId}:`, e)
        }
      }
    }

    console.log(`[maintenance] Auto-confirmed ${staleReceipts.length} stale receipt(s).`)
  }

  // Step 2: Send digest for receipts pending_review for > 3 days
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  const { data: needsDigest } = await supabase
    .from('receipts')
    .select('id, user_id, merchant, total_amount, transaction_date')
    .eq('status', 'pending_review')
    .eq('auto_confirmed', false)
    .lt('created_at', threeDaysAgo)

  if (needsDigest && needsDigest.length > 0) {
    const byUser = new Map<string, typeof needsDigest>()
    for (const r of needsDigest) {
      const existing = byUser.get(r.user_id) || []
      existing.push(r)
      byUser.set(r.user_id, existing)
    }

    for (const [userId, receipts] of byUser.entries()) {
      const { data: userRow } = await supabase
        .from('users').select('telegram_id').eq('id', userId).single()

      if (userRow?.telegram_id) {
        const count = receipts.length
        const shown = receipts.slice(0, 10)
        const list = shown.map(r =>
          `• ${escapeHtml(r.merchant || 'Unknown')} RM ${Number(r.total_amount || 0).toFixed(2)} on ${r.transaction_date || '?'}`
        ).join('\n')

        try {
          await bot.api.sendMessage(
            userRow.telegram_id,
            `📋 <b>You have ${count} receipt${count > 1 ? 's' : ''} awaiting confirmation</b> from the past few days:\n\n` +
            `${list}` +
            (count > 10 ? `\n<i>...and ${count - 10} more</i>` : '') +
            `\n\nSend /pending to review and confirm them one by one.`,
            { parse_mode: 'HTML' }
          )
        } catch (e) {
          console.error(`[maintenance] Failed to send digest to user ${userId}:`, e)
        }
      }
    }

    console.log(`[maintenance] Sent digest for ${needsDigest.length} pending receipt(s) across ${byUser.size} user(s).`)
  }
}

// Run at startup (delayed 5s for bot to be ready) and every 24 hours
setTimeout(() => {
  runDailyMaintenance()
  setInterval(runDailyMaintenance, 24 * 60 * 60 * 1000)
}, 5000)

// ─────────────────────────────────────────────────────────────────────────────
// START
// ─────────────────────────────────────────────────────────────────────────────

console.log('🤖 ResitKu Telegram Bot starting — Universal Confirm Flow active...')
bot.start()
