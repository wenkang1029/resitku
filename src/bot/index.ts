import { Bot, InlineKeyboard } from 'grammy'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
if (!BOT_TOKEN) {
  console.error('ERROR: Missing TELEGRAM_BOT_TOKEN in .env.local')
  process.exit(1)
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const API_URL = process.env.API_BASE_URL || 'http://localhost:3000'

const bot = new Bot(BOT_TOKEN)
// Bot uses service-role / admin client to verify codes and read telegram_id across users
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// /start command
bot.command('start', async (ctx) => {
  const telegramId = ctx.from?.id

  // Check if sender is already linked
  let isLinked = false
  if (telegramId) {
    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('telegram_id', telegramId)
      .single()

    if (user) isLinked = true
  }

  if (isLinked) {
    await ctx.reply(
      `👋 <b>Welcome back to ResitKu!</b>\n\n` +
      `Your Telegram account is connected to your ResitKu dashboard.\n\n` +
      `📸 <b>Send a photo of any receipt</b> (groceries, transport, medical, lifestyle) to record expenses & claim tax relief automatically.`,
      { parse_mode: 'HTML' }
    )
  } else {
    await ctx.reply(
      `👋 <b>Welcome to ResitKu Bot!</b>\n\n` +
      `To start scanning receipts, please connect this Telegram account to your ResitKu web dashboard:\n\n` +
      `1️⃣ Log in to your ResitKu dashboard\n` +
      `2️⃣ Go to <b>Tax Profile & Settings</b>\n` +
      `3️⃣ Click <b>Generate Link Code</b>\n` +
      `4️⃣ Send the command here: <code>/link &lt;6-digit-code&gt;</code>`,
      { parse_mode: 'HTML' }
    )
  }
})

// /link <code> command
bot.command('link', async (ctx) => {
  const telegramId = ctx.from?.id
  if (!telegramId) {
    await ctx.reply('❌ Unable to detect your Telegram user ID.')
    return
  }

  const rawCode = (ctx.match || '').toString().trim()
  if (!rawCode) {
    await ctx.reply(
      `⚠️ <b>Missing Link Code</b>\n\n` +
      `Please provide the 6-digit code from your ResitKu dashboard.\n` +
      `Example: <code>/link 123456</code>`,
      { parse_mode: 'HTML' }
    )
    return
  }

  try {
    // 1. Check if this Telegram ID is already linked to a user
    const { data: existingLinkedUser } = await supabase
      .from('users')
      .select('id, email')
      .eq('telegram_id', telegramId)
      .single()

    // 2. Query the link code in link_codes
    const { data: codeRecord, error: codeErr } = await supabase
      .from('link_codes')
      .select('id, code, user_id, expires_at, used')
      .eq('code', rawCode)
      .single()

    if (codeErr || !codeRecord) {
      await ctx.reply(
        `❌ <b>Invalid Link Code</b>\n\n` +
        `The code <code>${rawCode}</code> does not exist.\n` +
        `Please generate a fresh code from your ResitKu web dashboard.`,
        { parse_mode: 'HTML' }
      )
      return
    }

    if (codeRecord.used) {
      await ctx.reply(
        `❌ <b>Code Already Used</b>\n\n` +
        `This code has already been used. Please generate a new code on your dashboard.`,
        { parse_mode: 'HTML' }
      )
      return
    }

    if (new Date(codeRecord.expires_at).getTime() < Date.now()) {
      await ctx.reply(
        `⏳ <b>Code Expired</b>\n\n` +
        `This code has expired (valid for 10 minutes). Please generate a new code on your dashboard.`,
        { parse_mode: 'HTML' }
      )
      return
    }

    // Check if this Telegram account is linked to a DIFFERENT account
    if (existingLinkedUser && existingLinkedUser.id !== codeRecord.user_id) {
      await ctx.reply(
        `⚠️ <b>Account Conflict</b>\n\n` +
        `This Telegram account is already connected to another ResitKu account (<b>${existingLinkedUser.email || 'another user'}</b>).\n\n` +
        `Please unlink it first from the web dashboard before connecting to a new account.`,
        { parse_mode: 'HTML' }
      )
      return
    }

    // 3. Mark code as used
    await supabase
      .from('link_codes')
      .update({ used: true })
      .eq('id', codeRecord.id)

    // 4. Update user's telegram_id
    const { error: updateErr } = await supabase
      .from('users')
      .update({ telegram_id: telegramId })
      .eq('id', codeRecord.user_id)

    if (updateErr) {
      console.error('Failed to link Telegram ID to user:', updateErr)
      await ctx.reply(`❌ Failed to link account: ${updateErr.message}`)
      return
    }

    await ctx.reply(
      `🎉 <b>Account Connected Successfully!</b>\n\n` +
      `Your Telegram is now paired with your ResitKu dashboard.\n\n` +
      `📸 <b>Send me a receipt photo anytime</b> to start tracking expenses and tax reliefs!`,
      { parse_mode: 'HTML' }
    )
  } catch (err: any) {
    console.error('Error handling /link command:', err)
    await ctx.reply(`❌ Error processing link request: ${err.message || 'Unknown error'}`)
  }
})

// Photo handler
bot.on('message:photo', async (ctx) => {
  const telegramId = ctx.from?.id
  if (!telegramId) {
    await ctx.reply('❌ Unable to identify Telegram sender.')
    return
  }

  // 1. Look up user by telegram_id FIRST
  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('id, email')
    .eq('telegram_id', telegramId)
    .single()

  if (userErr || !userRow) {
    await ctx.reply(
      `🔒 <b>Account Not Linked</b>\n\n` +
      `You need to connect your Telegram to a ResitKu account before uploading receipts:\n\n` +
      `1️⃣ Log in to your ResitKu web dashboard\n` +
      `2️⃣ Open <b>Tax Profile & Settings</b>\n` +
      `3️⃣ Click <b>Generate Link Code</b>\n` +
      `4️⃣ Send: <code>/link &lt;6-digit-code&gt;</code>\n\n` +
      `<i>No receipt was processed.</i>`,
      { parse_mode: 'HTML' }
    )
    return
  }

  const statusMsg = await ctx.reply('🔍 <i>Processing your receipt...</i>', { parse_mode: 'HTML' })

  try {
    // Get highest resolution photo
    const photo = ctx.message.photo[ctx.message.photo.length - 1]
    const file = await ctx.api.getFile(photo.file_id)

    if (!file.file_path) {
      await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, '❌ Failed to download photo from Telegram.')
      return
    }

    // Download image bytes from Telegram
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`
    const imgRes = await fetch(fileUrl)
    const arrayBuffer = await imgRes.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    // Call extraction API route (/api/extract) with the matched user's ID
    const extractRes = await fetch(`${API_URL}/api/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_base64: base64,
        mime_type: 'image/jpeg',
        user_id: userRow.id,
      }),
    })

    const data = await extractRes.json()

    // 1. REJECTION PATH (unreadable/blurry)
    if (data.status === 'rejected' || data.reason === 'image_unreadable') {
      const reasonText = data.details || 'The photo is too blurry, dark, or missing core transaction details.'
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        `⚠️ <b>Receipt Unreadable</b>\n\n` +
        `Could not extract receipt data: <i>${reasonText}</i>\n\n` +
        `📸 Please resend a clearer, well-lit photo of the receipt.`,
        { parse_mode: 'HTML' }
      )
      return
    }

    if (!data.success && data.error) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        `❌ <b>Extraction Error:</b> ${data.error}`,
        { parse_mode: 'HTML' }
      )
      return
    }

    const escapeHtml = (str: string) =>
      str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')

    const receipt = data.db_receipt
    const llm = data.raw_llm_response || {}
    const merchant = escapeHtml(llm.merchant || 'Unknown')
    const total = Number(llm.total_amount || 0).toFixed(2)
    const date = escapeHtml(llm.transaction_date || 'N/A')
    const spendCat = escapeHtml(llm.spending_category || 'other')
    const reliefCat = llm.relief_category === 'none' ? 'None (Not claimable)' : escapeHtml(llm.relief_category || 'none')

    // 2. NEEDS REVIEW PATH
    if (data.needs_review) {
      const reasons = (data.review_reasons || [])
        .map((r: string) => `• ${escapeHtml(r)}`)
        .join('\n')
      const keyboard = new InlineKeyboard()
        .text('✅ Confirm', `confirm:${receipt?.id}`)
        .text('✏️ Edit', `edit:${receipt?.id}`)

      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        `⚠️ <b>Receipt Needs Review</b>\n\n` +
        `🏪 <b>Merchant:</b> ${merchant}\n` +
        `💰 <b>Total:</b> RM ${total}\n` +
        `📅 <b>Date:</b> ${date}\n` +
        `🏷️ <b>Category:</b> ${spendCat}\n` +
        `🏛️ <b>Tax Relief:</b> ${reliefCat}\n\n` +
        `<b>Flagged Reasons:</b>\n${reasons}\n\n` +
        `Please check if the details are correct:`,
        {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        }
      )
      return
    }

    // 3. AUTO-CONFIRMED PATH
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      `✅ <b>Receipt Saved & Confirmed!</b>\n\n` +
      `🏪 <b>Merchant:</b> ${merchant}\n` +
      `💰 <b>Total:</b> RM ${total}\n` +
      `📅 <b>Date:</b> ${date}\n` +
      `🏷️ <b>Category:</b> ${spendCat}\n` +
      `🏛️ <b>Tax Relief:</b> ${reliefCat}\n\n` +
      `<i>Recorded to your ResitKu dashboard.</i>`,
      { parse_mode: 'HTML' }
    )
  } catch (error: any) {
    console.error('Error handling Telegram photo:', error)
    try {
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        `❌ Error processing photo: ${error.message || 'Unknown error'}`
      )
    } catch (e) {
      console.error('Failed to send error message:', e)
    }
  }
})

// Callback query: Confirm button
bot.callbackQuery(/^confirm:(.+)$/, async (ctx) => {
  const receiptId = ctx.match[1]
  try {
    const { error } = await supabase
      .rpc('confirm_receipt_admin', { p_receipt_id: receiptId })

    if (error) throw error

    await ctx.answerCallbackQuery({ text: 'Receipt confirmed!' })
    const existingText = ctx.callbackQuery.message?.text || ''
    await ctx.editMessageText(
      `${existingText}\n\n✅ <b>Status updated to Confirmed.</b>`,
      { parse_mode: 'HTML' }
    )
  } catch (err: any) {
    await ctx.answerCallbackQuery({ text: 'Failed to update receipt.' })
    console.error('Confirm error in bot:', err)
  }
})

// Callback query: Edit button
bot.callbackQuery(/^edit:(.+)$/, async (ctx) => {
  const receiptId = ctx.match[1]
  await ctx.answerCallbackQuery()
  await ctx.reply(
    `✏️ <b>Edit Receipt (${receiptId})</b>\n\n` +
    `For v1 manual corrections, you can edit this directly in your web dashboard, or reply here with corrections (e.g. "Amount: 45.00").\n` +
    `<i>Full inline conversational editing will be enabled in v2.</i>`,
    { parse_mode: 'HTML' }
  )
})

// Launch bot
console.log('🤖 ResitKu Telegram Bot starting polling with multi-user link support...')
bot.start()
