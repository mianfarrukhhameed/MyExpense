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
import type { Loan, LoanDirection } from '../core/types/loan'
import type { MonthBudget } from '../core/types/month-budget'
import type { PlanExpense, PlanRecurrence } from '../core/types/plan'
import type { Profile } from '../core/types/profile'
import { nextMonthlyDueDate, toDateKey } from '../core/utils/date'
import {
  countExpenses,
  getExpenseById,
  listExpenses,
  removeExpense,
  upsertExpense,
} from '../db/expenses.repo'
import {
  getLoanById,
  listLoans,
  removeLoan,
  upsertLoan,
} from '../db/loans.repo'
import {
  getMonthBudget,
  listMonthBudgets,
  monthBudgetId,
  upsertMonthBudget,
} from '../db/month-budgets.repo'
import {
  getPlanById,
  listPlans,
  removePlan,
  upsertPlan,
} from '../db/plans.repo'
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

export interface AddPlanInput {
  amount: number
  category: string
  description?: string | null
  due_date: string
  recurrence: PlanRecurrence
  day_of_month?: number | null
}

export interface UpdatePlanInput {
  amount: number
  category: string
  description?: string | null
  due_date: string
  recurrence: PlanRecurrence
  day_of_month?: number | null
}

export interface AddLoanInput {
  person: string
  amount: number
  direction: LoanDirection
  loan_date: string
  due_date: string
  description?: string | null
}

export interface UpdateLoanInput {
  person: string
  amount: number
  remaining: number
  direction: LoanDirection
  loan_date: string
  due_date: string
  description?: string | null
}

interface LocalDataContextValue {
  expenses: Expense[]
  plans: PlanExpense[]
  loans: Loan[]
  monthBudgets: MonthBudget[]
  count: number
  profile: Profile | null
  pendingSyncCount: number
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  addExpense: (input: AddExpenseInput) => Promise<Expense>
  updateExpense: (id: string, input: UpdateExpenseInput) => Promise<Expense>
  deleteExpense: (id: string) => Promise<void>
  addPlan: (input: AddPlanInput) => Promise<PlanExpense>
  updatePlan: (id: string, input: UpdatePlanInput) => Promise<PlanExpense>
  deletePlan: (id: string) => Promise<void>
  markPlanPaid: (id: string, paidDate?: string) => Promise<Expense>
  addLoan: (input: AddLoanInput) => Promise<Loan>
  updateLoan: (id: string, input: UpdateLoanInput) => Promise<Loan>
  deleteLoan: (id: string) => Promise<void>
  recordLoanPayment: (
    id: string,
    amount: number,
    paidDate?: string,
  ) => Promise<Expense>
  setBudget: (amount: number) => Promise<Profile>
  setMonthBudget: (monthKey: string, amount: number) => Promise<MonthBudget>
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
  const [plans, setPlans] = useState<PlanExpense[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [monthBudgets, setMonthBudgets] = useState<MonthBudget[]>([])
  const [count, setCount] = useState(0)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [
        items,
        total,
        localProfile,
        pending,
        planItems,
        loanItems,
        budgetItems,
      ] = await Promise.all([
        listExpenses(),
        countExpenses(),
        getProfile(),
        countPendingSyncItems(),
        listPlans(),
        listLoans(),
        listMonthBudgets(),
      ])
      setExpenses(items)
      setCount(total)
      setProfile(localProfile)
      setPendingSyncCount(pending)
      setPlans(planItems)
      setLoans(loanItems)
      setMonthBudgets(budgetItems)
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

  const addPlan = useCallback(
    async (input: AddPlanInput) => {
      const currentProfile = await getProfile()
      const now = new Date().toISOString()
      const day =
        input.recurrence === 'monthly'
          ? (input.day_of_month ?? Number(input.due_date.slice(8, 10)))
          : null

      const plan: PlanExpense = {
        id: crypto.randomUUID(),
        user_id: currentProfile.id,
        amount: input.amount,
        category: input.category,
        description: input.description ?? null,
        due_date: input.due_date,
        recurrence: input.recurrence,
        day_of_month: day,
        status: 'upcoming',
        created_at: now,
        updated_at: now,
        sync_status: 'pending',
      }

      await upsertPlan(plan)
      await enqueueSyncItem({
        entity: 'plan',
        operation: 'create',
        payload: plan,
      })
      await refresh()
      if (navigator.onLine) void flushQueue()
      return plan
    },
    [refresh],
  )

  const updatePlan = useCallback(
    async (id: string, input: UpdatePlanInput) => {
      const existing = await getPlanById(id)
      if (!existing) throw new Error('Plan not found')

      const day =
        input.recurrence === 'monthly'
          ? (input.day_of_month ?? Number(input.due_date.slice(8, 10)))
          : null

      const plan: PlanExpense = {
        ...existing,
        amount: input.amount,
        category: input.category,
        description: input.description ?? null,
        due_date: input.due_date,
        recurrence: input.recurrence,
        day_of_month: day,
        updated_at: new Date().toISOString(),
        sync_status: 'pending',
      }

      await upsertPlan(plan)
      await enqueueSyncItem({
        entity: 'plan',
        operation: 'update',
        payload: plan,
      })
      await refresh()
      if (navigator.onLine) void flushQueue()
      return plan
    },
    [refresh],
  )

  const deletePlan = useCallback(
    async (id: string) => {
      await removePlan(id)
      await enqueueSyncItem({
        entity: 'plan',
        operation: 'delete',
        payload: { id },
      })
      await refresh()
      if (navigator.onLine) void flushQueue()
    },
    [refresh],
  )

  const markPlanPaid = useCallback(
    async (id: string, paidDate?: string) => {
      const plan = await getPlanById(id)
      if (!plan) throw new Error('Plan not found')
      if (plan.status !== 'upcoming') throw new Error('Plan already paid')

      const date = paidDate ?? toDateKey()
      const expense = await addExpense({
        amount: plan.amount,
        category: plan.category,
        description: plan.description ?? `Paid: ${plan.category}`,
        date,
      })

      const now = new Date().toISOString()
      if (plan.recurrence === 'monthly' && plan.day_of_month) {
        const nextDue = nextMonthlyDueDate(plan.due_date, plan.day_of_month)
        const updated: PlanExpense = {
          ...plan,
          due_date: nextDue,
          updated_at: now,
          sync_status: 'pending',
        }
        await upsertPlan(updated)
        await enqueueSyncItem({
          entity: 'plan',
          operation: 'update',
          payload: updated,
        })
      } else {
        const updated: PlanExpense = {
          ...plan,
          status: 'paid',
          updated_at: now,
          sync_status: 'pending',
        }
        await upsertPlan(updated)
        await enqueueSyncItem({
          entity: 'plan',
          operation: 'update',
          payload: updated,
        })
      }

      await refresh()
      if (navigator.onLine) void flushQueue()
      return expense
    },
    [addExpense, refresh],
  )

  const addLoan = useCallback(
    async (input: AddLoanInput) => {
      const currentProfile = await getProfile()
      const now = new Date().toISOString()

      const loan: Loan = {
        id: crypto.randomUUID(),
        user_id: currentProfile.id,
        person: input.person.trim(),
        amount: input.amount,
        remaining: input.amount,
        direction: input.direction,
        loan_date: input.loan_date,
        due_date: input.due_date,
        description: input.description ?? null,
        created_at: now,
        updated_at: now,
        sync_status: 'pending',
      }

      await upsertLoan(loan)
      await enqueueSyncItem({
        entity: 'loan',
        operation: 'create',
        payload: loan,
      })
      await refresh()
      if (navigator.onLine) void flushQueue()
      return loan
    },
    [refresh],
  )

  const updateLoan = useCallback(
    async (id: string, input: UpdateLoanInput) => {
      const existing = await getLoanById(id)
      if (!existing) throw new Error('Loan not found')

      const loan: Loan = {
        ...existing,
        person: input.person.trim(),
        amount: input.amount,
        remaining: input.remaining,
        direction: input.direction,
        loan_date: input.loan_date,
        due_date: input.due_date,
        description: input.description ?? null,
        updated_at: new Date().toISOString(),
        sync_status: 'pending',
      }

      await upsertLoan(loan)
      await enqueueSyncItem({
        entity: 'loan',
        operation: 'update',
        payload: loan,
      })
      await refresh()
      if (navigator.onLine) void flushQueue()
      return loan
    },
    [refresh],
  )

  const deleteLoan = useCallback(
    async (id: string) => {
      await removeLoan(id)
      await enqueueSyncItem({
        entity: 'loan',
        operation: 'delete',
        payload: { id },
      })
      await refresh()
      if (navigator.onLine) void flushQueue()
    },
    [refresh],
  )

  const recordLoanPayment = useCallback(
    async (id: string, amount: number, paidDate?: string) => {
      const loan = await getLoanById(id)
      if (!loan) throw new Error('Loan not found')
      if (amount <= 0) throw new Error('Payment must be greater than 0')
      if (amount > loan.remaining) {
        throw new Error('Payment exceeds remaining balance')
      }

      const date = paidDate ?? toDateKey()
      const label =
        loan.direction === 'borrowed'
          ? `Loan repayment to ${loan.person}`
          : `Loan received from ${loan.person}`

      const expense = await addExpense({
        amount,
        category: 'Loan Return',
        description: label,
        date,
      })

      const remaining = Math.max(0, Number(loan.remaining) - amount)
      const updated: Loan = {
        ...loan,
        remaining,
        updated_at: new Date().toISOString(),
        sync_status: 'pending',
      }
      await upsertLoan(updated)
      await enqueueSyncItem({
        entity: 'loan',
        operation: 'update',
        payload: updated,
      })

      await refresh()
      if (navigator.onLine) void flushQueue()
      return expense
    },
    [addExpense, refresh],
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

  const setMonthBudget = useCallback(
    async (monthKey: string, amount: number) => {
      const currentProfile = await getProfile()
      const existing = await getMonthBudget(monthKey)
      const budget: MonthBudget = {
        id: existing?.id ?? monthBudgetId(currentProfile.id, monthKey),
        user_id: currentProfile.id,
        month_key: monthKey,
        amount,
        updated_at: new Date().toISOString(),
        sync_status: 'pending',
      }
      await upsertMonthBudget(budget)
      await enqueueSyncItem({
        entity: 'month_budget',
        operation: existing ? 'update' : 'create',
        payload: budget,
      })
      await refresh()
      if (navigator.onLine) void flushQueue()
      return budget
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
      plans,
      loans,
      monthBudgets,
      count,
      profile,
      pendingSyncCount,
      loading,
      error,
      refresh,
      addExpense,
      updateExpense,
      deleteExpense,
      addPlan,
      updatePlan,
      deletePlan,
      markPlanPaid,
      addLoan,
      updateLoan,
      deleteLoan,
      recordLoanPayment,
      setBudget,
      setMonthBudget,
      setCurrency,
    }),
    [
      expenses,
      plans,
      loans,
      monthBudgets,
      count,
      profile,
      pendingSyncCount,
      loading,
      error,
      refresh,
      addExpense,
      updateExpense,
      deleteExpense,
      addPlan,
      updatePlan,
      deletePlan,
      markPlanPaid,
      addLoan,
      updateLoan,
      deleteLoan,
      recordLoanPayment,
      setBudget,
      setMonthBudget,
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

export function usePlans() {
  const {
    plans,
    loading,
    error,
    refresh,
    addPlan,
    updatePlan,
    deletePlan,
    markPlanPaid,
  } = useLocalData()

  return {
    plans,
    loading,
    error,
    refresh,
    addPlan,
    updatePlan,
    deletePlan,
    markPlanPaid,
  }
}

export function useLoans() {
  const {
    loans,
    loading,
    error,
    refresh,
    addLoan,
    updateLoan,
    deleteLoan,
    recordLoanPayment,
  } = useLocalData()

  return {
    loans,
    loading,
    error,
    refresh,
    addLoan,
    updateLoan,
    deleteLoan,
    recordLoanPayment,
  }
}

export function useProfile() {
  const {
    profile,
    monthBudgets,
    pendingSyncCount,
    loading,
    error,
    refresh,
    setBudget,
    setMonthBudget,
    setCurrency,
  } = useLocalData()

  return {
    profile,
    monthBudgets,
    pendingSyncCount,
    loading,
    error,
    refresh,
    setBudget,
    setMonthBudget,
    setCurrency,
  }
}
