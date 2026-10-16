export const STORE_EXPENSES = 'expenses'
export const STORE_PROFILE = 'profile'
export const STORE_SYNC_QUEUE = 'sync_queue'
export const STORE_RECEIPT_BLOBS = 'receipt_blobs'
export const STORE_PLANS = 'plans'
export const STORE_LOANS = 'loans'
export const STORE_MONTH_BUDGETS = 'month_budgets'

export type StoreName =
  | typeof STORE_EXPENSES
  | typeof STORE_PROFILE
  | typeof STORE_SYNC_QUEUE
  | typeof STORE_RECEIPT_BLOBS
  | typeof STORE_PLANS
  | typeof STORE_LOANS
  | typeof STORE_MONTH_BUDGETS
