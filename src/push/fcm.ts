import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type Messaging,
} from 'firebase/messaging'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase/client'
import { getProfile, upsertProfile } from '../db/profile.repo'
import { enqueueSyncItem } from '../db/sync-queue.repo'

const REMINDER_PREF_KEY = 'myexpense-daily-reminder'

function firebaseConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  }
}

export function isFcmConfigured(): boolean {
  const cfg = firebaseConfig()
  return Boolean(
    cfg.apiKey &&
      cfg.projectId &&
      cfg.messagingSenderId &&
      cfg.appId &&
      import.meta.env.VITE_FIREBASE_VAPID_KEY,
  )
}

export function getDailyReminderPref(): boolean {
  return localStorage.getItem(REMINDER_PREF_KEY) === '1'
}

export function setDailyReminderPref(enabled: boolean): void {
  localStorage.setItem(REMINDER_PREF_KEY, enabled ? '1' : '0')
}

let app: FirebaseApp | null = null
let messaging: Messaging | null = null
let foregroundListening = false

async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (!isFcmConfigured()) return null
  if (!(await isSupported())) return null

  if (!app) {
    app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig())
  }
  if (!messaging) {
    messaging = getMessaging(app)
  }

  return messaging
}

/** Show in-app notifications when a message arrives while the PWA is open. */
export async function startForegroundMessageListener(
  onNotify?: (title: string, body: string) => void,
): Promise<void> {
  if (foregroundListening) return
  const msg = await getFirebaseMessaging()
  if (!msg) return

  foregroundListening = true
  onMessage(msg, (payload) => {
    const title = payload.notification?.title ?? 'MyExpense'
    const body =
      payload.notification?.body ?? 'Time to log today’s expenses'
    if (onNotify) {
      onNotify(title, body)
      return
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/icons/icon-192.png',
      })
    }
  })
}

async function persistFcmToken(token: string | null): Promise<void> {
  const profile = await getProfile()
  const updated = await upsertProfile({
    ...profile,
    fcm_token: token,
    updated_at: new Date().toISOString(),
    sync_status: 'pending',
  })
  await enqueueSyncItem({
    entity: 'profile',
    operation: 'update',
    payload: updated,
  })

  if (isSupabaseConfigured()) {
    await getSupabase()
      .from('profiles')
      .upsert({
        id: updated.id,
        monthly_budget: updated.monthly_budget,
        currency: updated.currency,
        fcm_token: token,
        updated_at: updated.updated_at,
      })
  }
}

export async function enableDailyReminder(): Promise<string> {
  if (!isFcmConfigured()) {
    throw new Error('Add VITE_FIREBASE_* keys to .env to enable reminders')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission denied')
  }

  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers are required for push notifications')
  }

  const msg = await getFirebaseMessaging()
  if (!msg) throw new Error('FCM is not supported in this browser')

  // Must use the same SW that loads firebase-push.js (Workbox /sw.js)
  const registration = await navigator.serviceWorker.ready

  // Ensure the active worker has claimed clients before token request
  if (registration.active) {
    registration.active.postMessage({ type: 'SKIP_WAITING' })
  }

  const token = await getToken(msg, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  })

  if (!token) throw new Error('Could not obtain FCM token')

  setDailyReminderPref(true)
  await persistFcmToken(token)
  await startForegroundMessageListener()
  return token
}

export async function disableDailyReminder(): Promise<void> {
  setDailyReminderPref(false)
  await persistFcmToken(null)
}
