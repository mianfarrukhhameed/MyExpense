import {
  deleteEmbedding,
  listEmbeddings,
  upsertEmbedding,
  type EmbeddingEntity,
} from '../../db/embeddings.repo'
import { cosineSimilarity, embedText } from './embeddings'
import { getSemanticEmbedderApi, isAiSurfaceReady } from './capability'

export type SearchDoc = {
  id: string
  text: string
}

export async function isSemanticSearchAvailable(): Promise<boolean> {
  const api = getSemanticEmbedderApi()
  if (!api?.availability) return false
  try {
    return isAiSurfaceReady(await api.availability())
  } catch {
    return false
  }
}

export async function indexSearchDocument(
  entity: EmbeddingEntity,
  id: string,
  text: string,
): Promise<void> {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) {
    await deleteEmbedding(entity, id)
    return
  }
  const vector = await embedText(cleaned, 'retrieval-document')
  if (!vector) return
  await upsertEmbedding({
    entity,
    id,
    text: cleaned,
    values: Array.from(vector),
    updated_at: new Date().toISOString(),
  })
}

export async function removeSearchDocument(
  entity: EmbeddingEntity,
  id: string,
): Promise<void> {
  await deleteEmbedding(entity, id)
}

/** Ensure docs missing from the index get embedded (best-effort). */
export async function backfillSearchIndex(
  entity: EmbeddingEntity,
  docs: SearchDoc[],
): Promise<void> {
  if (!(await isSemanticSearchAvailable())) return
  const existing = new Set(
    (await listEmbeddings(entity)).map((row) => row.id),
  )
  for (const doc of docs) {
    if (existing.has(doc.id)) continue
    if (!doc.text.trim()) continue
    await indexSearchDocument(entity, doc.id, doc.text)
  }
}

/**
 * Rank document ids by cosine similarity to the query.
 * Returns ids scoring at or above minScore, highest first.
 */
export async function semanticRankIds(
  entity: EmbeddingEntity,
  query: string,
  candidateIds: string[],
  minScore = 0.22,
): Promise<string[]> {
  const q = query.trim()
  if (!q || candidateIds.length === 0) return candidateIds

  const queryVector = await embedText(q, 'retrieval-query')
  if (!queryVector) return candidateIds

  const allowed = new Set(candidateIds)
  const rows = (await listEmbeddings(entity)).filter((row) =>
    allowed.has(row.id),
  )
  if (rows.length === 0) return []

  const scored = rows
    .map((row) => ({
      id: row.id,
      score: cosineSimilarity(queryVector, Float32Array.from(row.values)),
    }))
    .filter((row) => row.score >= minScore)
    .sort((a, b) => b.score - a.score)

  return scored.map((row) => row.id)
}
