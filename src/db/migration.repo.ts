import {
  DEFAULT_CURRENCY,
  DEFAULT_MONTHLY_BUDGET,
} from '../core/config/app.config'
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
  /** Guest had real local work that should be pushed, then cloud merged. */
  migratedGuest: boolean
  /** Local workspace was reset; load cloud only (never push defaults). */
  switchedUser: boolean
}

/** True when local data is more than empty USD / 0 budget defaults. */
export async function hasMeaningfulLocalGuestData(): Promise<boolean> {
  const expenses = await listExpenses()
  if (expenses.length > 0) return true

  try {
    const profile = await getProfile()
    if (Number(profile.monthly_budget) !== DEFAULT_MONTHLY_BUDGET) return true
    if (profile.currency !== DEFAULT_CURRENCY) return true
  } catch {
    return false
  }
  return false
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
 * - First bind with real guest work: migrate onto this account
 * - First bind with empty defaults (reinstall / cleared storage): hydrate-only
 * - Different user: clear local workspace
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
    const meaningful = await hasMeaningfulLocalGuestData()
    if (meaningful) {
      const repaired = await migrateGuestDataToUser(userId)
      return { profile: repaired, migratedGuest: true, switchedUser: false }
    }
    await clearLocalWorkspace()
    setBoundUserId(userId)
    const profileFresh = await upsertProfile(createEmptyProfileForUser(userId))
    return { profile: profileFresh, migratedGuest: false, switchedUser: true }
  }

  if (!bound) {
    const meaningful = await hasMeaningfulLocalGuestData()
    if (meaningful) {
      const migrated = await migrateGuestDataToUser(userId)
      return { profile: migrated, migratedGuest: true, switchedUser: false }
    }
    // Reinstall / new browser: empty defaults must NOT overwrite cloud profile
    await clearLocalWorkspace()
    setBoundUserId(userId)
    const profile = await upsertProfile(createEmptyProfileForUser(userId))
    return { profile, migratedGuest: false, switchedUser: true }
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
