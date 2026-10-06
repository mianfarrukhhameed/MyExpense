import type { SyncStatus } from './expense'

export interface Profile {
  id: string
  monthly_budget: number
  currency: string
  updated_at: string
  sync_status: SyncStatus
}
