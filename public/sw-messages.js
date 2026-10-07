/* Extra SW handlers imported by vite-plugin-pwa Workbox build. */

self.addEventListener('sync', (event) => {
  if (event.tag !== 'replay-sync') return
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: 'REPLAY_SYNC' })
        }
      }),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
