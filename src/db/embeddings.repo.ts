import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

const AI_DB_NAME = 'myexpense-ai'
const AI_DB_VERSION = 1
const STORE = 'embeddings'

export type EmbeddingEntity = 'expense' | 'plan' | 'loan'

export type EmbeddingRecord = {
  /** `${entity}:${id}` */
  key: string
  entity: EmbeddingEntity
  id: string
  text: string
  values: number[]
  updated_at: string
}

interface AiDB extends DBSchema {
  [STORE]: {
    key: string
    value: EmbeddingRecord
    indexes: {
      'by-entity': string
    }
  }
}

let dbPromise: Promise<IDBPDatabase<AiDB>> | null = null

function getAiDb(): Promise<IDBPDatabase<AiDB>> {
  if (!dbPromise) {
    dbPromise = openDB<AiDB>(AI_DB_NAME, AI_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'key' })
          store.createIndex('by-entity', 'entity')
        }
      },
    })
  }
  return dbPromise
}

export function embeddingKey(entity: EmbeddingEntity, id: string): string {
  return `${entity}:${id}`
}

export async function upsertEmbedding(
  record: Omit<EmbeddingRecord, 'key'> & { key?: string },
): Promise<void> {
  const db = await getAiDb()
  const key = record.key ?? embeddingKey(record.entity, record.id)
  await db.put(STORE, { ...record, key })
}

export async function deleteEmbedding(
  entity: EmbeddingEntity,
  id: string,
): Promise<void> {
  const db = await getAiDb()
  await db.delete(STORE, embeddingKey(entity, id))
}

export async function listEmbeddings(
  entity?: EmbeddingEntity,
): Promise<EmbeddingRecord[]> {
  const db = await getAiDb()
  if (!entity) return db.getAll(STORE)
  return db.getAllFromIndex(STORE, 'by-entity', entity)
}
