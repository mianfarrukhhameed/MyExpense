# MyExpense

Offline-first personal expense tracker PWA (Ionic React + IndexedDB + Supabase).

## Implemented so far

### Phase 1 — Scaffold and offline database

- Vite + React + TypeScript + Ionic React (adaptive iOS / Material)
- Bottom tabs: Dashboard, Expenses, Settings (`/tabs/...`)
- IndexedDB (`myexpense` v1): `expenses`, `profile`, `sync_queue`, `receipt_blobs`
- Local CRUD via repos + shared local-data context (tabs stay in sync)
- Settings smoke UI: set budget, add sample expense, show queue count
- PWA shell via `vite-plugin-pwa` / Workbox (production builds)

### Phase 2 — Auth and Supabase sync

- Email/password auth via Supabase Auth
- Auth gate: Login / Register → tabs when signed in
- Guest local data re-keyed to `auth.user.id` on first login
- Sync engine flushes `sync_queue` and pulls remote changes (last-write-wins)
- Hydration restores expenses/profile when local DB is empty
- Settings: sync status, last sync, pending count, **Sync now**, sign out

### Phase 3 — Expense logging and receipts (current)

- FAB + modal form: amount, category, date, description, optional receipt photo
- Day-grouped expense list with swipe-to-delete and tap-to-edit
- Client-side JPEG compress → IndexedDB blob → Supabase Storage upload on sync
- Receipt thumbnails + full-screen preview modal

## Supabase setup (Phase 2+)

1. Create a project at [supabase.com](https://supabase.com)
2. In the SQL editor, run [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql)
3. Copy `.env.example` → `.env` and set:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

4. Auth → URL configuration: add your local origin (e.g. `http://127.0.0.1:5173`) and later Cloudflare Pages URL
5. Restart `npm run dev` after changing env

## Smoke tests

### Phase 1 (local / IndexedDB)

1. Sign in (or use after Phase 2 auth is configured)
2. Open **Settings** → set a planned budget → **Save budget locally**
3. Tap **Add sample expense** (or use the Expenses FAB)
4. Confirm items on **Expenses** and counts on **Dashboard**
5. Refresh the browser — data should remain (IndexedDB)

### Phase 2 (auth + sync)

1. Register a user (disable email confirm in Auth settings for local testing, or confirm the email)
2. Sign in → tabs load
3. Settings → set budget, add sample expense, tap **Sync now**
4. Confirm rows in Supabase Table Editor (`expenses`, `profiles`)
5. Wipe site data (or another browser) → sign in again → hydration restores expenses

### Phase 3 (expenses + receipts)

1. Expenses → **+** → amount, category, date → Save
2. Attach a receipt photo (works offline) → thumbnail appears
3. Tap row to edit; swipe to delete
4. Online / Sync now → expense + Storage object; local blob cleared after upload
5. Tap thumbnail → preview modal

## Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Environment

See `.env.example` for Supabase (Phase 2) and FCM (Phase 5) placeholders.
