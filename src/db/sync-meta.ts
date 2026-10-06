const LAST_PULL_KEY = 'myexpense:last_pull_at'
const LAST_SYNC_KEY = 'myexpense:last_sync_at'

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
