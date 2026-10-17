import type { Expense } from '../../core/types/expense'
import type { Profile } from '../../core/types/profile'
import { listExpenses, upsertExpense } from '../../db/expenses.repo'
import { getProfile, upsertProfile } from '../../db/profile.repo'
import {
  listPendingSyncItems,
  removeSyncItem,
} from '../../db/sync-queue.repo'
import {
  clearDeferredConflicts,
  setDeferredConflicts,
  type DeferredConflicts,
} from '../../db/sync-meta'
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase/client'
import { enqueueSyncItem } from '../../db/sync-queue.repo'

export type SyncConflictChoice = 'use_cloud' | 'push_local' | 'cancel'

export type ProfileConflict = {
  local: Profile
  remote: {
    id: string
    monthly_budget: number
    currency: string
    fcm_token?: string | null
    updated_at: string
  }
}

export type ExpenseConflict = {
  local: Expense
  remote: Expense
}

export type SyncConflictReport = {
  profile: ProfileConflict | null
  expenses: ExpenseConflict[]
}

function expenseFieldsDiffer(a: Expense, b: Expense): boolean {
  return (
    Number(a.amount) !== Number(b.amount) ||
    a.category !== b.category ||
    (a.description ?? null) !== (b.description ?? null) ||
    a.date !== b.date ||
    (a.receipt_url ?? null) !== (b.receipt_url ?? null)
  )
}

function profileFieldsDiffer(
  local: Profile,
  remote: ProfileConflict['remote'],
): boolean {
  return (
    Number(local.monthly_budget) !== Number(remote.monthly_budget) ||
    local.currency !== remote.currency
  )
}

/**
 * Find conflicts where local is older than remote AND values differ.
 */
export async function detectSyncConflicts(
  userId: string,
): Promise<SyncConflictReport | null> {
  if (!isSupabaseConfigured() || !navigator.onLine) return null

  const supabase = getSupabase()
  const localProfile = await getProfile()
  const localExpenses = await listExpenses()

  const { data: remoteProfileRow, error: profileError } = await supabase
    .from('profiles')
    .select('id, monthly_budget, currency, fcm_token, updated_at')
    .eq('id', userId)
    .maybeSingle()
  if (profileError) throw profileError

  let profile: ProfileConflict | null = null
  if (remoteProfileRow) {
    const remote = {
      id: remoteProfileRow.id as string,
      monthly_budget: Number(remoteProfileRow.monthly_budget),
      currency: String(remoteProfileRow.currency),
      fcm_token: (remoteProfileRow.fcm_token as string | null) ?? null,
      updated_at: String(remoteProfileRow.updated_at),
    }
    if (
      localProfile.updated_at < remote.updated_at &&
      profileFieldsDiffer(localProfile, remote)
    ) {
      profile = { local: localProfile, remote }
    }
  }

  const { data: remoteExpenses, error: expenseError } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
  if (expenseError) throw expenseError

  const remoteById = new Map<string, Expense>()
  for (const row of remoteExpenses ?? []) {
    remoteById.set(row.id as string, {
      id: row.id as string,
      user_id: row.user_id as string,
      amount: Number(row.amount),
      category: String(row.category),
      description: (row.description as string | null) ?? null,
      date: String(row.date),
      receipt_url: (row.receipt_url as string | null) ?? null,
      local_receipt_blob_key: null,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      sync_status: 'synced',
    })
  }

  const expenses: ExpenseConflict[] = []
  for (const local of localExpenses) {
    const remote = remoteById.get(local.id)
    if (!remote) continue
    if (local.updated_at < remote.updated_at && expenseFieldsDiffer(local, remote)) {
      expenses.push({ local, remote })
    }
  }

  if (!profile && expenses.length === 0) return null
  return { profile, expenses }
}

export function summarizeConflictReport(report: SyncConflictReport): string {
  const parts: string[] = []
  if (report.profile) {
    parts.push(
      `Budget/currency — cloud: ${report.profile.remote.currency} ${report.profile.remote.monthly_budget}; this device: ${report.profile.local.currency} ${report.profile.local.monthly_budget}`,
    )
  }
  if (report.expenses.length > 0) {
    parts.push(
      `${report.expenses.length} expense${report.expenses.length === 1 ? '' : 's'} older on this device`,
    )
  }
  return parts.join('\n')
}

async function stripConflictQueueItems(report: SyncConflictReport): Promise<void> {
  const pending = await listPendingSyncItems()
  const expenseIds = new Set(report.expenses.map((row) => row.local.id))

  for (const item of pending) {
    if (item.entity === 'profile' && report.profile) {
      await removeSyncItem(item.id)
      continue
    }
    if (item.entity === 'expense') {
      const payload = item.payload as { id?: string }
      if (payload.id && expenseIds.has(payload.id)) {
        await removeSyncItem(item.id)
      }
    }
  }
}

/** Apply user choice for older-local conflicts. */
export async function applySyncConflictChoice(
  userId: string,
  report: SyncConflictReport,
  choice: SyncConflictChoice,
): Promise<void> {
  if (choice === 'cancel') {
    await stripConflictQueueItems(report)
    const deferred: DeferredConflicts = {
      profile: Boolean(report.profile),
      expenseIds: report.expenses.map((row) => row.local.id),
    }
    setDeferredConflicts(deferred)
    return
  }

  clearDeferredConflicts()

  if (choice === 'use_cloud') {
    if (report.profile) {
      const remote = report.profile.remote
      await upsertProfile({
        id: userId,
        monthly_budget: remote.monthly_budget,
        currency: remote.currency,
        fcm_token: remote.fcm_token ?? report.profile.local.fcm_token ?? null,
        updated_at: remote.updated_at,
        sync_status: 'synced',
      })
    }
    for (const row of report.expenses) {
      await upsertExpense({ ...row.remote, sync_status: 'synced' })
    }
    await stripConflictQueueItems(report)
    return
  }

  // push_local
  if (report.profile) {
    const local = report.profile.local
    const now = new Date().toISOString()
    const bumped: Profile = {
      ...local,
      updated_at: now > local.updated_at ? now : local.updated_at,
      sync_status: 'pending',
    }
    await upsertProfile(bumped)
    await enqueueSyncItem({
      entity: 'profile',
      operation: 'update',
      payload: bumped,
    })
  }
  for (const row of report.expenses) {
    const now = new Date().toISOString()
    const bumped: Expense = {
      ...row.local,
      updated_at: now > row.local.updated_at ? now : row.local.updated_at,
      sync_status: 'pending',
    }
    await upsertExpense(bumped)
    await enqueueSyncItem({
      entity: 'expense',
      operation: 'update',
      payload: bumped,
    })
  }
}
