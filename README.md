# MyExpense

Offline-first personal expense tracker PWA (Ionic React + IndexedDB + Supabase).

## Implemented so far

### Phase 1 — Scaffold and offline database

- Vite + React + TypeScript + Ionic React (adaptive iOS / Material)
- Bottom tabs: Dashboard, Money, Settings (`/tabs/...`)
- IndexedDB (`myexpense` v2): `expenses`, `profile`, `sync_queue`, `receipt_blobs`, `plans`, `loans`, `month_budgets`
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
- Settings: month budget + default budget + currency

### Phase 5 — PWA hardening and FCM

- Workbox: app shell + NetworkFirst for Supabase REST GETs
- Background Sync tag `replay-sync` → client flushes IndexedDB `sync_queue`
- `InstallPrompt`: Android `beforeinstallprompt` sheet; iOS Share → Add to Home Screen tip
- FCM: Settings **Daily expense reminder** stores `profiles.fcm_token`
- Migration [`002_fcm_token.sql`](supabase/migrations/002_fcm_token.sql)
- Cloudflare Worker cron stub: [`workers/daily-reminder/`](workers/daily-reminder/)

### Money hub (Plans, Loans, month filters)

- Tab **Money** with segments: Expenses | Plans | Loans
- Search + month filter (default = current month; “All months” for full totals)
- List totals: expenses/plans sum; loans show **Borrowed** (by due date) and **Lent** (by loan date)
- Plans: one-off or monthly recurring; **Paid** copies to Expenses and advances next due
- Loans: borrowed or lent; **Pay** records payment → Expense (`Loan Return`) and reduces remaining
- Per-month budgets (`month_budgets`) with profile default fallback
- Extra categories: Grocery, Kids, Kids School, Clothing, Medical, Services, Pocket Money, Loan Return
- Migration [`003_plans_loans_month_budgets.sql`](supabase/migrations/003_plans_loans_month_budgets.sql)

### Voice & receipt expense capture (on-device)

- Expenses FAB expands to **Add**, **Voice** (mic), **Scan** (camera)
- **Hold-to-talk:** press and hold mic, release to process (no fixed wait)
- **Desktop Chrome/Edge:** Voice uses **Prompt API audio only** (AudioBuffer + multimodal prompt). No Web Speech fallback. GPU + model download required.
- **Mobile / no Prompt audio:** Voice uses Web Speech + rules (when available)
- Receipts: Prompt image when available, else **Tesseract.js** OCR + rules
- Always opens **Confirm expense** form before save — never auto-saves

### Multi-device sync conflicts

On login, if this device has **older** profile (budget/currency) or expenses that **differ** from cloud, a dialog offers:

- **Use cloud** — pull conflicting rows from Supabase
- **Overwrite cloud** — push this device’s conflicting rows
- **Cancel** — neither push nor pull those rows (deferred; other sync continues)

### On-device Writer / Rewriter / Embeddings (desktop Chrome)

Progressive enhancement when the APIs are available (flags / origin trials + model download). Hidden or disabled otherwise.

- **Writer (Dashboard):** **Generate financial review** — short personalized report from month budget, spend, burn pace, and top categories
- **Rewriter (forms):** After you pause typing (or when a voice/image draft opens), suggests a cleaner description/note — **Use this** / **Dismiss** (Expense, Plan, Loan)
- **Embeddings:**
  - Category suggest on expense form (strict keywords first, then semantic match) — Accept / Dismiss
  - Money search modes: **Contains** (default substring) or **Similar** (semantic). Vectors stored in IndexedDB `myexpense-ai`

Spoken date parsing in rule-based voice/OCR also understands month names and ordinals (e.g. “10th October”, “on the 5th”).

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. Run migrations in order: [`001_init.sql`](supabase/migrations/001_init.sql), [`002_fcm_token.sql`](supabase/migrations/002_fcm_token.sql), [`003_plans_loans_month_budgets.sql`](supabase/migrations/003_plans_loans_month_budgets.sql)
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

### Money hub

1. Money → Expenses: add expense, search, change month, confirm total updates
2. Plans: add monthly rent (day 15) → **Paid** → appears under Expenses; plan due advances
3. Loans: add borrowed + lent → **Pay** → expense created; borrowed/lent totals update
4. Settings: set month budget for current month; Dashboard meter uses it
5. After deploying SQL `003_*`, Sync now pushes/pulls plans, loans, month budgets

### Phase 5

1. `npm run build && npm run preview` → offline shell loads after first visit
2. Queue an expense offline → go online → sync
3. Android Chrome: install CTA; iOS Safari (not standalone): Share instructions
4. Enable reminder with Firebase env → `fcm_token` set

## Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Deploy

Cloudflare Pages. Allowlist the Pages origin in Supabase Auth. Run SQL migration `003` before relying on Plans/Loans cloud sync.

## Environment

See `.env.example` for Supabase and FCM placeholders. Never commit service-role or FCM private keys.
