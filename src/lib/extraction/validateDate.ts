export interface DateValidationResult {
  resolved_date: string | null // YYYY-MM-DD format
  needs_review: boolean
  review_reason: string | null
  parsed_visible_date: string | null
  parsed_invoice_date: string | null
}

/**
 * Parses raw printed date string following Malaysian date conventions (DD/MM/YY or DD/MM/YYYY).
 * Handles common delimiters: '/', '-', '.', space.
 */
export function parseMalaysianDateString(rawDate: string | null | undefined): string | null {
  if (!rawDate || typeof rawDate !== 'string') return null

  const trimmed = rawDate.trim()
  if (!trimmed) return null

  // 1. Check if already ISO YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10)
    const month = parseInt(isoMatch[2], 10)
    const day = parseInt(isoMatch[3], 10)
    if (isValidDate(year, month, day)) {
      return formatDateISO(year, month, day)
    }
  }

  // 2. Standard Malaysian format: DD/MM/YYYY or DD/MM/YY (or DD-MM-YYYY, DD.MM.YYYY)
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})$/)
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10)
    const month = parseInt(dmyMatch[2], 10)
    let year = parseInt(dmyMatch[3], 10)

    // Expand 2-digit year (e.g. '26' -> 2026, '99' -> 1999)
    if (year < 100) {
      year = year >= 70 ? 1900 + year : 2000 + year
    }

    if (isValidDate(year, month, day)) {
      return formatDateISO(year, month, day)
    }
  }

  // 3. Textual month format: DD Mon YYYY (e.g., "22 Aug 2026" or "22-AUG-26")
  const textMonthMatch = trimmed.match(/^(\d{1,2})[-/. ]([A-Za-z]{3,9})[-/. ](\d{2,4})$/)
  if (textMonthMatch) {
    const day = parseInt(textMonthMatch[1], 10)
    const monthStr = textMonthMatch[2].toLowerCase()
    let year = parseInt(textMonthMatch[3], 10)

    const monthMap: Record<string, number> = {
      jan: 1, january: 1,
      feb: 2, february: 2,
      mar: 3, march: 3, mac: 3,
      apr: 4, april: 4,
      may: 5, mei: 5,
      jun: 6, june: 6,
      jul: 7, july: 7,
      aug: 8, august: 8, ogos: 8,
      sep: 9, september: 9,
      oct: 10, october: 10, okt: 10, oktober: 10,
      nov: 11, november: 11,
      dec: 12, december: 12, dis: 12, disember: 12,
    }

    const month = monthMap[monthStr]
    if (month) {
      if (year < 100) {
        year = year >= 70 ? 1900 + year : 2000 + year
      }
      if (isValidDate(year, month, day)) {
        return formatDateISO(year, month, day)
      }
    }
  }

  return null
}

/**
 * Attempts to extract an embedded date from an invoice / receipt reference string.
 * Looks for common patterns in Malaysian POS identifiers:
 * - YYYYMMDD (e.g. INV20260822-001)
 * - YYMMDD (e.g. POS-260822-99)
 * - DDMMYY / DDMMYYYY (e.g. RCPT220826)
 */
export function extractDateFromInvoiceReference(invoiceRef: string | null | undefined): string | null {
  if (!invoiceRef || typeof invoiceRef !== 'string') return null

  const cleaned = invoiceRef.trim()
  if (!cleaned) return null

  // Pattern 1: YYYYMMDD (e.g. 20260822)
  const yyyymmddMatch = cleaned.match(/\b(202[0-9])(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])\b/)
  if (yyyymmddMatch) {
    const year = parseInt(yyyymmddMatch[1], 10)
    const month = parseInt(yyyymmddMatch[2], 10)
    const day = parseInt(yyyymmddMatch[3], 10)
    if (isValidDate(year, month, day)) {
      return formatDateISO(year, month, day)
    }
  }

  // Pattern 2: YYMMDD embedded after hyphen, slash, or prefix (e.g. "INV-260822-", "260822")
  const yymmddMatch = cleaned.match(/(?:^|[^0-9])(2[0-9])(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])(?:[^0-9]|$)/)
  if (yymmddMatch) {
    const year = 2000 + parseInt(yymmddMatch[1], 10)
    const month = parseInt(yymmddMatch[2], 10)
    const day = parseInt(yymmddMatch[3], 10)
    if (isValidDate(year, month, day)) {
      return formatDateISO(year, month, day)
    }
  }

  return null
}

/**
 * Deterministic date validation and cross-check engine.
 */
export function validateReceiptDate(
  visibleDateRaw: string | null | undefined,
  invoiceReferenceRaw: string | null | undefined,
  fallbackLlmDate?: string | null
): DateValidationResult {
  const parsedVisible = parseMalaysianDateString(visibleDateRaw)
  const parsedInvoice = extractDateFromInvoiceReference(invoiceReferenceRaw)

  let resolvedDate: string | null = parsedVisible || parsedInvoice || parseMalaysianDateString(fallbackLlmDate)
  let needsReview = false
  let reviewReason: string | null = null

  // Cross-check: If BOTH visible date and invoice reference yielded parseable dates
  if (parsedVisible && parsedInvoice) {
    if (parsedVisible !== parsedInvoice) {
      needsReview = true
      reviewReason = `Date discrepancy: visible date is ${parsedVisible}, but invoice reference suggests ${parsedInvoice}. Please verify.`
      // Keep visible date as the candidate resolved date
      resolvedDate = parsedVisible
    }
  }

  // Absolute check 1: Unparseable date
  if (!resolvedDate) {
    return {
      resolved_date: null,
      needs_review: true,
      review_reason: 'Transaction date could not be parsed from visible date or invoice reference.',
      parsed_visible_date: parsedVisible,
      parsed_invoice_date: parsedInvoice,
    }
  }

  // Absolute check 2: Future date check
  const now = new Date()
  const todayISO = formatDateISO(now.getFullYear(), now.getMonth() + 1, now.getDate())
  if (resolvedDate > todayISO) {
    needsReview = true
    reviewReason = `Transaction date (${resolvedDate}) is in the future relative to today (${todayISO}).`
  }

  // Absolute check 3: Distant past date check (> 2 years old)
  const resolvedYear = parseInt(resolvedDate.slice(0, 4), 10)
  const currentYear = now.getFullYear()
  if (resolvedYear < currentYear - 2) {
    needsReview = true
    if (!reviewReason) {
      reviewReason = `Transaction date (${resolvedDate}) is more than 2 assessment years in the past.`
    }
  }

  return {
    resolved_date: resolvedDate,
    needs_review: needsReview,
    review_reason: reviewReason,
    parsed_visible_date: parsedVisible,
    parsed_invoice_date: parsedInvoice,
  }
}

// Helpers
function isValidDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const d = new Date(year, month - 1, day)
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day
}

function formatDateISO(year: number, month: number, day: number): string {
  const m = month < 10 ? `0${month}` : `${month}`
  const d = day < 10 ? `0${day}` : `${day}`
  return `${year}-${m}-${d}`
}
