import type { Expense } from '../core/types/expense'
import type { Profile } from '../core/types/profile'
import { getDb } from './index'
import { listExpenses, upsertExpense } from './expenses.repo'
import { getProfile, upsertProfile } from './profile.repo'
import { STORE_PROFILE } from './schema'
import {
  clearLocalWorkspace,
  createEmptyProfileForUser,
  getBoundUserId,
  GUEST_PROFILE_KEY,
  setBoundUserId,
} from './workspace'

export type BindLocalDataResult = {
  profile: Profile
  /** Guest/local rows were re-keyed onto this user (first bind). */
  migratedGuest: boolean
  /** Previous account's local workspace was cleared. */
  switchedUser: boolean
}

/**
 * Re-key local guest profile + expenses to the authenticated Supabase user id.
 */
export async function migrateGuestDataToUser(userId: string): Promise<Profile> {
  const db = await getDb()
  const current = await getProfile()
  const now = new Date().toISOString()

  if (current.id === userId) {
    setBoundUserId(userId)
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
  setBoundUserId(userId)
  return migrated
}

/**
 * Bind IndexedDB to `userId`.
 * - Same user: keep local workspace
 * - First bind (no prior user): migrate guest data onto this account
 * - Different user: clear local workspace (do not re-key previous user's data)
 */
export async function bindLocalDataToUser(
  userId: string,
): Promise<BindLocalDataResult> {
  const bound = getBoundUserId()

  if (bound === userId) {
    const profile = await getProfile()
    if (profile.id === userId) {
      return { profile, migratedGuest: false, switchedUser: false }
    }
    const repaired = await migrateGuestDataToUser(userId)
    return { profile: repaired, migratedGuest: true, switchedUser: false }
  }

  if (!bound) {
    const migrated = await migrateGuestDataToUser(userId)
    return { profile: migrated, migratedGuest: true, switchedUser: false }
  }

  // Account switch: never attach previous user's expenses/budget to the new login
  await clearLocalWorkspace()
  setBoundUserId(userId)
  const profile = await upsertProfile(createEmptyProfileForUser(userId))
  return { profile, migratedGuest: false, switchedUser: true }
}

/** @deprecated Prefer bindLocalDataToUser — kept for call-site compatibility. */
export async function ensureLocalProfileForUser(
  userId: string,
): Promise<Profile> {
  const result = await bindLocalDataToUser(userId)
  return result.profile
}

export { clearLocalWorkspace, GUEST_PROFILE_KEY }
