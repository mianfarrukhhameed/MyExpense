import { getRewriterApi, isAiSurfaceReady } from './capability'

type RewriterSession = {
  rewrite: (
    input: string,
    options?: { context?: string },
  ) => Promise<string>
  destroy?: () => void
}

/** Shorten/clean an expense description into a concise tag. */
export async function rewriteExpenseDescription(
  text: string,
  options?: { category?: string },
): Promise<string | null> {
  const trimmed = text.trim()
  if (trimmed.length < 3) return null

  const api = getRewriterApi()
  if (!api) return null

  const status = await api.availability({
    expectedInputLanguages: ['en'],
    expectedContextLanguages: ['en'],
    outputLanguage: 'en',
  })
  if (!isAiSurfaceReady(status)) return null

  let session: RewriterSession | null = null
  try {
    session = (await api.create({
      tone: 'as-is',
      format: 'plain-text',
      length: 'shorter',
      expectedInputLanguages: ['en'],
      expectedContextLanguages: ['en'],
      outputLanguage: 'en',
      sharedContext:
        'Rewrite into a short personal expense description or tag. Keep merchant or item names. Do not include amounts, currency, or dates.',
    })) as RewriterSession

    const context = options?.category
      ? `Category: ${options.category}. Keep it under 80 characters.`
      : 'Keep it under 80 characters.'

    const rewritten = (await session.rewrite(trimmed, { context })).trim()
    if (!rewritten) return null
    const normalized = rewritten.replace(/\s+/g, ' ').slice(0, 120)
    if (normalized.toLowerCase() === trimmed.toLowerCase()) return null
    return normalized
  } catch {
    return null
  } finally {
    session?.destroy?.()
  }
}
