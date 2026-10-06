import type { Expense } from '../../core/types/expense'
import { isExpensesStoreEmpty, upsertExpense } from '../../db/expenses.repo'
import { upsertProfile } from '../../db/profile.repo'
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
  updated_at: string
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

  const supabase = getSupabase()

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) throw profileError

  if (profile) {
    const remote = profile as RemoteProfile
    await upsertProfile({
      id: remote.id,
      monthly_budget: Number(remote.monthly_budget),
      currency: remote.currency,
      updated_at: remote.updated_at,
      sync_status: 'synced',
    })
  }

  const { data: expenses, error: expenseError } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', user.id)
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
  }

  const now = new Date().toISOString()
  setLastPullAt(now)
  setLastSyncAt(now)
  return true
}
