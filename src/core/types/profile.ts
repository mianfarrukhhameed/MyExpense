import type { SyncStatus } from './expense'

export interface Profile {
  id: string
  monthly_budget: number
  currency: string
  fcm_token?: string | null
  updated_at: string
  sync_status: SyncStatus
}
