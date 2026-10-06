import type { Expense } from '../../core/types/expense'
import type { Profile } from '../../core/types/profile'
import {
  getExpenseById,
  listExpenses,
  removeExpense,
  upsertExpense,
} from '../../db/expenses.repo'
import { getProfile, upsertProfile } from '../../db/profile.repo'
import {
  listPendingSyncItems,
  removeSyncItem,
} from '../../db/sync-queue.repo'
import {
  getLastPullAt,
  setLastPullAt,
  setLastSyncAt,
} from '../../db/sync-meta'
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase/client'
import { getUser } from '../../lib/supabase/auth'

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

async function flushExpenseDelete(id: string): Promise<void> {
  const { error } = await getSupabase().from('expenses').delete().eq('id', id)
  if (error) throw error
  // Local row may already be gone
  const local = await getExpenseById(id)
  if (local) await removeExpense(id)
}

async function flushProfile(profile: Profile, userId: string): Promise<void> {
  const payload: RemoteProfile = {
    id: userId,
    monthly_budget: profile.monthly_budget,
    currency: profile.currency,
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
          const id = (item.payload as { id: string }).id
          await flushExpenseDelete(id)
        } else {
          const expense = item.payload as Expense
          await flushExpenseCreateOrUpdate(expense, user.id)
        }
      } else if (item.entity === 'profile') {
        const profile = item.payload as Profile
        await flushProfile(profile, user.id)
      }
      // receipt uploads handled in Phase 3
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

  return { flushed, errors }
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

  let expenseQuery = supabase
    .from('expenses')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: true })

  if (watermark) {
    expenseQuery = expenseQuery.gt('updated_at', watermark)
  }

  const { data: remoteExpenses, error: expenseError } = await expenseQuery
  if (expenseError) throw expenseError

  for (const row of (remoteExpenses ?? []) as RemoteExpense[]) {
    const local = await getExpenseById(row.id)
    if (!local || local.updated_at < row.updated_at) {
      await upsertExpense(fromRemoteExpense(row))
      pulled += 1
    }
  }

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
  return { flushed: flush.flushed, pulled: pull.pulled, errors: flush.errors }
}

let listenersStarted = false

export async function startSyncListeners(): Promise<void> {
  if (listenersStarted) return
  listenersStarted = true

  const run = () => {
    if (!navigator.onLine) return
    void flushQueue().then(() => pullRemoteChanges()).catch(() => undefined)
  }

  window.addEventListener('online', run)
  // Initial attempt if already online
  run()
}

/** Ensure a remote profiles row exists for the signed-in user. */
export async function ensureRemoteProfile(userId: string): Promise<void> {
  if (!isSupabaseConfigured()) return
  const local = await getProfile()
  const { error } = await getSupabase().from('profiles').upsert({
    id: userId,
    monthly_budget: local.monthly_budget,
    currency: local.currency,
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
