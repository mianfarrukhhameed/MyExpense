import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { DB_NAME, DB_VERSION } from '../core/config/app.config'
import type { Expense } from '../core/types/expense'
import type { Loan } from '../core/types/loan'
import type { MonthBudget } from '../core/types/month-budget'
import type { PlanExpense } from '../core/types/plan'
import type { Profile } from '../core/types/profile'
import type { SyncQueueItem } from '../core/types/sync'
import {
  STORE_EXPENSES,
  STORE_LOANS,
  STORE_MONTH_BUDGETS,
  STORE_PLANS,
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
  [STORE_PLANS]: {
    key: string
    value: PlanExpense
    indexes: {
      'by-due-date': string
      'by-status': string
    }
  }
  [STORE_LOANS]: {
    key: string
    value: Loan
    indexes: {
      'by-direction': string
      'by-due-date': string
    }
  }
  [STORE_MONTH_BUDGETS]: {
    key: string
    value: MonthBudget
    indexes: {
      'by-month-key': string
    }
  }
}

let dbPromise: Promise<IDBPDatabase<MyExpenseDB>> | null = null

export function getDb(): Promise<IDBPDatabase<MyExpenseDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MyExpenseDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_EXPENSES)) {
          const expenses = db.createObjectStore(STORE_EXPENSES, {
            keyPath: 'id',
          })
          expenses.createIndex('by-date', 'date')
          expenses.createIndex('by-sync-status', 'sync_status')
        }

        if (!db.objectStoreNames.contains(STORE_PROFILE)) {
          db.createObjectStore(STORE_PROFILE, { keyPath: 'id' })
        }

        if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
          const queue = db.createObjectStore(STORE_SYNC_QUEUE, {
            keyPath: 'id',
          })
          queue.createIndex('by-created-at', 'created_at')
        }

        if (!db.objectStoreNames.contains(STORE_RECEIPT_BLOBS)) {
          db.createObjectStore(STORE_RECEIPT_BLOBS)
        }

        if (!db.objectStoreNames.contains(STORE_PLANS)) {
          const plans = db.createObjectStore(STORE_PLANS, { keyPath: 'id' })
          plans.createIndex('by-due-date', 'due_date')
          plans.createIndex('by-status', 'status')
        }

        if (!db.objectStoreNames.contains(STORE_LOANS)) {
          const loans = db.createObjectStore(STORE_LOANS, { keyPath: 'id' })
          loans.createIndex('by-direction', 'direction')
          loans.createIndex('by-due-date', 'due_date')
        }

        if (!db.objectStoreNames.contains(STORE_MONTH_BUDGETS)) {
          const budgets = db.createObjectStore(STORE_MONTH_BUDGETS, {
            keyPath: 'id',
          })
          budgets.createIndex('by-month-key', 'month_key')
        }
      },
    })
  }

  return dbPromise
}
