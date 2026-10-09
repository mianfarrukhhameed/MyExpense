/* Loaded by the Workbox SW via importScripts — handles FCM background pushes. */
/* eslint-disable no-undef */

importScripts(
  'https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js',
)
importScripts(
  'https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js',
)

try {
  if (self.__FIREBASE_CONFIG__ && self.__FIREBASE_CONFIG__.apiKey) {
    if (!firebase.apps.length) {
      firebase.initializeApp(self.__FIREBASE_CONFIG__)
    }
    const messaging = firebase.messaging()
    messaging.onBackgroundMessage((payload) => {
      const notification = payload.notification || {}
      const title = notification.title || 'MyExpense'
      const options = {
        body: notification.body || 'Time to log today’s expenses',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: payload.data || {},
      }
      return self.registration.showNotification(title, options)
    })
  } else {
    console.warn(
      '[MyExpense] Firebase SW config missing — rebuild with VITE_FIREBASE_* set',
    )
  }
} catch (err) {
  console.error('[MyExpense] Firebase messaging SW init failed', err)
}

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
