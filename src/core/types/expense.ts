export type ExpenseCategory =
  | 'Food'
  | 'Travel'
  | 'Rent'
  | 'Utilities'
  | 'Entertainment'
  | 'Grocery'
  | 'Kids'
  | 'Kids School'
  | 'Clothing'
  | 'Medical'
  | 'Services'
  | 'Pocket Money'
  | 'Loan Return'
  | 'Other'

export type SyncStatus = 'synced' | 'pending' | 'error'

export interface Expense {
  id: string
  user_id: string | null
  amount: number
  category: ExpenseCategory | string
  description: string | null
  date: string
  receipt_url: string | null
  local_receipt_blob_key?: string | null
  created_at: string
  updated_at: string
  sync_status: SyncStatus
}
