import { getWriterApi, isAiSurfaceReady } from './capability'

type WriterSession = {
  write: (input: string, options?: { context?: string }) => Promise<string>
  destroy?: () => void
}

export type FinancialReviewMetrics = {
  monthLabel: string
  currency: string
  budget: number
  spent: number
  remaining: number
  overspent: boolean
  burnOverPace: boolean
  projectedMonthEnd: number
  topCategories: Array<{ category: string; total: number }>
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(0)}`
  }
}

function buildReviewPrompt(metrics: FinancialReviewMetrics): string {
  const cats =
    metrics.topCategories.length > 0
      ? metrics.topCategories
          .map(
            (row) =>
              `${row.category}: ${formatMoney(row.total, metrics.currency)}`,
          )
          .join('; ')
      : 'none yet'
  return [
    `Write a short personal financial health review for ${metrics.monthLabel}.`,
    `Budget ${formatMoney(metrics.budget, metrics.currency)},`,
    `spent ${formatMoney(metrics.spent, metrics.currency)},`,
    `remaining ${formatMoney(metrics.remaining, metrics.currency)}.`,
    metrics.overspent ? 'Over budget.' : 'Within budget.',
    metrics.burnOverPace
      ? `Pace is high; projected month-end ${formatMoney(metrics.projectedMonthEnd, metrics.currency)}.`
      : `Pace looks OK; projected month-end ${formatMoney(metrics.projectedMonthEnd, metrics.currency)}.`,
    `Top categories: ${cats}.`,
    'Be concrete, encouraging, and under 120 words. No markdown headings.',
  ].join(' ')
}

/** On-device Writer API → personalized monthly financial review. */
export async function writeFinancialReview(
  metrics: FinancialReviewMetrics,
): Promise<string> {
  const api = getWriterApi()
  if (!api) throw new Error('Writer API is not available in this browser')

  const status = await api.availability({
    expectedInputLanguages: ['en'],
    expectedContextLanguages: ['en'],
    outputLanguage: 'en',
  })
  if (!isAiSurfaceReady(status)) {
    throw new Error('Writer model is not ready. Check chrome://on-device-internals.')
  }

  let session: WriterSession | null = null
  try {
    session = (await api.create({
      tone: 'as-is',
      format: 'plain-text',
      length: 'short',
      expectedInputLanguages: ['en'],
      expectedContextLanguages: ['en'],
      outputLanguage: 'en',
      sharedContext:
        'You are a concise personal budget coach for a household expense tracker. Avoid judgment; give practical next steps.',
    })) as WriterSession

    const text = await session.write(buildReviewPrompt(metrics), {
      context: 'Output only the review paragraph(s), no title.',
    })
    const cleaned = text?.trim()
    if (!cleaned) throw new Error('Writer returned an empty review')
    return cleaned
  } finally {
    session?.destroy?.()
  }
}
