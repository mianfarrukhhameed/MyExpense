-- Plans, loans, and per-month budgets

create table if not exists public.plans (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric not null check (amount > 0),
  category text not null,
  description text,
  due_date date not null,
  recurrence text not null default 'none' check (recurrence in ('none', 'monthly')),
  day_of_month integer check (day_of_month is null or (day_of_month >= 1 and day_of_month <= 31)),
  status text not null default 'upcoming' check (status in ('upcoming', 'paid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plans_user_id_idx on public.plans (user_id);
create index if not exists plans_user_updated_idx on public.plans (user_id, updated_at);

alter table public.plans enable row level security;

create policy "plans_select_own"
  on public.plans for select
  using (auth.uid() = user_id);

create policy "plans_insert_own"
  on public.plans for insert
  with check (auth.uid() = user_id);

create policy "plans_update_own"
  on public.plans for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "plans_delete_own"
  on public.plans for delete
  using (auth.uid() = user_id);

-- Loans
create table if not exists public.loans (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  person text not null,
  amount numeric not null check (amount > 0),
  remaining numeric not null check (remaining >= 0),
  direction text not null check (direction in ('borrowed', 'lent')),
  loan_date date not null,
  due_date date not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists loans_user_id_idx on public.loans (user_id);
create index if not exists loans_user_updated_idx on public.loans (user_id, updated_at);

alter table public.loans enable row level security;

create policy "loans_select_own"
  on public.loans for select
  using (auth.uid() = user_id);

create policy "loans_insert_own"
  on public.loans for insert
  with check (auth.uid() = user_id);

create policy "loans_update_own"
  on public.loans for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "loans_delete_own"
  on public.loans for delete
  using (auth.uid() = user_id);

-- Per-month budgets (profiles.monthly_budget remains the default)
create table if not exists public.month_budgets (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  month_key text not null,
  amount numeric not null check (amount >= 0),
  updated_at timestamptz not null default now(),
  unique (user_id, month_key)
);

create index if not exists month_budgets_user_id_idx on public.month_budgets (user_id);
create index if not exists month_budgets_user_updated_idx on public.month_budgets (user_id, updated_at);

alter table public.month_budgets enable row level security;

create policy "month_budgets_select_own"
  on public.month_budgets for select
  using (auth.uid() = user_id);

create policy "month_budgets_insert_own"
  on public.month_budgets for insert
  with check (auth.uid() = user_id);

create policy "month_budgets_update_own"
  on public.month_budgets for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "month_budgets_delete_own"
  on public.month_budgets for delete
  using (auth.uid() = user_id);
