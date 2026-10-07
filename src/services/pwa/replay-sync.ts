import { flushQueue } from '../sync/sync-engine'

let listening = false

/** Ask the service worker to register a Background Sync tag. */
export async function requestReplaySync(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  try {
    const reg = await navigator.serviceWorker.ready
    const syncManager = (
      reg as ServiceWorkerRegistration & {
        sync?: { register: (tag: string) => Promise<void> }
      }
    ).sync
    if (syncManager) {
      await syncManager.register('replay-sync')
    }
  } catch {
    // Background Sync unsupported or permission denied — online listener still works
  }
}

/** Listen for SW → client messages that ask to flush the IndexedDB sync_queue. */
export function startReplaySyncListener(): void {
  if (listening || !('serviceWorker' in navigator)) return
  listening = true

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'REPLAY_SYNC') {
      void flushQueue()
    }
  })
}
