# Daily expense reminder (Cloudflare Worker)

Cron worker that reads `profiles.fcm_token` from Supabase (service role) and sends an **FCM HTTP v1** web push to each token.

## Setup

1. Apply `supabase/migrations/002_fcm_token.sql`
2. Configure Firebase web app + VAPID key in the PWA `.env` (`VITE_FIREBASE_*`)
3. Firebase Console → Project settings → **Service accounts** → Generate new private key
4. From that JSON, map secrets:
   - `FCM_PROJECT_ID` ← `project_id`
   - `FCM_CLIENT_EMAIL` ← `client_email`
   - `FCM_PRIVATE_KEY` ← `private_key` (keep `\n` escapes when pasting into wrangler)
5. Also set:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (service role — never ship to the client)
   - Optional: `REMINDER_TRIGGER_SECRET` for manual `POST /send`
6. Deploy:

```bash
cd workers/daily-reminder
npm install
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put FCM_PROJECT_ID
npx wrangler secret put FCM_CLIENT_EMAIL
npx wrangler secret put FCM_PRIVATE_KEY
npx wrangler secret put REMINDER_TRIGGER_SECRET   # optional
npx wrangler deploy
```

Cron default: `0 20 * * *` (20:00 UTC) — edit `[triggers].crons` in `wrangler.toml`.

## Manual test

1. Install the PWA (required on iOS), enable **Daily expense reminder** in Settings
2. Confirm `profiles.fcm_token` is set in Supabase
3. Trigger the Worker:

```bash
curl -X POST "https://<your-worker>.workers.dev/send?secret=<REMINDER_TRIGGER_SECRET>"
```

Or use Firebase Console → Messaging → **Send test message** with the device token.

Unregistered / expired tokens are cleared (`fcm_token = null`) so later crons stay clean.

## iOS note

Web push requires the PWA installed to the Home Screen (iOS 16.4+). Android Chrome works after notification permission.
