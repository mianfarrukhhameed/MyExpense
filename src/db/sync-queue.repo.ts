import type { SyncQueueItem } from '../core/types/sync'
import { getDb } from './index'
import { STORE_SYNC_QUEUE } from './schema'

export async function enqueueSyncItem(
  item: Omit<SyncQueueItem, 'id' | 'created_at' | 'attempts'> &
    Partial<Pick<SyncQueueItem, 'id' | 'created_at' | 'attempts'>>,
): Promise<SyncQueueItem> {
  const db = await getDb()
  const record: SyncQueueItem = {
    id: item.id ?? crypto.randomUUID(),
    entity: item.entity,
    operation: item.operation,
    payload: item.payload,
    created_at: item.created_at ?? new Date().toISOString(),
    attempts: item.attempts ?? 0,
  }
  await db.put(STORE_SYNC_QUEUE, record)
  return record
}

export async function listPendingSyncItems(): Promise<SyncQueueItem[]> {
  const db = await getDb()
  const all = await db.getAll(STORE_SYNC_QUEUE)
  return all.sort((a, b) => a.created_at.localeCompare(b.created_at))
}

export async function countPendingSyncItems(): Promise<number> {
  const db = await getDb()
  return db.count(STORE_SYNC_QUEUE)
}

export async function removeSyncItem(id: string): Promise<void> {
  const db = await getDb()
  await db.delete(STORE_SYNC_QUEUE, id)
}

export async function clearSyncQueue(): Promise<void> {
  const db = await getDb()
  await db.clear(STORE_SYNC_QUEUE)
}
