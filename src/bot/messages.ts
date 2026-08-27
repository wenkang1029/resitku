/**
 * Centralized user-facing message strings and templates for the ResitKu Telegram Bot.
 * 
 * Provides clean, readable formatting, HTML escaping where needed,
 * and sets up a clean foundation for future bilingual (EN/BM) localization.
 */

export const escapeHtml = (str: string | null | undefined): string =>
  (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export const formatRM = (amount: number): string =>
  `RM ${amount.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

export const welcomeMessageLinked = (): string =>
  `👋 <b>Welcome back to ResitKu!</b>\n\n` +
  `Your Telegram account is connected.\n\n` +
  `📸 <b>Send a receipt photo</b> to record an expense\n` +
  `💰 <b>/expenses</b> — View spending summary (today, week, month, year)\n` +
  `🏛️ <b>/relief</b> — Check tax relief progress for current YA\n` +
  `📋 <b>/pending</b> — Review &amp; confirm pending receipts`

export const welcomeMessageUnlinked = (): string =>
  `👋 <b>Welcome to ResitKu Bot!</b>\n\n` +
  `To start scanning receipts and tracking tax reliefs, connect your Telegram account:\n\n` +
  `1️⃣ Log in to your ResitKu dashboard\n` +
  `2️⃣ Go to <b>Tax Profile &amp; Settings</b>\n` +
  `3️⃣ Click <b>Generate Link Code</b>\n` +
  `4️⃣ Send: <code>/link &lt;6-digit-code&gt;</code>`

export const unlinkedAccountMessage = (): string =>
  `🔒 <b>Account Not Linked</b>\n\n` +
  `Connect your Telegram to ResitKu first:\n\n` +
  `1️⃣ Log in to your ResitKu dashboard\n` +
  `2️⃣ Open <b>Tax Profile &amp; Settings</b>\n` +
  `3️⃣ Click <b>Generate Link Code</b>\n` +
  `4️⃣ Send: <code>/link &lt;6-digit-code&gt;</code>`

export const linkMissingCodeMessage = (): string =>
  `⚠️ <b>Missing Link Code</b>\n\nExample: <code>/link 123456</code>`

export const linkInvalidCodeMessage = (code: string): string =>
  `❌ <b>Invalid Link Code</b>\n\nCode <code>${escapeHtml(code)}</code> not found. Generate a new one on your dashboard.`

export const linkCodeAlreadyUsedMessage = (): string =>
  `❌ <b>Code Already Used</b>\n\nGenerate a new code on your dashboard.`

export const linkCodeExpiredMessage = (): string =>
  `⏳ <b>Code Expired</b>\n\nGenerate a new code (valid 10 min) on your dashboard.`

export const linkAccountConflictMessage = (email: string): string =>
  `⚠️ <b>Account Conflict</b>\n\nThis Telegram is already linked to <b>${escapeHtml(email || 'another account')}</b>.\nUnlink first from the web dashboard.`

export const linkSuccessMessage = (): string =>
  `🎉 <b>Account Connected!</b>\n\n` +
  `Your Telegram is paired with ResitKu.\n\n` +
  `📸 Send a receipt photo to start tracking!\n` +
  `💰 Use /expenses to check spending summaries.\n` +
  `🏛️ Use /relief to monitor tax relief progress.`

export const noPendingReceiptsMessage = (): string =>
  `✅ <b>No pending receipts!</b>\n\nAll your receipts are confirmed.`

export const receiptProcessingMessage = (): string =>
  `🔍 <i>Processing your receipt...</i>`

export const receiptDownloadErrorMessage = (): string =>
  `❌ Failed to download photo.`

export const receiptUnreadableMessage = (details?: string): string =>
  `⚠️ <b>Receipt Unreadable</b>\n\n` +
  `${escapeHtml(details || 'Too blurry or missing details.')}\n\n` +
  `📸 Please resend a clearer photo.`

export const receiptExtractionErrorMessage = (): string =>
  `⚠️ <b>Unable to Read Receipt</b>\n\n` +
  `We had trouble extracting information from this photo.\n\n` +
  `📸 <i>Tips for best results:</i>\n` +
  `• Ensure good lighting without shadows or glare\n` +
  `• Flatten the receipt on a dark background\n` +
  `• Keep store name, date, and total amount clearly visible\n\n` +
  `Please try sending a clearer photo!`

export const receiptConfirmedToast = (): string =>
  `✅ Receipt confirmed!`

export const receiptConfirmedMessage = (existingText: string, excludedCount: number): string => {
  const note = excludedCount > 0
    ? `\n<i>${excludedCount} item(s) excluded — dashboard total adjusted.</i>`
    : ''
  return `${existingText}\n\n✅ <b>Confirmed &amp; saved to your dashboard.</b>${note}`
}

export const webViewPromptMessage = (webUrl: string, receiptId: string): string =>
  `🌐 <b>Review on Web Dashboard</b>\n\n` +
  `Open the receipt detail page to toggle individual line items:\n` +
  `<a href="${webUrl}/dashboard/receipts/${receiptId}">View Receipt →</a>`

export const editPromptMessage = (webUrl: string, receiptId: string): string =>
  `✏️ <b>Edit Receipt</b>\n\n` +
  `Open your dashboard to correct extracted fields:\n` +
  `<a href="${webUrl}/dashboard/receipts/${receiptId}">Edit on Dashboard →</a>`

export const maintenanceAutoConfirmDigest = (
  count: number,
  list: string,
  hasMore: boolean,
  webUrl: string
): string =>
  `🕐 <b>${count} receipt${count > 1 ? 's' : ''} auto-confirmed</b>\n\n` +
  `These receipts were pending for over 7 days and have been automatically confirmed:\n${list}` +
  (hasMore ? `\n<i>...and more</i>` : '') +
  `\n\nReview anytime on your <a href="${webUrl}/dashboard/pending">dashboard →</a>`

export const maintenanceReminderDigest = (
  count: number,
  list: string,
  remainingCount: number
): string =>
  `📋 <b>You have ${count} receipt${count > 1 ? 's' : ''} awaiting confirmation</b> from the past few days:\n\n` +
  `${list}` +
  (remainingCount > 0 ? `\n<i>...and ${remainingCount} more</i>` : '') +
  `\n\nSend /pending to review and confirm them one by one.`

// ── EXPENSES COMMAND MESSAGES ───────────────────────────────────────────────

export const expensesEmptyState = (periodLabel: string): string =>
  `📊 <b>Expenses (${escapeHtml(periodLabel)})</b>\n\n` +
  `No confirmed expenses recorded for this period yet.\n\n` +
  `📸 Send a receipt photo or confirm pending ones in /pending.`

export interface ExpenseCategoryItem {
  category: string
  amount: number
  percentage: number
}

const CATEGORY_EMOJIS: Record<string, string> = {
  groceries: '🛒',
  dining: '🍽️',
  transport: '🚗',
  utilities: '💡',
  medical: '💊',
  shopping: '🛍️',
  education: '🎓',
  entertainment: '🎬',
  other: '✨',
}

export const expensesSummaryMessage = (opts: {
  periodLabel: string
  totalSpent: number
  receiptCount: number
  categories: ExpenseCategoryItem[]
  webUrl: string
}): string => {
  const { periodLabel, totalSpent, receiptCount, categories, webUrl } = opts

  // Show top categories (up to 5)
  const topCategories = categories.slice(0, 5)
  const otherCategories = categories.slice(5)
  const otherTotal = otherCategories.reduce((sum, c) => sum + c.amount, 0)

  const lines = topCategories.map((c) => {
    const emoji = CATEGORY_EMOJIS[c.category.toLowerCase()] || '🏷️'
    const name = c.category.charAt(0).toUpperCase() + c.category.slice(1)
    const pct = c.percentage.toFixed(0)
    return `${emoji} <b>${escapeHtml(name)}:</b> ${formatRM(c.amount)} <i>(${pct}%)</i>`
  })

  if (otherCategories.length > 0) {
    const otherPct = totalSpent > 0 ? ((otherTotal / totalSpent) * 100).toFixed(0) : '0'
    lines.push(`✨ <b>Other (${otherCategories.length} cats):</b> ${formatRM(otherTotal)} <i>(${otherPct}%)</i>`)
  }

  return (
    `💰 <b>Expenses Overview (${escapeHtml(periodLabel)})</b>\n` +
    `<i>(filtered by transaction date)</i>\n\n` +
    `💵 <b>Total Spent:</b> ${formatRM(totalSpent)}\n` +
    `🧾 <b>Confirmed Receipts:</b> ${receiptCount}\n\n` +
    `<b>Top Spending Categories:</b>\n` +
    `${lines.join('\n')}\n\n` +
    `<a href="${webUrl}/dashboard/expenses">View Full Breakdown on Web →</a>`
  )
}

// ── TAX RELIEF COMMAND MESSAGES ────────────────────────────────────────────

export const reliefEmptyState = (year: number, hasRules = true): string => {
  if (!hasRules) {
    return (
      `🏛️ <b>Tax Relief Progress — YA ${year}</b>\n\n` +
      `⚠️ <b>Official tax relief rules for YA ${year} have not been published yet.</b>\n\n` +
      `Your receipts for ${year} are safely recorded as expenses. Once official LHDN rules for YA ${year} are gazetted and activated, your tax relief claims will be calculated automatically!`
    )
  }

  return (
    `🏛️ <b>Tax Relief Progress — YA ${year}</b>\n\n` +
    `No relief claims recorded yet for YA ${year}.\n\n` +
    `📸 Send receipt photos eligible for tax deductions to start building your claims!`
  )
}

export interface ReliefActiveCategoryItem {
  name: string
  claimed: number
  limit: number | null
  percentage: number
}

export const reliefSummaryMessage = (opts: {
  year: number
  totalClaimed: number
  totalAvailable: number
  activeCategories: ReliefActiveCategoryItem[]
  unclaimedCategoryCount: number
  webUrl: string
}): string => {
  const { year, totalClaimed, totalAvailable, activeCategories, unclaimedCategoryCount, webUrl } = opts

  const overallPct = totalAvailable > 0 ? Math.min(100, (totalClaimed / totalAvailable) * 100).toFixed(1) : '0'

  const catLines = activeCategories.map((c) => {
    const limitStr = c.limit !== null ? formatRM(c.limit) : 'No Cap'
    const pctStr = c.limit !== null ? `(${c.percentage.toFixed(0)}% used)` : ''
    return `• <b>${escapeHtml(c.name)}:</b> ${formatRM(c.claimed)} / ${limitStr} <i>${pctStr}</i>`
  })

  return (
    `🏛️ <b>Tax Relief Progress — YA ${year}</b>\n\n` +
    `📊 <b>Total Claimed:</b> ${formatRM(totalClaimed)} of ${formatRM(totalAvailable)} <i>(${overallPct}%)</i>\n\n` +
    `<b>Active Claimed Categories:</b>\n` +
    `${catLines.join('\n')}\n\n` +
    (unclaimedCategoryCount > 0
      ? `<i>+ ${unclaimedCategoryCount} other statutory categories currently unclaimed.</i>\n\n`
      : '') +
    `<a href="${webUrl}/dashboard/relief">View Form BE Details &amp; Export →</a>`
  )
}
