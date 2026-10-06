import type { Expense } from '../core/types/expense'
import type { Profile } from '../core/types/profile'
import { getDb } from './index'
import { listExpenses, upsertExpense } from './expenses.repo'
import { getProfile, upsertProfile } from './profile.repo'
import { STORE_PROFILE } from './schema'

const GUEST_PROFILE_KEY = 'local-guest-profile-id'

/**
 * Re-key local guest profile + expenses to the authenticated Supabase user id.
 */
export async function migrateGuestDataToUser(userId: string): Promise<Profile> {
  const db = await getDb()
  const current = await getProfile()
  const now = new Date().toISOString()

  if (current.id === userId) {
    return current
  }

  const expenses = await listExpenses()
  for (const expense of expenses) {
    const next: Expense = {
      ...expense,
      user_id: userId,
      updated_at: now,
      sync_status: 'pending',
    }
    await upsertExpense(next)
  }

  await db.delete(STORE_PROFILE, current.id)
  const migrated: Profile = {
    ...current,
    id: userId,
    updated_at: now,
    sync_status: 'pending',
  }
  await upsertProfile(migrated)
  localStorage.setItem(GUEST_PROFILE_KEY, userId)
  return migrated
}

export async function ensureLocalProfileForUser(
  userId: string,
): Promise<Profile> {
  return migrateGuestDataToUser(userId)
}
