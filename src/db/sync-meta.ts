const LAST_PULL_KEY = 'myexpense:last_pull_at'
const LAST_SYNC_KEY = 'myexpense:last_sync_at'

/** Minimum gap between resume/visibility syncs. */
export const RESUME_SYNC_COOLDOWN_MS = 60_000

export const DATA_SYNCED_EVENT = 'myexpense:data-synced'

export function getLastPullAt(): string | null {
  return localStorage.getItem(LAST_PULL_KEY)
}

export function setLastPullAt(iso: string): void {
  localStorage.setItem(LAST_PULL_KEY, iso)
}

export function getLastSyncAt(): string | null {
  return localStorage.getItem(LAST_SYNC_KEY)
}

export function setLastSyncAt(iso: string): void {
  localStorage.setItem(LAST_SYNC_KEY, iso)
}

export function clearSyncWatermarks(): void {
  localStorage.removeItem(LAST_PULL_KEY)
  localStorage.removeItem(LAST_SYNC_KEY)
}

/** True when enough time has passed since last sync to run a resume sync. */
export function shouldSyncOnResume(
  cooldownMs = RESUME_SYNC_COOLDOWN_MS,
): boolean {
  const last = getLastSyncAt()
  if (!last) return true
  const t = Date.parse(last)
  if (Number.isNaN(t)) return true
  return Date.now() - t >= cooldownMs
}

export function notifyDataSynced(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(DATA_SYNCED_EVENT))
}
