import type { Expense } from '../../core/types/expense'
import type { Profile } from '../../core/types/profile'
import {
  getExpenseById,
  listExpenses,
  removeExpense,
  upsertExpense,
} from '../../db/expenses.repo'
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

async function flushExpenseDelete(
  id: string,
  receiptUrl?: string | null,
): Promise<void> {
  const { error } = await getSupabase().from('expenses').delete().eq('id', id)
  if (error) throw error

  if (receiptUrl) {
    await getSupabase().storage.from('receipts').remove([receiptUrl])
  }

  // Local row may already be gone
  const local = await getExpenseById(id)
  if (local) await removeExpense(id)
}

async function flushReceiptUpload(
  expenseId: string,
  blobKey: string,
  userId: string,
): Promise<void> {
  const blob = await getReceiptBlob(blobKey)
  if (!blob) {
    // Blob already cleared — treat as success
    return
  }

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

async function flushProfile(profile: Profile, userId: string): Promise<void> {
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
  // bfcache / back-forward restore
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) void syncOnResume()
  })

  // Initial attempt if already online
  runOnline()
}

/** Ensure a remote profiles row exists for the signed-in user. */
export async function ensureRemoteProfile(userId: string): Promise<void> {
  if (!isSupabaseConfigured()) return

  // Never overwrite an existing cloud profile with empty local defaults (e.g. after account switch)
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
