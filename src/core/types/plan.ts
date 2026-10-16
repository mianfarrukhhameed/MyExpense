import type { SyncStatus } from './expense'

export type PlanRecurrence = 'none' | 'monthly'

export type PlanStatus = 'upcoming' | 'paid'

export interface PlanExpense {
  id: string
  user_id: string | null
  amount: number
  category: string
  description: string | null
  due_date: string
  recurrence: PlanRecurrence
  day_of_month: number | null
  status: PlanStatus
  created_at: string
  updated_at: string
  sync_status: SyncStatus
}
