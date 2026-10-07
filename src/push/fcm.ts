import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import {
  getMessaging,
  getToken,
  isSupported,
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

async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (!isFcmConfigured()) return null
  if (!(await isSupported())) return null

  if (!app) {
    app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig())
  }
  if (!messaging) {
    messaging = getMessaging(app)
  }

  // Pass config to the dedicated messaging SW (compat)
  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.getRegistration(
      '/firebase-messaging-sw.js',
    )
    if (reg?.active) {
      reg.active.postMessage({
        type: 'FIREBASE_CONFIG',
        config: firebaseConfig(),
      })
    }
  }

  return messaging
}

export async function enableDailyReminder(): Promise<string> {
  if (!isFcmConfigured()) {
    throw new Error('Add VITE_FIREBASE_* keys to .env to enable reminders')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission denied')
  }

  const msg = await getFirebaseMessaging()
  if (!msg) throw new Error('FCM is not supported in this browser')

  // Prefer the app's main SW registration when available
  const registration = await navigator.serviceWorker.ready
  const token = await getToken(msg, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  })

  if (!token) throw new Error('Could not obtain FCM token')

  setDailyReminderPref(true)

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

  return token
}

export async function disableDailyReminder(): Promise<void> {
  setDailyReminderPref(false)
  const profile = await getProfile()
  const updated = await upsertProfile({
    ...profile,
    fcm_token: null,
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
        fcm_token: null,
        updated_at: updated.updated_at,
      })
  }
}
