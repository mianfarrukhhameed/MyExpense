import {
  DEFAULT_CURRENCY,
  DEFAULT_MONTHLY_BUDGET,
} from '../core/config/app.config'
import type { Profile } from '../core/types/profile'
import { getDb } from './index'
import { STORE_PROFILE } from './schema'
import { GUEST_PROFILE_KEY } from './workspace'

function createGuestProfile(): Profile {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    monthly_budget: DEFAULT_MONTHLY_BUDGET,
    currency: DEFAULT_CURRENCY,
    updated_at: now,
    sync_status: 'pending',
  }
}

export async function getProfile(): Promise<Profile> {
  const db = await getDb()
  const all = await db.getAll(STORE_PROFILE)
  if (all.length > 0) {
    return all[0]
  }

  const existingGuestId = localStorage.getItem(GUEST_PROFILE_KEY)
  const profile = createGuestProfile()
  if (existingGuestId) {
    profile.id = existingGuestId
  } else {
    localStorage.setItem(GUEST_PROFILE_KEY, profile.id)
  }

  await db.put(STORE_PROFILE, profile)
  return profile
}

export async function upsertProfile(profile: Profile): Promise<Profile> {
  const db = await getDb()
  await db.put(STORE_PROFILE, profile)
  localStorage.setItem(GUEST_PROFILE_KEY, profile.id)
  return profile
}

export async function updateMonthlyBudget(amount: number): Promise<Profile> {
  const current = await getProfile()
  const next: Profile = {
    ...current,
    monthly_budget: amount,
    updated_at: new Date().toISOString(),
    sync_status: 'pending',
  }
  return upsertProfile(next)
}
