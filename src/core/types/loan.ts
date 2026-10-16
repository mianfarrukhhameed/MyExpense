import type { SyncStatus } from './expense'

export type LoanDirection = 'borrowed' | 'lent'

export interface Loan {
  id: string
  user_id: string | null
  person: string
  amount: number
  remaining: number
  direction: LoanDirection
  loan_date: string
  due_date: string
  description: string | null
  created_at: string
  updated_at: string
  sync_status: SyncStatus
}
