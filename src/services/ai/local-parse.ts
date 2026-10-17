import { EXPENSE_CATEGORIES } from '../../core/config/app.config'
import type { ExpenseDraft } from '../../core/types/expense-draft'
import { daysInMonth, toDateKey } from '../../core/utils/date'

const CATEGORY_KEYWORDS: Array<{ category: string; patterns: RegExp[] }> = [
  { category: 'Food', patterns: [/food/i, /restaurant/i, /cafe/i, /lunch/i, /dinner/i, /breakfast/i] },
  { category: 'Grocery', patterns: [/grocery/i, /groceries/i, /supermarket/i, /mart\b/i] },
  { category: 'Travel', patterns: [/travel/i, /uber/i, /taxi/i, /fuel/i, /petrol/i, /flight/i, /bus/i] },
  { category: 'Rent', patterns: [/rent/i, /landlord/i] },
  { category: 'Utilities', patterns: [/utilit/i, /electric/i, /gas bill/i, /water bill/i, /internet/i, /wifi/i] },
  { category: 'Entertainment', patterns: [/movie/i, /cinema/i, /netflix/i, /game/i, /entertainment/i] },
  { category: 'Kids School', patterns: [/school/i, /tuition/i, /fee/i] },
  { category: 'Kids', patterns: [/\bkids?\b/i, /children/i] },
  { category: 'Clothing', patterns: [/cloth/i, /apparel/i, /shoes?/i] },
  { category: 'Medical', patterns: [/medical/i, /pharmacy/i, /doctor/i, /hospital/i, /clinic/i] },
  { category: 'Services', patterns: [/service/i, /repair/i, /salon/i] },
  { category: 'Pocket Money', patterns: [/pocket money/i, /allowance/i] },
  { category: 'Loan Return', patterns: [/loan/i, /repay/i, /repayment/i] },
]

const MONTH_INDEX: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sept: 8,
  sep: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
}

const MONTH_PATTERN =
  'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec'

const ORDINAL_DAY = '(?:\\d{1,2})(?:st|nd|rd|th)?'

function parseDayToken(raw: string): number | null {
  const n = Number.parseInt(raw.replace(/(?:st|nd|rd|th)$/i, ''), 10)
  if (Number.isNaN(n) || n < 1 || n > 31) return null
  return n
}

function buildDateKey(year: number, monthIndex0: number, day: number): string | null {
  const dim = daysInMonth(year, monthIndex0)
  if (day < 1 || day > dim) return null
  const d = new Date(year, monthIndex0, day)
  return toDateKey(d)
}

/** If day is ahead of today in the given month, prefer previous year (spoken past expenses). */
function resolveYearForMonthDay(
  monthIndex0: number,
  day: number,
  explicitYear?: number,
): number {
  if (explicitYear != null) return explicitYear
  const now = new Date()
  const year = now.getFullYear()
  const candidate = new Date(year, monthIndex0, day)
  if (candidate.getTime() > now.getTime() + 24 * 60 * 60 * 1000) {
    return year - 1
  }
  return year
}

/** Day-only (e.g. "on the 10th"): current month, or previous month if day is still ahead. */
function resolveDayOnly(day: number): string | null {
  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth()
  if (day > now.getDate()) {
    month -= 1
    if (month < 0) {
      month = 11
      year -= 1
    }
  }
  return buildDateKey(year, month, day)
}

/** Patterns used both to detect dates and to strip them from description/amount text. */
const DATE_STRIP_PATTERNS: RegExp[] = [
  /\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}\b/gi,
  /\b\d{1,2}[./-]\d{1,2}[./-]20\d{2}\b/gi,
  new RegExp(
    `\\b(?:on\\s+)?(?:the\\s+)?(${MONTH_PATTERN})\\s+(${ORDINAL_DAY})(?:,?\\s*(20\\d{2}))?\\b`,
    'gi',
  ),
  new RegExp(
    `\\b(?:on\\s+)?(?:the\\s+)?(${ORDINAL_DAY})(?:\\s+of)?\\s+(${MONTH_PATTERN})(?:,?\\s*(20\\d{2}))?\\b`,
    'gi',
  ),
  /\b(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/gi,
  /\b(?:today|yesterday)\b/gi,
]

function stripDatePhrases(text: string): string {
  let cleaned = text
  for (const pattern of DATE_STRIP_PATTERNS) {
    cleaned = cleaned.replace(pattern, ' ')
  }
  return cleaned.replace(/\s+/g, ' ').trim()
}

function extractDate(text: string): string | null {
  const iso = text.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/)
  if (iso) {
    const y = Number(iso[1])
    const m = Number(iso[2])
    const d = Number(iso[3])
    return buildDateKey(y, m - 1, d)
  }

  const dmy = text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/)
  if (dmy) {
    const d = Number(dmy[1])
    const m = Number(dmy[2])
    const y = Number(dmy[3])
    return buildDateKey(y, m - 1, d)
  }

  if (/\btoday\b/i.test(text)) return toDateKey()
  if (/\byesterday\b/i.test(text)) {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return toDateKey(d)
  }

  // "October 10", "Oct 10th", "October 10, 2025"
  const monthFirst = text.match(
    new RegExp(
      `\\b(?:on\\s+)?(?:the\\s+)?(${MONTH_PATTERN})\\s+(${ORDINAL_DAY})(?:,?\\s*(20\\d{2}))?\\b`,
      'i',
    ),
  )
  if (monthFirst) {
    const month = MONTH_INDEX[monthFirst[1].toLowerCase()]
    const day = parseDayToken(monthFirst[2])
    if (month != null && day != null) {
      const year = resolveYearForMonthDay(
        month,
        day,
        monthFirst[3] ? Number(monthFirst[3]) : undefined,
      )
      const key = buildDateKey(year, month, day)
      if (key) return key
    }
  }

  // "10 October", "10th of Oct", "10 October 2025"
  const dayFirst = text.match(
    new RegExp(
      `\\b(?:on\\s+)?(?:the\\s+)?(${ORDINAL_DAY})(?:\\s+of)?\\s+(${MONTH_PATTERN})(?:,?\\s*(20\\d{2}))?\\b`,
      'i',
    ),
  )
  if (dayFirst) {
    const day = parseDayToken(dayFirst[1])
    const month = MONTH_INDEX[dayFirst[2].toLowerCase()]
    if (month != null && day != null) {
      const year = resolveYearForMonthDay(
        month,
        day,
        dayFirst[3] ? Number(dayFirst[3]) : undefined,
      )
      const key = buildDateKey(year, month, day)
      if (key) return key
    }
  }

  // "on the 10th" / "the 10th" (assume recent past in current/previous month)
  const dayOnly = text.match(/\b(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/i)
  if (dayOnly) {
    const day = parseDayToken(dayOnly[1])
    if (day != null) {
      const key = resolveDayOnly(day)
      if (key) return key
    }
  }

  return null
}

function extractAmount(text: string): number | null {
  // Avoid treating spoken day numbers as amounts
  const source = stripDatePhrases(text)

  const currency = source.match(
    /(?:rs\.?|pkr|usd|eur|gbp|£|\$)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i,
  )
  if (currency?.[1]) {
    // Prefer full digit run after currency (avoid RS 1500 → 150 via {1,3})
    const after = source.slice(currency.index ?? 0).match(
      /(?:rs\.?|pkr|usd|eur|gbp|£|\$)\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
    )
    const raw = after?.[1] ?? currency[1]
    const value = Number.parseFloat(raw.replace(/,/g, ''))
    if (!Number.isNaN(value) && value > 0) return value
  }

  const withCommas = source.match(/\b([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?)\b/)
  if (withCommas?.[1]) {
    const value = Number.parseFloat(withCommas[1].replace(/,/g, ''))
    if (!Number.isNaN(value) && value > 0) return value
  }

  const decimal = source.match(/\b([0-9]+\.[0-9]{2})\b/)
  if (decimal?.[1]) {
    const value = Number.parseFloat(decimal[1])
    if (!Number.isNaN(value) && value > 0) return value
  }

  const plain = source.match(/\b([0-9]{2,})\b/g)
  if (plain) {
    for (const token of plain) {
      // Skip years
      if (/^20\d{2}$/.test(token)) continue
      const value = Number.parseFloat(token)
      if (!Number.isNaN(value) && value > 0) return value
    }
  }

  return null
}

function extractCategory(text: string): string {
  for (const row of CATEGORY_KEYWORDS) {
    if (row.patterns.some((pattern) => pattern.test(text))) {
      return row.category
    }
  }

  for (const category of EXPENSE_CATEGORIES) {
    if (new RegExp(`\\b${category.replace(/\s+/g, '\\s+')}\\b`, 'i').test(text)) {
      return category
    }
  }

  return 'Other'
}

function extractDescription(text: string, amount: number | null): string | null {
  let cleaned = stripDatePhrases(text)
    .replace(/(?:rs\.?|pkr|usd|eur|£|\$)\s*[0-9,.]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (amount != null) {
    cleaned = cleaned.replace(String(amount), ' ').replace(/\s+/g, ' ').trim()
  }

  // Drop leftover date prepositions after stripping the date itself
  cleaned = cleaned
    .replace(/\b(?:on|of)\b/gi, ' ')
    .replace(/\bfor\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned || cleaned.length < 2) return null
  return cleaned.slice(0, 120)
}

export function localParseExpense(
  text: string,
  source: ExpenseDraft['source'] = 'rules',
): ExpenseDraft {
  const amount = extractAmount(text)
  const date = extractDate(text) ?? toDateKey()
  const category = extractCategory(text)
  const description = extractDescription(text, amount)

  let confidence: ExpenseDraft['confidence'] = 'low'
  if (amount != null && category !== 'Other') confidence = 'high'
  else if (amount != null) confidence = 'medium'

  return {
    amount,
    category,
    description,
    date,
    source,
    confidence,
    rawText: text,
  }
}
