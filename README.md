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

### Phase 3 — Expense logging and receipts

- FAB + modal form: amount, category, date, description, optional receipt photo
- Day-grouped expense list with swipe-to-delete and tap-to-edit
- Client-side JPEG compress → IndexedDB blob → Supabase Storage upload on sync
- Receipt thumbnails + full-screen preview modal

### Phase 4 — Dashboard, budget analytics, and charts (current)

- Current-month planned / spent / remaining with progress meter
- Burn-rate pacing (actual vs allowed daily rate + projected month-end)
- Recharts 12-month spend comparison with highest-month alert
- Settings: budget + currency; Dashboard links to Settings

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

1. Sign in → **Settings** → set budget → **Save budget locally**
2. Add an expense (Expenses FAB or sample button)
3. Confirm data survives refresh (IndexedDB)

### Phase 2 (auth + sync)

1. Register / sign in → tabs load
2. Settings → Sync now → rows in Supabase `expenses` / `profiles`
3. Wipe site data → sign in → hydration restores expenses

### Phase 3 (expenses + receipts)

1. Expenses → **+** → save with optional receipt
2. Edit / swipe-delete; thumbnail preview
3. Sync now → Storage object + `receipt_url`

### Phase 4 (dashboard)

1. Set budget 500; add known expenses this month → spent/remaining/progress match
2. Front-load spend → burn-rate warning when projected over budget
3. Prior-month expenses → chart bars + highest-month alert
4. Airplane mode → Dashboard still computes from IndexedDB

## Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Environment

See `.env.example` for Supabase (Phase 2) and FCM (Phase 5) placeholders.
