# MyExpense

Offline-first personal expense tracker PWA (Ionic React + IndexedDB + Supabase).

## Phase 1 (current)

- Vite + React + TypeScript + Ionic React (adaptive iOS / Material)
- Bottom tabs: Dashboard, Expenses, Settings (`/tabs/...`)
- IndexedDB local store (`idb`) for expenses, profile, sync queue
- PWA shell via `vite-plugin-pwa` / Workbox (production builds)

### Smoke test

1. Open **Settings**
2. Set a planned budget and tap **Save budget locally**
3. Tap **Add sample expense**
4. Confirm items on **Expenses** and counts on **Dashboard**
5. Refresh the browser — data should remain (IndexedDB)

## Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Environment

Copy `.env.example` to `.env` when starting Phase 2 (Supabase) / Phase 5 (FCM).
