import type { SyncStatus } from './expense'

export interface MonthBudget {
  id: string
  user_id: string | null
  month_key: string
  amount: number
  updated_at: string
  sync_status: SyncStatus
}
