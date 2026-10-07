/* Background FCM handler. Config is injected at runtime via message if needed;
   for production, replace placeholders or serve a generated file with real config. */
/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js')
importScripts(
  'https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js',
)

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'FIREBASE_CONFIG') return
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(event.data.config)
    }
    firebase.messaging()
  } catch {
    // Ignore re-init races
  }
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { notification: { title: 'MyExpense', body: event.data?.text() } }
  }
  const notification = payload.notification ?? {}
  const title = notification.title || 'MyExpense'
  const options = {
    body: notification.body || 'Time to log today’s expenses',
    icon: '/icons/icon-192.png',
    data: payload.data ?? {},
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) return client.focus()
        }
        if (clients.openWindow) return clients.openWindow('/')
      }),
  )
})
