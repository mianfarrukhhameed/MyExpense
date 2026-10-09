import type { Expense } from '../../core/types/expense'
import { isExpensesStoreEmpty, upsertExpense } from '../../db/expenses.repo'
import { getDb } from '../../db/index'
import { upsertProfile } from '../../db/profile.repo'
import { STORE_EXPENSES } from '../../db/schema'
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

  const { data: expenses, error: expenseError } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })

  if (expenseError) throw expenseError

  let count = 0
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
 * Replace local expenses with the signed-in user's remote workspace
 * (used after account switch / fresh bind).
 */
export async function hydrateFromRemote(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false

  const user = await getUser()
  if (!user) return false

  const db = await getDb()
  await db.clear(STORE_EXPENSES)
  await pullRemoteWorkspace(user.id)
  return true
}
