import {
  DEFAULT_CURRENCY,
  DEFAULT_MONTHLY_BUDGET,
} from '../core/config/app.config'
import type { Profile } from '../core/types/profile'
import { setDailyReminderPref } from '../push/fcm'
import { getDb } from './index'
import {
  STORE_EXPENSES,
  STORE_PROFILE,
  STORE_RECEIPT_BLOBS,
  STORE_SYNC_QUEUE,
} from './schema'
import { clearSyncWatermarks } from './sync-meta'

export const ACTIVE_USER_KEY = 'myexpense-active-user-id'
export const GUEST_PROFILE_KEY = 'local-guest-profile-id'

/** Wipe IndexedDB + local auth-bound keys so another account cannot see prior data. */
export async function clearLocalWorkspace(): Promise<void> {
  const db = await getDb()
  await Promise.all([
    db.clear(STORE_EXPENSES),
    db.clear(STORE_PROFILE),
    db.clear(STORE_SYNC_QUEUE),
    db.clear(STORE_RECEIPT_BLOBS),
  ])
  clearSyncWatermarks()
  localStorage.removeItem(GUEST_PROFILE_KEY)
  localStorage.removeItem(ACTIVE_USER_KEY)
  setDailyReminderPref(false)
}

export function getBoundUserId(): string | null {
  return localStorage.getItem(ACTIVE_USER_KEY)
}

export function setBoundUserId(userId: string): void {
  localStorage.setItem(ACTIVE_USER_KEY, userId)
  localStorage.setItem(GUEST_PROFILE_KEY, userId)
}

export function createEmptyProfileForUser(userId: string): Profile {
  return {
    id: userId,
    monthly_budget: DEFAULT_MONTHLY_BUDGET,
    currency: DEFAULT_CURRENCY,
    fcm_token: null,
    updated_at: new Date().toISOString(),
    sync_status: 'pending',
  }
}
