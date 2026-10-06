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
  listExpenses,
  removeExpense,
  upsertExpense,
} from '../db/expenses.repo'
import {
  getProfile,
  updateMonthlyBudget,
  upsertProfile,
} from '../db/profile.repo'
import {
  countPendingSyncItems,
  enqueueSyncItem,
} from '../db/sync-queue.repo'
import { flushQueue } from '../services/sync/sync-engine'

export interface AddExpenseInput {
  amount: number
  category: ExpenseCategory | string
  description?: string | null
  date?: string
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
  deleteExpense: (id: string) => Promise<void>
  setBudget: (amount: number) => Promise<Profile>
  setCurrency: (currency: string) => Promise<Profile>
}

const LocalDataContext = createContext<LocalDataContextValue | null>(null)

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

  const addExpense = useCallback(
    async (input: AddExpenseInput) => {
      const currentProfile = await getProfile()
      const now = new Date().toISOString()
      const expense: Expense = {
        id: crypto.randomUUID(),
        user_id: currentProfile.id,
        amount: input.amount,
        category: input.category,
        description: input.description ?? null,
        date: input.date ?? toDateKey(),
        receipt_url: null,
        local_receipt_blob_key: null,
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
      await refresh()
      if (navigator.onLine) void flushQueue()
      return expense
    },
    [refresh],
  )

  const deleteExpense = useCallback(
    async (id: string) => {
      await removeExpense(id)
      await enqueueSyncItem({
        entity: 'expense',
        operation: 'delete',
        payload: { id },
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

/** Phase 1 hook API — shared context so every tab sees the same IndexedDB state. */
export function useExpenses() {
  const {
    expenses,
    count,
    loading,
    error,
    refresh,
    addExpense,
    deleteExpense,
  } = useLocalData()

  return {
    expenses,
    count,
    loading,
    error,
    refresh,
    addExpense,
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
