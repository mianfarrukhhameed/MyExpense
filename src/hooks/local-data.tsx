import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Expense, ExpenseCategory } from '../core/types/expense'
import type { Profile } from '../core/types/profile'
import { toDateKey } from '../core/utils/date'
import {
  countExpenses,
  getExpenseById,
  listExpenses,
  removeExpense,
  upsertExpense,
} from '../db/expenses.repo'
import {
  deleteReceiptBlob,
  putReceiptBlob,
} from '../db/receipts.repo'
import {
  getProfile,
  updateMonthlyBudget,
  upsertProfile,
} from '../db/profile.repo'
import { DATA_SYNCED_EVENT } from '../db/sync-meta'
import {
  countPendingSyncItems,
  enqueueSyncItem,
} from '../db/sync-queue.repo'
import { compressImage } from '../services/storage/receipts'
import { flushQueue } from '../services/sync/sync-engine'

export interface AddExpenseInput {
  amount: number
  category: ExpenseCategory | string
  description?: string | null
  date?: string
  receiptFile?: File | Blob | null
}

export interface UpdateExpenseInput {
  amount: number
  category: ExpenseCategory | string
  description?: string | null
  date: string
  receiptFile?: File | Blob | null
  clearReceipt?: boolean
}

interface LocalDataContextValue {
  expenses: Expense[]
  count: number
  profile: Profile | null
  pendingSyncCount: number
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  addExpense: (input: AddExpenseInput) => Promise<Expense>
  updateExpense: (id: string, input: UpdateExpenseInput) => Promise<Expense>
  deleteExpense: (id: string) => Promise<void>
  setBudget: (amount: number) => Promise<Profile>
  setCurrency: (currency: string) => Promise<Profile>
}

const LocalDataContext = createContext<LocalDataContextValue | null>(null)

async function storeReceiptBlob(
  expenseId: string,
  file: File | Blob,
): Promise<string> {
  const compressed = await compressImage(file)
  const blobKey = expenseId
  await putReceiptBlob(blobKey, compressed)
  return blobKey
}

async function enqueueReceiptUpload(expenseId: string, blobKey: string) {
  await enqueueSyncItem({
    entity: 'receipt',
    operation: 'create',
    payload: { expenseId, blobKey },
  })
}

export function LocalDataProvider({ children }: { children: ReactNode }) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [count, setCount] = useState(0)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [items, total, localProfile, pending] = await Promise.all([
        listExpenses(),
        countExpenses(),
        getProfile(),
        countPendingSyncItems(),
      ])
      setExpenses(items)
      setCount(total)
      setProfile(localProfile)
      setPendingSyncCount(pending)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load local data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onSynced = () => {
      void refresh()
    }
    window.addEventListener(DATA_SYNCED_EVENT, onSynced)
    return () => window.removeEventListener(DATA_SYNCED_EVENT, onSynced)
  }, [refresh])

  const addExpense = useCallback(
    async (input: AddExpenseInput) => {
      const currentProfile = await getProfile()
      const now = new Date().toISOString()
      const id = crypto.randomUUID()

      let localReceiptKey: string | null = null
      if (input.receiptFile) {
        localReceiptKey = await storeReceiptBlob(id, input.receiptFile)
      }

      const expense: Expense = {
        id,
        user_id: currentProfile.id,
        amount: input.amount,
        category: input.category,
        description: input.description ?? null,
        date: input.date ?? toDateKey(),
        receipt_url: null,
        local_receipt_blob_key: localReceiptKey,
        created_at: now,
        updated_at: now,
        sync_status: 'pending',
      }

      await upsertExpense(expense)
      await enqueueSyncItem({
        entity: 'expense',
        operation: 'create',
        payload: expense,
      })
      if (localReceiptKey) {
        await enqueueReceiptUpload(id, localReceiptKey)
      }
      await refresh()
      if (navigator.onLine) void flushQueue()
      return expense
    },
    [refresh],
  )

  const updateExpense = useCallback(
    async (id: string, input: UpdateExpenseInput) => {
      const existing = await getExpenseById(id)
      if (!existing) throw new Error('Expense not found')

      let localReceiptKey = existing.local_receipt_blob_key ?? null
      let receiptUrl = existing.receipt_url

      if (input.clearReceipt) {
        if (localReceiptKey) await deleteReceiptBlob(localReceiptKey)
        localReceiptKey = null
        receiptUrl = null
      }

      let newReceipt = false
      if (input.receiptFile) {
        if (localReceiptKey) await deleteReceiptBlob(localReceiptKey)
        localReceiptKey = await storeReceiptBlob(id, input.receiptFile)
        receiptUrl = null
        newReceipt = true
      }

      const expense: Expense = {
        ...existing,
        amount: input.amount,
        category: input.category,
        description: input.description ?? null,
        date: input.date,
        receipt_url: receiptUrl,
        local_receipt_blob_key: localReceiptKey,
        updated_at: new Date().toISOString(),
        sync_status: 'pending',
      }

      await upsertExpense(expense)
      await enqueueSyncItem({
        entity: 'expense',
        operation: 'update',
        payload: expense,
      })
      if (newReceipt && localReceiptKey) {
        await enqueueReceiptUpload(id, localReceiptKey)
      }
      await refresh()
      if (navigator.onLine) void flushQueue()
      return expense
    },
    [refresh],
  )

  const deleteExpense = useCallback(
    async (id: string) => {
      const existing = await getExpenseById(id)
      if (existing?.local_receipt_blob_key) {
        await deleteReceiptBlob(existing.local_receipt_blob_key)
      }
      await removeExpense(id)
      await enqueueSyncItem({
        entity: 'expense',
        operation: 'delete',
        payload: { id, receipt_url: existing?.receipt_url ?? null },
      })
      await refresh()
      if (navigator.onLine) void flushQueue()
    },
    [refresh],
  )

  const setBudget = useCallback(
    async (amount: number) => {
      const updated = await updateMonthlyBudget(amount)
      await enqueueSyncItem({
        entity: 'profile',
        operation: 'update',
        payload: updated,
      })
      await refresh()
      if (navigator.onLine) void flushQueue()
      return updated
    },
    [refresh],
  )

  const setCurrency = useCallback(
    async (currency: string) => {
      const current = await getProfile()
      const updated = await upsertProfile({
        ...current,
        currency,
        updated_at: new Date().toISOString(),
        sync_status: 'pending',
      })
      await enqueueSyncItem({
        entity: 'profile',
        operation: 'update',
        payload: updated,
      })
      await refresh()
      if (navigator.onLine) void flushQueue()
      return updated
    },
    [refresh],
  )

  const value = useMemo(
    () => ({
      expenses,
      count,
      profile,
      pendingSyncCount,
      loading,
      error,
      refresh,
      addExpense,
      updateExpense,
      deleteExpense,
      setBudget,
      setCurrency,
    }),
    [
      expenses,
      count,
      profile,
      pendingSyncCount,
      loading,
      error,
      refresh,
      addExpense,
      updateExpense,
      deleteExpense,
      setBudget,
      setCurrency,
    ],
  )

  return (
    <LocalDataContext.Provider value={value}>{children}</LocalDataContext.Provider>
  )
}

function useLocalData(): LocalDataContextValue {
  const ctx = useContext(LocalDataContext)
  if (!ctx) {
    throw new Error('useLocalData must be used within LocalDataProvider')
  }
  return ctx
}

/** Shared context so every tab sees the same IndexedDB state. */
export function useExpenses() {
  const {
    expenses,
    count,
    loading,
    error,
    refresh,
    addExpense,
    updateExpense,
    deleteExpense,
  } = useLocalData()

  return {
    expenses,
    count,
    loading,
    error,
    refresh,
    addExpense,
    updateExpense,
    deleteExpense,
  }
}

export function useProfile() {
  const {
    profile,
    pendingSyncCount,
    loading,
    error,
    refresh,
    setBudget,
    setCurrency,
  } = useLocalData()

  return {
    profile,
    pendingSyncCount,
    loading,
    error,
    refresh,
    setBudget,
    setCurrency,
  }
}
