import {
  DEFAULT_CURRENCY,
  DEFAULT_MONTHLY_BUDGET,
} from '../../core/config/app.config'
import type { Expense } from '../../core/types/expense'
import type { Loan } from '../../core/types/loan'
import type { MonthBudget } from '../../core/types/month-budget'
import type { PlanExpense } from '../../core/types/plan'
import type { Profile } from '../../core/types/profile'
import {
  getExpenseById,
  listExpenses,
  removeExpense,
  upsertExpense,
} from '../../db/expenses.repo'
import {
  getLoanById,
  listLoans,
  removeLoan,
  upsertLoan,
} from '../../db/loans.repo'
import {
  getMonthBudgetById,
  listMonthBudgets,
  removeMonthBudget,
  upsertMonthBudget,
} from '../../db/month-budgets.repo'
import {
  getPlanById,
  listPlans,
  removePlan,
  upsertPlan,
} from '../../db/plans.repo'
import {
  deleteReceiptBlob,
  getReceiptBlob,
} from '../../db/receipts.repo'
import { getProfile, upsertProfile } from '../../db/profile.repo'
import {
  listPendingSyncItems,
  removeSyncItem,
} from '../../db/sync-queue.repo'
import {
  getLastPullAt,
  notifyDataSynced,
  setLastPullAt,
  setLastSyncAt,
  shouldSyncOnResume,
} from '../../db/sync-meta'
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase/client'
import { getUser } from '../../lib/supabase/auth'
import { requestReplaySync } from '../pwa/replay-sync'
import { uploadReceipt } from '../storage/receipts'

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

function toRemoteExpense(expense: Expense, userId: string) {
  return {
    id: expense.id,
    user_id: userId,
    amount: expense.amount,
    category: expense.category,
    description: expense.description,
    date: expense.date,
    receipt_url: expense.receipt_url,
    created_at: expense.created_at,
    updated_at: expense.updated_at,
  }
}

function fromRemoteExpense(row: RemoteExpense): Expense {
  return {
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
}

function toRemotePlan(plan: PlanExpense, userId: string): RemotePlan {
  return {
    id: plan.id,
    user_id: userId,
    amount: plan.amount,
    category: plan.category,
    description: plan.description,
    due_date: plan.due_date,
    recurrence: plan.recurrence,
    day_of_month: plan.day_of_month,
    status: plan.status,
    created_at: plan.created_at,
    updated_at: plan.updated_at,
  }
}

function fromRemotePlan(row: RemotePlan): PlanExpense {
  return {
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
}

function toRemoteLoan(loan: Loan, userId: string): RemoteLoan {
  return {
    id: loan.id,
    user_id: userId,
    person: loan.person,
    amount: loan.amount,
    remaining: loan.remaining,
    direction: loan.direction,
    loan_date: loan.loan_date,
    due_date: loan.due_date,
    description: loan.description,
    created_at: loan.created_at,
    updated_at: loan.updated_at,
  }
}

function fromRemoteLoan(row: RemoteLoan): Loan {
  return {
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
}

function toRemoteMonthBudget(
  budget: MonthBudget,
  userId: string,
): RemoteMonthBudget {
  return {
    id: budget.id,
    user_id: userId,
    month_key: budget.month_key,
    amount: budget.amount,
    updated_at: budget.updated_at,
  }
}

function fromRemoteMonthBudget(row: RemoteMonthBudget): MonthBudget {
  return {
    id: row.id,
    user_id: row.user_id,
    month_key: row.month_key,
    amount: Number(row.amount),
    updated_at: row.updated_at,
    sync_status: 'synced',
  }
}

async function flushExpenseCreateOrUpdate(
  expense: Expense,
  userId: string,
): Promise<void> {
  const payload = toRemoteExpense({ ...expense, user_id: userId }, userId)
  const { error } = await getSupabase().from('expenses').upsert(payload)
  if (error) throw error

  await upsertExpense({
    ...expense,
    user_id: userId,
    sync_status: 'synced',
  })
}

async function flushExpenseDelete(
  id: string,
  receiptUrl?: string | null,
): Promise<void> {
  const { error } = await getSupabase().from('expenses').delete().eq('id', id)
  if (error) throw error

  if (receiptUrl) {
    await getSupabase().storage.from('receipts').remove([receiptUrl])
  }

  const local = await getExpenseById(id)
  if (local) await removeExpense(id)
}

async function flushReceiptUpload(
  expenseId: string,
  blobKey: string,
  userId: string,
): Promise<void> {
  const blob = await getReceiptBlob(blobKey)
  if (!blob) return

  const path = await uploadReceipt(userId, expenseId, blob)
  const expense = await getExpenseById(expenseId)
  if (expense) {
    const updated: Expense = {
      ...expense,
      user_id: userId,
      receipt_url: path,
      local_receipt_blob_key: null,
      updated_at: new Date().toISOString(),
      sync_status: 'synced',
    }
    await upsertExpense(updated)
    const { error } = await getSupabase()
      .from('expenses')
      .upsert(toRemoteExpense(updated, userId))
    if (error) throw error
  }

  await deleteReceiptBlob(blobKey)
}

async function flushPlanCreateOrUpdate(
  plan: PlanExpense,
  userId: string,
): Promise<void> {
  const payload = toRemotePlan({ ...plan, user_id: userId }, userId)
  const { error } = await getSupabase().from('plans').upsert(payload)
  if (error) throw error
  await upsertPlan({ ...plan, user_id: userId, sync_status: 'synced' })
}

async function flushPlanDelete(id: string): Promise<void> {
  const { error } = await getSupabase().from('plans').delete().eq('id', id)
  if (error) throw error
  const local = await getPlanById(id)
  if (local) await removePlan(id)
}

async function flushLoanCreateOrUpdate(
  loan: Loan,
  userId: string,
): Promise<void> {
  const payload = toRemoteLoan({ ...loan, user_id: userId }, userId)
  const { error } = await getSupabase().from('loans').upsert(payload)
  if (error) throw error
  await upsertLoan({ ...loan, user_id: userId, sync_status: 'synced' })
}

async function flushLoanDelete(id: string): Promise<void> {
  const { error } = await getSupabase().from('loans').delete().eq('id', id)
  if (error) throw error
  const local = await getLoanById(id)
  if (local) await removeLoan(id)
}

async function flushMonthBudgetCreateOrUpdate(
  budget: MonthBudget,
  userId: string,
): Promise<void> {
  const payload = toRemoteMonthBudget({ ...budget, user_id: userId }, userId)
  const { error } = await getSupabase().from('month_budgets').upsert(payload)
  if (error) throw error
  await upsertMonthBudget({
    ...budget,
    user_id: userId,
    sync_status: 'synced',
  })
}

async function flushMonthBudgetDelete(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from('month_budgets')
    .delete()
    .eq('id', id)
  if (error) throw error
  const local = await getMonthBudgetById(id)
  if (local) await removeMonthBudget(id)
}

async function flushProfile(profile: Profile, userId: string): Promise<void> {
  const { data: remoteRow, error: readError } = await getSupabase()
    .from('profiles')
    .select('monthly_budget, currency, fcm_token, updated_at')
    .eq('id', userId)
    .maybeSingle()
  if (readError) throw readError

  if (remoteRow) {
    const remote = remoteRow as RemoteProfile
    const localIsDefault =
      Number(profile.monthly_budget) === DEFAULT_MONTHLY_BUDGET &&
      profile.currency === DEFAULT_CURRENCY
    const remoteHasSettings =
      Number(remote.monthly_budget) !== DEFAULT_MONTHLY_BUDGET ||
      remote.currency !== DEFAULT_CURRENCY
    const remoteNewer = remote.updated_at > profile.updated_at

    if (remoteNewer || (localIsDefault && remoteHasSettings)) {
      await upsertProfile({
        id: userId,
        monthly_budget: Number(remote.monthly_budget),
        currency: remote.currency,
        fcm_token: remote.fcm_token ?? profile.fcm_token ?? null,
        updated_at: remote.updated_at,
        sync_status: 'synced',
      })
      return
    }
  }

  const payload: RemoteProfile = {
    id: userId,
    monthly_budget: profile.monthly_budget,
    currency: profile.currency,
    fcm_token: profile.fcm_token ?? null,
    updated_at: profile.updated_at,
  }
  const { error } = await getSupabase().from('profiles').upsert(payload)
  if (error) throw error
  await upsertProfile({
    ...profile,
    id: userId,
    sync_status: 'synced',
  })
}

/**
 * Flush the local sync_queue to Supabase when online.
 */
export async function flushQueue(): Promise<{ flushed: number; errors: string[] }> {
  if (!isSupabaseConfigured() || !navigator.onLine) {
    return { flushed: 0, errors: [] }
  }

  const user = await getUser()
  if (!user) return { flushed: 0, errors: [] }

  const pending = await listPendingSyncItems()
  let flushed = 0
  const errors: string[] = []

  for (const item of pending) {
    try {
      if (item.entity === 'expense') {
        if (item.operation === 'delete') {
          const payload = item.payload as { id: string; receipt_url?: string | null }
          await flushExpenseDelete(payload.id, payload.receipt_url)
        } else {
          const expense = item.payload as Expense
          await flushExpenseCreateOrUpdate(expense, user.id)
        }
      } else if (item.entity === 'profile') {
        const profile = item.payload as Profile
        await flushProfile(profile, user.id)
      } else if (item.entity === 'receipt') {
        const payload = item.payload as { expenseId: string; blobKey: string }
        await flushReceiptUpload(payload.expenseId, payload.blobKey, user.id)
      } else if (item.entity === 'plan') {
        if (item.operation === 'delete') {
          const payload = item.payload as { id: string }
          await flushPlanDelete(payload.id)
        } else {
          await flushPlanCreateOrUpdate(item.payload as PlanExpense, user.id)
        }
      } else if (item.entity === 'loan') {
        if (item.operation === 'delete') {
          const payload = item.payload as { id: string }
          await flushLoanDelete(payload.id)
        } else {
          await flushLoanCreateOrUpdate(item.payload as Loan, user.id)
        }
      } else if (item.entity === 'month_budget') {
        if (item.operation === 'delete') {
          const payload = item.payload as { id: string }
          await flushMonthBudgetDelete(payload.id)
        } else {
          await flushMonthBudgetCreateOrUpdate(
            item.payload as MonthBudget,
            user.id,
          )
        }
      }
      await removeSyncItem(item.id)
      flushed += 1
    } catch (err) {
      errors.push(
        err instanceof Error ? err.message : `Failed to sync ${item.entity}`,
      )
    }
  }

  if (flushed > 0) {
    setLastSyncAt(new Date().toISOString())
  }

  if (errors.length > 0) {
    void requestReplaySync()
  }

  return { flushed, errors }
}

async function pullEntityTable<T extends { id: string; updated_at: string }>(
  table: string,
  userId: string,
  watermark: string | null,
  apply: (row: T) => Promise<boolean>,
): Promise<number> {
  const supabase = getSupabase()
  let query = supabase
    .from(table)
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: true })

  if (watermark) {
    query = query.gt('updated_at', watermark)
  }

  const { data, error } = await query
  if (error) throw error

  let pulled = 0
  for (const row of (data ?? []) as T[]) {
    if (await apply(row)) pulled += 1
  }
  return pulled
}

/**
 * Pull remote rows newer than the local watermark (last-write-wins via updated_at).
 */
export async function pullRemoteChanges(): Promise<{ pulled: number }> {
  if (!isSupabaseConfigured() || !navigator.onLine) {
    return { pulled: 0 }
  }

  const user = await getUser()
  if (!user) return { pulled: 0 }

  const supabase = getSupabase()
  const watermark = getLastPullAt()
  let pulled = 0

  pulled += await pullEntityTable<RemoteExpense>(
    'expenses',
    user.id,
    watermark,
    async (row) => {
      const local = await getExpenseById(row.id)
      if (!local || local.updated_at < row.updated_at) {
        await upsertExpense(fromRemoteExpense(row))
        return true
      }
      return false
    },
  )

  pulled += await pullEntityTable<RemotePlan>(
    'plans',
    user.id,
    watermark,
    async (row) => {
      const local = await getPlanById(row.id)
      if (!local || local.updated_at < row.updated_at) {
        await upsertPlan(fromRemotePlan(row))
        return true
      }
      return false
    },
  )

  pulled += await pullEntityTable<RemoteLoan>(
    'loans',
    user.id,
    watermark,
    async (row) => {
      const local = await getLoanById(row.id)
      if (!local || local.updated_at < row.updated_at) {
        await upsertLoan(fromRemoteLoan(row))
        return true
      }
      return false
    },
  )

  pulled += await pullEntityTable<RemoteMonthBudget>(
    'month_budgets',
    user.id,
    watermark,
    async (row) => {
      const local = await getMonthBudgetById(row.id)
      if (!local || local.updated_at < row.updated_at) {
        await upsertMonthBudget(fromRemoteMonthBudget(row))
        return true
      }
      return false
    },
  )

  const { data: remoteProfile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) throw profileError

  if (remoteProfile) {
    const remote = remoteProfile as RemoteProfile
    const local = await getProfile()
    if (local.updated_at < remote.updated_at || local.id !== remote.id) {
      await upsertProfile({
        id: remote.id,
        monthly_budget: Number(remote.monthly_budget),
        currency: remote.currency,
        fcm_token: remote.fcm_token ?? null,
        updated_at: remote.updated_at,
        sync_status: 'synced',
      })
      pulled += 1
    }
  }

  setLastPullAt(new Date().toISOString())
  setLastSyncAt(new Date().toISOString())
  return { pulled }
}

export async function syncNow(): Promise<{
  flushed: number
  pulled: number
  errors: string[]
}> {
  const flush = await flushQueue()
  const pull = await pullRemoteChanges()
  notifyDataSynced()
  return { flushed: flush.flushed, pulled: pull.pulled, errors: flush.errors }
}

/**
 * Flush + pull when the PWA becomes visible again (sequential multi-device use).
 * Skipped if last sync was within the resume cooldown (60s).
 */
export async function syncOnResume(): Promise<{
  skipped: boolean
  flushed: number
  pulled: number
  errors: string[]
}> {
  if (!navigator.onLine || !shouldSyncOnResume()) {
    return { skipped: true, flushed: 0, pulled: 0, errors: [] }
  }

  try {
    const result = await syncNow()
    return { skipped: false, ...result }
  } catch {
    return { skipped: false, flushed: 0, pulled: 0, errors: ['Resume sync failed'] }
  }
}

let listenersStarted = false

export async function startSyncListeners(): Promise<void> {
  if (listenersStarted) return
  listenersStarted = true

  const runOnline = () => {
    if (!navigator.onLine) return
    void syncNow().catch(() => undefined)
  }

  const runVisible = () => {
    if (document.visibilityState !== 'visible') return
    void syncOnResume()
  }

  window.addEventListener('online', runOnline)
  document.addEventListener('visibilitychange', runVisible)
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) void syncOnResume()
  })

  runOnline()
}

/** Ensure a remote profiles row exists for the signed-in user. */
export async function ensureRemoteProfile(userId: string): Promise<void> {
  if (!isSupabaseConfigured()) return

  const { data: existing, error: readError } = await getSupabase()
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()
  if (readError) throw readError
  if (existing) return

  const local = await getProfile()
  const { error } = await getSupabase().from('profiles').upsert({
    id: userId,
    monthly_budget: local.monthly_budget,
    currency: local.currency,
    fcm_token: local.fcm_token ?? null,
    updated_at: local.updated_at,
  })
  if (error) throw error
}

export async function pushAllLocalExpenses(userId: string): Promise<void> {
  if (!isSupabaseConfigured()) return
  const expenses = await listExpenses()
  if (expenses.length === 0) return
  const rows = expenses.map((expense) => toRemoteExpense(expense, userId))
  const { error } = await getSupabase().from('expenses').upsert(rows)
  if (error) throw error
  for (const expense of expenses) {
    await upsertExpense({ ...expense, user_id: userId, sync_status: 'synced' })
  }
}

export async function pushAllLocalPlans(userId: string): Promise<void> {
  if (!isSupabaseConfigured()) return
  const plans = await listPlans()
  if (plans.length === 0) return
  const rows = plans.map((plan) => toRemotePlan(plan, userId))
  const { error } = await getSupabase().from('plans').upsert(rows)
  if (error) throw error
  for (const plan of plans) {
    await upsertPlan({ ...plan, user_id: userId, sync_status: 'synced' })
  }
}

export async function pushAllLocalLoans(userId: string): Promise<void> {
  if (!isSupabaseConfigured()) return
  const loans = await listLoans()
  if (loans.length === 0) return
  const rows = loans.map((loan) => toRemoteLoan(loan, userId))
  const { error } = await getSupabase().from('loans').upsert(rows)
  if (error) throw error
  for (const loan of loans) {
    await upsertLoan({ ...loan, user_id: userId, sync_status: 'synced' })
  }
}

export async function pushAllLocalMonthBudgets(userId: string): Promise<void> {
  if (!isSupabaseConfigured()) return
  const budgets = await listMonthBudgets()
  if (budgets.length === 0) return
  const rows = budgets.map((budget) => toRemoteMonthBudget(budget, userId))
  const { error } = await getSupabase().from('month_budgets').upsert(rows)
  if (error) throw error
  for (const budget of budgets) {
    await upsertMonthBudget({
      ...budget,
      user_id: userId,
      sync_status: 'synced',
    })
  }
}
