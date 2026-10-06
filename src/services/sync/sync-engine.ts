/**
 * Phase 2/5: Flush the local sync_queue to Supabase when online.
 * Phase 5 may also trigger this via Workbox Background Sync.
 */
export async function flushQueue(): Promise<{ flushed: number }> {
  // Stub — implemented in Phase 2
  return { flushed: 0 }
}

export async function startSyncListeners(): Promise<void> {
  // Stub — online/offline listeners wired in Phase 2
}
