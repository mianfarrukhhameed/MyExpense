import { EXPENSE_CATEGORIES } from '../../core/config/app.config'
import { getSemanticEmbedderApi, isAiSurfaceReady } from './capability'

type EmbedderSession = {
  embed: (
    input: string | string[],
    options?: { taskType?: string },
  ) => Promise<EmbedResult | EmbedResult[]>
  destroy?: () => void
}

type EmbedResult = {
  embeddings?: { values?: Float32Array | number[] }
  values?: Float32Array | number[]
}

const CATEGORY_PROTOTYPES: Record<string, string> = {
  Food: 'Food restaurant cafe lunch dinner takeout dining',
  Travel: 'Travel uber taxi fuel petrol flight bus commute transport',
  Rent: 'Rent landlord housing apartment lease',
  Utilities: 'Utilities electric gas water internet wifi bill',
  Entertainment: 'Entertainment movie cinema netflix games streaming',
  Grocery: 'Grocery groceries supermarket market produce household food shopping',
  Kids: 'Kids children toys childcare',
  'Kids School': 'Kids school tuition fees books uniforms education',
  Clothing: 'Clothing clothes apparel shoes fashion',
  Medical: 'Medical pharmacy doctor hospital clinic medicine health',
  Services: 'Services repair salon maintenance professional service',
  'Pocket Money': 'Pocket money allowance cash personal spending',
  'Loan Return': 'Loan return repayment debt pay back',
  Other: 'Other miscellaneous general expense',
}

let categoryVectors: Array<{ category: string; vector: Float32Array }> | null =
  null

function toVector(result: EmbedResult): Float32Array | null {
  const values = result.embeddings?.values ?? result.values
  if (!values) return null
  return values instanceof Float32Array
    ? values
    : Float32Array.from(values)
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  const len = Math.min(a.length, b.length)
  if (len === 0) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < len; i += 1) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

async function withEmbedder<T>(
  fn: (session: EmbedderSession) => Promise<T>,
): Promise<T | null> {
  const api = getSemanticEmbedderApi()
  if (!api) return null
  const status = await api.availability()
  if (!isAiSurfaceReady(status)) return null

  let session: EmbedderSession | null = null
  try {
    session = (await api.create()) as EmbedderSession
    return await fn(session)
  } catch {
    return null
  } finally {
    session?.destroy?.()
  }
}

export async function embedText(
  text: string,
  taskType: 'retrieval-query' | 'retrieval-document' = 'retrieval-document',
): Promise<Float32Array | null> {
  const trimmed = text.trim()
  if (!trimmed) return null
  return withEmbedder(async (session) => {
    const result = (await session.embed(trimmed, { taskType })) as EmbedResult
    return toVector(result)
  })
}

export async function embedTexts(
  texts: string[],
  taskType: 'retrieval-query' | 'retrieval-document' = 'retrieval-document',
): Promise<Array<Float32Array | null>> {
  if (texts.length === 0) return []
  const out = await withEmbedder(async (session) => {
    const result = await session.embed(texts, { taskType })
    const list = Array.isArray(result) ? result : [result]
    return list.map((item) => toVector(item as EmbedResult))
  })
  return out ?? texts.map(() => null)
}

async function ensureCategoryVectors(): Promise<
  Array<{ category: string; vector: Float32Array }> | null
> {
  if (categoryVectors) return categoryVectors
  const categories = EXPENSE_CATEGORIES.filter((c) => c !== 'Other')
  const texts = categories.map(
    (category) => CATEGORY_PROTOTYPES[category] ?? category,
  )
  const vectors = await embedTexts(texts, 'retrieval-document')
  if (!vectors || vectors.every((v) => !v)) return null

  const ready: Array<{ category: string; vector: Float32Array }> = []
  for (let i = 0; i < categories.length; i += 1) {
    const vector = vectors[i]
    if (vector) ready.push({ category: categories[i], vector })
  }
  categoryVectors = ready.length > 0 ? ready : null
  return categoryVectors
}

/** Suggest a category from description via on-device embeddings. */
export async function suggestCategoryFromEmbedding(
  description: string,
  minScore = 0.28,
): Promise<{ category: string; score: number } | null> {
  const trimmed = description.trim()
  if (trimmed.length < 3) return null

  const query = await embedText(trimmed, 'retrieval-query')
  if (!query) return null
  const prototypes = await ensureCategoryVectors()
  if (!prototypes) return null

  let best: { category: string; score: number } | null = null
  for (const row of prototypes) {
    const score = cosineSimilarity(query, row.vector)
    if (!best || score > best.score) {
      best = { category: row.category, score }
    }
  }
  if (!best || best.score < minScore) return null
  return best
}
