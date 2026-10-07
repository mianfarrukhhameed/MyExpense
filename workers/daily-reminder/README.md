# Daily expense reminder (Cloudflare Worker stub)

Cron worker that reads `profiles.fcm_token` from Supabase (service role) and is intended to send an FCM HTTP v1 push.

## Setup

1. Apply `supabase/migrations/002_fcm_token.sql`
2. Configure Firebase web app + VAPID key in the PWA `.env`
3. Create a Firebase service account for the Worker
4. `cd workers/daily-reminder && npx wrangler secret put …` for each env var in `wrangler.toml`
5. Deploy: `npx wrangler deploy`

## Local testing without the Worker

Use Firebase Console → Messaging → “Send test message” with a device token from Settings after enabling **Daily expense reminder**.

## iOS note

Web push requires the PWA installed to the Home Screen (iOS 16.4+). Android Chrome works after notification permission.
