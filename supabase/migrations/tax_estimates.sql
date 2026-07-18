-- Saved next-year tax estimates (one row per user per tax year).
create table if not exists finance.tax_estimates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tax_year integer not null,
  inputs jsonb not null default '{}'::jsonb,
  results jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tax_year)
);

alter table finance.tax_estimates enable row level security;

drop policy if exists "own tax estimates" on finance.tax_estimates;
create policy "own tax estimates" on finance.tax_estimates
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant all on finance.tax_estimates to service_role;
grant select, insert, update, delete on finance.tax_estimates to authenticated;
