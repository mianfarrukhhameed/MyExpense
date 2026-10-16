import type { Expense } from '../../core/types/expense'
import type { Loan } from '../../core/types/loan'
import type { MonthBudget } from '../../core/types/month-budget'
import type { PlanExpense } from '../../core/types/plan'
import { isExpensesStoreEmpty, upsertExpense } from '../../db/expenses.repo'
import { getDb } from '../../db/index'
import { upsertLoan } from '../../db/loans.repo'
import { upsertMonthBudget } from '../../db/month-budgets.repo'
import { upsertPlan } from '../../db/plans.repo'
import { upsertProfile } from '../../db/profile.repo'
import {
  STORE_EXPENSES,
  STORE_LOANS,
  STORE_MONTH_BUDGETS,
  STORE_PLANS,
} from '../../db/schema'
import { setLastPullAt, setLastSyncAt } from '../../db/sync-meta'
import { getUser } from '../../lib/supabase/auth'
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase/client'

type RemoteExpense = {
  id: string
  user_id: string
  amount: number
  category: string
  description: string | null
  date: string
  receipt_url: string | null
  created_at: string
  updated_at: string
}

type RemoteProfile = {
  id: string
  monthly_budget: number
  currency: string
  fcm_token?: string | null
  updated_at: string
}

type RemotePlan = {
  id: string
  user_id: string
  amount: number
  category: string
  description: string | null
  due_date: string
  recurrence: 'none' | 'monthly'
  day_of_month: number | null
  status: 'upcoming' | 'paid'
  created_at: string
  updated_at: string
}

type RemoteLoan = {
  id: string
  user_id: string
  person: string
  amount: number
  remaining: number
  direction: 'borrowed' | 'lent'
  loan_date: string
  due_date: string
  description: string | null
  created_at: string
  updated_at: string
}

type RemoteMonthBudget = {
  id: string
  user_id: string
  month_key: string
  amount: number
  updated_at: string
}

async function pullRemoteWorkspace(userId: string): Promise<number> {
  const supabase = getSupabase()

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (profileError) throw profileError

  if (profile) {
    const remote = profile as RemoteProfile
    await upsertProfile({
      id: remote.id,
      monthly_budget: Number(remote.monthly_budget),
      currency: remote.currency,
      fcm_token: remote.fcm_token ?? null,
      updated_at: remote.updated_at,
      sync_status: 'synced',
    })
  }

  let count = 0

  const { data: expenses, error: expenseError } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })

  if (expenseError) throw expenseError

  for (const row of (expenses ?? []) as RemoteExpense[]) {
    const local: Expense = {
      id: row.id,
      user_id: row.user_id,
      amount: Number(row.amount),
      category: row.category,
      description: row.description,
      date: row.date,
      receipt_url: row.receipt_url,
      local_receipt_blob_key: null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      sync_status: 'synced',
    }
    await upsertExpense(local)
    count += 1
  }

  const { data: plans, error: planError } = await supabase
    .from('plans')
    .select('*')
    .eq('user_id', userId)

  if (planError) throw planError

  for (const row of (plans ?? []) as RemotePlan[]) {
    const local: PlanExpense = {
      id: row.id,
      user_id: row.user_id,
      amount: Number(row.amount),
      category: row.category,
      description: row.description,
      due_date: row.due_date,
      recurrence: row.recurrence,
      day_of_month: row.day_of_month,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      sync_status: 'synced',
    }
    await upsertPlan(local)
    count += 1
  }

  const { data: loans, error: loanError } = await supabase
    .from('loans')
    .select('*')
    .eq('user_id', userId)

  if (loanError) throw loanError

  for (const row of (loans ?? []) as RemoteLoan[]) {
    const local: Loan = {
      id: row.id,
      user_id: row.user_id,
      person: row.person,
      amount: Number(row.amount),
      remaining: Number(row.remaining),
      direction: row.direction,
      loan_date: row.loan_date,
      due_date: row.due_date,
      description: row.description,
      created_at: row.created_at,
      updated_at: row.updated_at,
      sync_status: 'synced',
    }
    await upsertLoan(local)
    count += 1
  }

  const { data: monthBudgets, error: budgetError } = await supabase
    .from('month_budgets')
    .select('*')
    .eq('user_id', userId)

  if (budgetError) throw budgetError

  for (const row of (monthBudgets ?? []) as RemoteMonthBudget[]) {
    const local: MonthBudget = {
      id: row.id,
      user_id: row.user_id,
      month_key: row.month_key,
      amount: Number(row.amount),
      updated_at: row.updated_at,
      sync_status: 'synced',
    }
    await upsertMonthBudget(local)
    count += 1
  }

  const now = new Date().toISOString()
  setLastPullAt(now)
  setLastSyncAt(now)
  return count
}

/**
 * If IndexedDB expenses are empty but the user has an active session,
 * pull historical data and hydrate local stores.
 */
export async function hydrateFromRemoteIfEmpty(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false

  const user = await getUser()
  if (!user) return false

  const empty = await isExpensesStoreEmpty()
  if (!empty) return false

  await pullRemoteWorkspace(user.id)
  return true
}

/**
 * Replace local money stores with the signed-in user's remote workspace
 * (used after account switch / fresh bind).
 */
export async function hydrateFromRemote(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false

  const user = await getUser()
  if (!user) return false

  const db = await getDb()
  await Promise.all([
    db.clear(STORE_EXPENSES),
    db.clear(STORE_PLANS),
    db.clear(STORE_LOANS),
    db.clear(STORE_MONTH_BUDGETS),
  ])
  await pullRemoteWorkspace(user.id)
  return true
}
