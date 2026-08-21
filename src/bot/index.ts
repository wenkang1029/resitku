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
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const API_URL = process.env.API_BASE_URL || 'http://localhost:3000'

// Single-user default mapping for v1 personal use
const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || '8fd180b8-e569-4f19-ae6d-fca7305fd3a1'

const bot = new Bot(BOT_TOKEN)
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// /start command
bot.command('start', async (ctx) => {
  await ctx.reply(
    `👋 *Welcome to ResitKu Bot!*\n\n` +
    `Simply send me a photo of your receipt (groceries, transport, medical, lifestyle, etc.).\n\n` +
    `I'll automatically:\n` +
    `1. Extract the merchant, date, amount, and items\n` +
    `2. Check for Malaysian tax relief eligibility (YA 2025)\n` +
    `3. Save it to your ResitKu expense tracker`,
    { parse_mode: 'Markdown' }
  )
})

// Photo handler
bot.on('message:photo', async (ctx) => {
  const statusMsg = await ctx.reply('🔍 *Processing your receipt...*', { parse_mode: 'Markdown' })

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

    // Determine telegram user mapping
    const telegramId = String(ctx.from?.id || '')
    let effectiveUserId = DEFAULT_USER_ID

    // Check if telegram_id exists in users table
    if (telegramId) {
      const { data: userRow } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_id', telegramId)
        .single()

      if (userRow) {
        effectiveUserId = userRow.id
      }
    }

    // Call extraction API route (/api/extract)
    const extractRes = await fetch(`${API_URL}/api/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_base64: base64,
        mime_type: 'image/jpeg',
        user_id: effectiveUserId,
      }),
    })

    const data = await extractRes.json()

    // 1. REJECTION PATH (unreadable/blurry)
    if (data.status === 'rejected' || data.reason === 'image_unreadable') {
      const reasonText = data.details || 'The photo is too blurry, dark, or missing core transaction details.'
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        `⚠️ *Receipt Unreadable*\n\n` +
        `Could not extract receipt data: _${reasonText}_\n\n` +
        `📸 Please resend a clearer, well-lit photo of the receipt.`,
        { parse_mode: 'Markdown' }
      )
      return
    }

    if (!data.success && data.error) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        `❌ *Extraction Error:* ${data.error}`,
        { parse_mode: 'Markdown' }
      )
      return
    }

    const escapeMd = (str: string) => str.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1')

    const merchant = escapeMd(llm.merchant || 'Unknown')
    const total = Number(llm.total_amount || 0).toFixed(2)
    const date = escapeMd(llm.transaction_date || 'N/A')
    const spendCat = escapeMd(llm.spending_category || 'other')
    const reliefCat = llm.relief_category === 'none' ? 'None (Not claimable)' : escapeMd(llm.relief_category)

    // 2. NEEDS REVIEW PATH
    if (data.needs_review) {
      const reasons = (data.review_reasons || []).map((r: string) => `• ${r}`).join('\n')
      const keyboard = new InlineKeyboard()
        .text('✅ Confirm', `confirm:${receipt?.id}`)
        .text('✏️ Edit', `edit:${receipt?.id}`)

      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        `⚠️ *Receipt Needs Review*\n\n` +
        `🏪 *Merchant:* ${merchant}\n` +
        `💰 *Total:* RM ${total}\n` +
        `📅 *Date:* ${date}\n` +
        `🏷️ *Category:* ${spendCat}\n` +
        `🏛️ *Tax Relief:* ${reliefCat}\n\n` +
        `*Flagged Reasons:*\n${reasons}\n\n` +
        `Please check if the details are correct:`,
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        }
      )
      return
    }

    // 3. AUTO-CONFIRMED PATH
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      `✅ *Receipt Saved & Confirmed!*\n\n` +
      `🏪 *Merchant:* ${merchant}\n` +
      `💰 *Total:* RM ${total}\n` +
      `📅 *Date:* ${date}\n` +
      `🏷️ *Category:* ${spendCat}\n` +
      `🏛️ *Tax Relief:* ${reliefCat}\n\n` +
      `_Recorded to your ResitKu dashboard._`,
      { parse_mode: 'Markdown' }
    )
  } catch (error: any) {
    console.error('Error handling Telegram photo:', error)
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      `❌ *Error processing photo:* ${error.message || 'Unknown error'}`
    )
  }
})

// Callback query: Confirm button
bot.callbackQuery(/^confirm:(.+)$/, async (ctx) => {
  const receiptId = ctx.match[1]
  try {
    const { error } = await supabase
      .from('receipts')
      .update({ status: 'confirmed', needs_review: false })
      .eq('id', receiptId)

    if (error) throw error

    await ctx.answerCallbackQuery({ text: 'Receipt confirmed!' })
    await ctx.editMessageText(
      `${ctx.callbackQuery.message?.text || ''}\n\n✅ *Status updated to Confirmed.*`,
      { parse_mode: 'Markdown' }
    )
  } catch (err: any) {
    await ctx.answerCallbackQuery({ text: 'Failed to update receipt.' })
    console.error('Confirm error:', err)
  }
})

// Callback query: Edit button
bot.callbackQuery(/^edit:(.+)$/, async (ctx) => {
  const receiptId = ctx.match[1]
  await ctx.answerCallbackQuery()
  await ctx.reply(
    `✏️ *Edit Receipt (${receiptId})*\n\n` +
    `For v1 manual corrections, you can edit this directly in your web dashboard, or reply here with corrections (e.g. "Amount: 45.00").\n` +
    `_Full inline conversational editing will be enabled in v2._`,
    { parse_mode: 'Markdown' }
  )
})

// Launch bot
console.log('🤖 ResitKu Telegram Bot starting polling...')
bot.start()
