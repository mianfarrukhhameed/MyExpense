export const STORE_EXPENSES = 'expenses'
export const STORE_PROFILE = 'profile'
export const STORE_SYNC_QUEUE = 'sync_queue'
export const STORE_RECEIPT_BLOBS = 'receipt_blobs'

export type StoreName =
  | typeof STORE_EXPENSES
  | typeof STORE_PROFILE
  | typeof STORE_SYNC_QUEUE
  | typeof STORE_RECEIPT_BLOBS
