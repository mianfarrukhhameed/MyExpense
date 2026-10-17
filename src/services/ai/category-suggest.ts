import { EXPENSE_CATEGORIES } from '../../core/config/app.config'
import { suggestCategoryFromEmbedding } from './embeddings'

/** High-precision keyword hits — safe to trust without embeddings. */
const STRICT_KEYWORDS: Array<{ category: string; patterns: RegExp[] }> = [
  {
    category: 'Food',
    patterns: [
      /\bfood\b/i,
      /\brestaurant\b/i,
      /\bcafe\b/i,
      /\blunch\b/i,
      /\bdinner\b/i,
      /\bbreakfast\b/i,
      /\btakeout\b/i,
    ],
  },
  {
    category: 'Grocery',
    patterns: [
      /\bgrocery\b/i,
      /\bgroceries\b/i,
      /\bsupermarket\b/i,
      /\bmarket\b/i,
    ],
  },
  {
    category: 'Travel',
    patterns: [
      /\btravel\b/i,
      /\buber\b/i,
      /\btaxi\b/i,
      /\bfuel\b/i,
      /\bpetrol\b/i,
      /\bflight\b/i,
      /\bbus\b/i,
    ],
  },
  { category: 'Rent', patterns: [/\brent\b/i, /\blandlord\b/i] },
  {
    category: 'Utilities',
    patterns: [
      /\butilities?\b/i,
      /\belectric\b/i,
      /\binternet\b/i,
      /\bwifi\b/i,
      /\bwater bill\b/i,
      /\bgas bill\b/i,
    ],
  },
  {
    category: 'Entertainment',
    patterns: [
      /\bmovie\b/i,
      /\bcinema\b/i,
      /\bnetflix\b/i,
      /\bentertainment\b/i,
    ],
  },
  {
    category: 'Kids School',
    patterns: [/\bschool\b/i, /\btuition\b/i, /\buniform\b/i],
  },
  { category: 'Kids', patterns: [/\bkids?\b/i, /\bchildren\b/i] },
  {
    category: 'Clothing',
    patterns: [/\bclothes?\b/i, /\bclothing\b/i, /\bapparel\b/i, /\bshoes?\b/i],
  },
  {
    category: 'Medical',
    patterns: [
      /\bmedical\b/i,
      /\bpharmacy\b/i,
      /\bdoctor\b/i,
      /\bhospital\b/i,
      /\bclinic\b/i,
    ],
  },
  {
    category: 'Services',
    patterns: [/\brepair\b/i, /\bsalon\b/i, /\bservice\b/i],
  },
  {
    category: 'Pocket Money',
    patterns: [/\bpocket money\b/i, /\ballowance\b/i],
  },
  {
    category: 'Loan Return',
    patterns: [/\bloan\b/i, /\brepay(?:ment)?\b/i],
  },
]

function matchStrictKeyword(text: string): string | null {
  for (const row of STRICT_KEYWORDS) {
    if (row.patterns.some((pattern) => pattern.test(text))) {
      return row.category
    }
  }
  for (const category of EXPENSE_CATEGORIES) {
    if (category === 'Other') continue
    if (
      new RegExp(`\\b${category.replace(/\s+/g, '\\s+')}\\b`, 'i').test(text)
    ) {
      return category
    }
  }
  return null
}

export type CategorySuggestion = {
  category: string
  source: 'keyword' | 'embedding'
}

/**
 * Strict keywords first; embeddings when no keyword hit.
 * Caller shows Accept/Dismiss — does not auto-apply.
 */
export async function suggestCategory(
  description: string,
): Promise<CategorySuggestion | null> {
  const text = description.trim()
  if (text.length < 2) return null

  const keyword = matchStrictKeyword(text)
  if (keyword) return { category: keyword, source: 'keyword' }

  const embedded = await suggestCategoryFromEmbedding(text)
  if (embedded) {
    return { category: embedded.category, source: 'embedding' }
  }
  return null
}
