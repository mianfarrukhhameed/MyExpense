import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { DB_NAME, DB_VERSION } from '../core/config/app.config'
import type { Expense } from '../core/types/expense'
import type { Profile } from '../core/types/profile'
import type { SyncQueueItem } from '../core/types/sync'
import {
  STORE_EXPENSES,
  STORE_PROFILE,
  STORE_RECEIPT_BLOBS,
  STORE_SYNC_QUEUE,
} from './schema'

export interface MyExpenseDB extends DBSchema {
  [STORE_EXPENSES]: {
    key: string
    value: Expense
    indexes: {
      'by-date': string
      'by-sync-status': string
    }
  }
  [STORE_PROFILE]: {
    key: string
    value: Profile
  }
  [STORE_SYNC_QUEUE]: {
    key: string
    value: SyncQueueItem
    indexes: {
      'by-created-at': string
    }
  }
  [STORE_RECEIPT_BLOBS]: {
    key: string
    value: Blob
  }
}

let dbPromise: Promise<IDBPDatabase<MyExpenseDB>> | null = null

export function getDb(): Promise<IDBPDatabase<MyExpenseDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MyExpenseDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_EXPENSES)) {
          const expenses = db.createObjectStore(STORE_EXPENSES, { keyPath: 'id' })
          expenses.createIndex('by-date', 'date')
          expenses.createIndex('by-sync-status', 'sync_status')
        }

        if (!db.objectStoreNames.contains(STORE_PROFILE)) {
          db.createObjectStore(STORE_PROFILE, { keyPath: 'id' })
        }

        if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
          const queue = db.createObjectStore(STORE_SYNC_QUEUE, { keyPath: 'id' })
          queue.createIndex('by-created-at', 'created_at')
        }

        if (!db.objectStoreNames.contains(STORE_RECEIPT_BLOBS)) {
          db.createObjectStore(STORE_RECEIPT_BLOBS)
        }
      },
    })
  }

  return dbPromise
}
