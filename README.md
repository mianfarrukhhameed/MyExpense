# MyExpense

Offline-first personal expense tracker PWA (Ionic React + IndexedDB + Supabase).

## Implemented so far

### Phase 1 — Scaffold and offline database

- Vite + React + TypeScript + Ionic React (adaptive iOS / Material)
- Bottom tabs: Dashboard, Expenses, Settings (`/tabs/...`)
- IndexedDB (`myexpense` v1): `expenses`, `profile`, `sync_queue`, `receipt_blobs`
- Local CRUD via repos + shared local-data context (tabs stay in sync)
- PWA shell via `vite-plugin-pwa` / Workbox

### Phase 2 — Auth and Supabase sync

- Email/password auth via Supabase Auth
- Auth gate + guest re-key + sync engine flush/pull + hydration
- Settings: sync status, **Sync now**, sign out

### Phase 3 — Expense logging and receipts

- FAB form, day-grouped list, swipe delete, edit
- Compressed receipts → IndexedDB → Supabase Storage on sync

### Phase 4 — Dashboard and charts

- Budget meter, burn-rate pacing, Recharts 12-month comparison
- Settings: budget + currency

### Phase 5 — PWA hardening and FCM (current)

- Workbox: app shell + NetworkFirst for Supabase REST GETs
- Background Sync tag `replay-sync` → client flushes IndexedDB `sync_queue` (single source of truth)
- `InstallPrompt`: Android `beforeinstallprompt` sheet; iOS Share → Add to Home Screen tip
- FCM: Settings **Daily expense reminder** stores `profiles.fcm_token`
- Migration [`002_fcm_token.sql`](supabase/migrations/002_fcm_token.sql)
- Cloudflare Worker cron stub: [`workers/daily-reminder/`](workers/daily-reminder/)

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. Run [`001_init.sql`](supabase/migrations/001_init.sql) then [`002_fcm_token.sql`](supabase/migrations/002_fcm_token.sql)
3. Copy `.env.example` → `.env` and set Supabase (+ optional Firebase) keys
4. Auth → URL configuration: local origin and Cloudflare Pages HTTPS origin
5. Restart `npm run dev` after changing env

## Firebase / reminders (Phase 5)

1. Create a Firebase web app; enable Cloud Messaging; create a VAPID key
2. Fill `VITE_FIREBASE_*` in `.env`
3. Enable reminder in Settings → grant permission → token on `profiles.fcm_token`
4. Test via Firebase Console, or deploy `workers/daily-reminder` (see its README)

**iOS:** install to Home Screen (16.4+) for reliable web push.

## Smoke tests

### Phases 1–4

See earlier phase notes: local CRUD, auth/sync, expenses/receipts, dashboard math.

### Phase 5

1. `npm run build && npm run preview` → offline shell loads after first visit
2. Queue an expense offline → go online → sync (app `online` and/or SW `replay-sync`)
3. Android Chrome: install CTA; iOS Safari (not standalone): Share instructions
4. Enable reminder with Firebase env → `fcm_token` set; send test message

## Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Deploy

Cloudflare Pages after Phase 5 (or earlier for sync-only). Allowlist the Pages origin in Supabase Auth.

## Environment

See `.env.example` for Supabase and FCM placeholders. Never commit service-role or FCM private keys.
