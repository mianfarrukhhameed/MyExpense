import { EXPENSE_CATEGORIES } from '../../core/config/app.config'
import type { ExpenseDraft } from '../../core/types/expense-draft'
import { toDateKey } from '../../core/utils/date'

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

function extractAmount(text: string): number | null {
  const currency = text.match(
    /(?:rs\.?|pkr|usd|eur|gbp|£|\$)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/i,
  )
  if (currency?.[1]) {
    // Prefer full digit run after currency (avoid RS 1500 → 150 via {1,3})
    const after = text.slice(currency.index ?? 0).match(
      /(?:rs\.?|pkr|usd|eur|gbp|£|\$)\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
    )
    const raw = after?.[1] ?? currency[1]
    const value = Number.parseFloat(raw.replace(/,/g, ''))
    if (!Number.isNaN(value) && value > 0) return value
  }

  const withCommas = text.match(/\b([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?)\b/)
  if (withCommas?.[1]) {
    const value = Number.parseFloat(withCommas[1].replace(/,/g, ''))
    if (!Number.isNaN(value) && value > 0) return value
  }

  const decimal = text.match(/\b([0-9]+\.[0-9]{2})\b/)
  if (decimal?.[1]) {
    const value = Number.parseFloat(decimal[1])
    if (!Number.isNaN(value) && value > 0) return value
  }

  const plain = text.match(/\b([0-9]{2,})\b/g)
  if (plain) {
    for (const token of plain) {
      // Skip years / date fragments
      if (/^20\d{2}$/.test(token)) continue
      const value = Number.parseFloat(token)
      if (!Number.isNaN(value) && value > 0) return value
    }
  }

  return null
}

function extractDate(text: string): string | null {
  const iso = text.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/)
  if (iso) {
    const y = iso[1]
    const m = iso[2].padStart(2, '0')
    const d = iso[3].padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const dmy = text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/)
  if (dmy) {
    const d = dmy[1].padStart(2, '0')
    const m = dmy[2].padStart(2, '0')
    const y = dmy[3]
    return `${y}-${m}-${d}`
  }

  if (/\btoday\b/i.test(text)) return toDateKey()
  if (/\byesterday\b/i.test(text)) {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return toDateKey(d)
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
  let cleaned = text
    .replace(/(?:rs\.?|pkr|usd|eur|£|\$)\s*[0-9,.]+/gi, ' ')
    .replace(/\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (amount != null) {
    cleaned = cleaned.replace(String(amount), ' ').replace(/\s+/g, ' ').trim()
  }

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
