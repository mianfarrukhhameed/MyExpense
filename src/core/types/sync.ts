export type SyncOperation = 'create' | 'update' | 'delete'
export type SyncEntity = 'expense' | 'profile' | 'receipt'

export interface SyncQueueItem {
  id: string
  entity: SyncEntity
  operation: SyncOperation
  payload: unknown
  created_at: string
  attempts: number
}
