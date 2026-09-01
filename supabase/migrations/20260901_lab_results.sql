-- Lab work, so the advisor can reason from bloodwork and not just wearables.
--
-- Labs are a different shape from everything else in the health module. A
-- wearable produces a continuous stream; a lab panel is a point-in-time draw
-- where each analyte carries its own reference range, and where the meaning is
-- usually in the comparison with the previous draw rather than in one number.
-- Modelling it as (panel → many results) is what makes "is my ALT trending up?"
-- answerable at all.
--
-- Deliberately NOT stored: the source PDF, the MRN, the date of birth, the
-- ordering physician's details. A lab report carries far more identifying
-- information than the results themselves, and none of it is needed to reason
-- about a trend. Only the analytes are kept.

create table if not exists public.lab_panels (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  -- The draw date, which is the one that matters clinically — not the date the
  -- report was issued or the day it happened to be uploaded.
  collected_on  date not null,
  panel_name    text not null,
  lab_name      text,
  notes         text,
  created_at    timestamptz not null default now()
);

create table if not exists public.lab_results (
  id             uuid primary key default gen_random_uuid(),
  panel_id       uuid not null references public.lab_panels(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  analyte        text not null,          -- "ALT", "HDL Cholesterol", "FIB-4 Index"
  value_num      numeric,                -- null when the result is qualitative
  value_text     text,                   -- "Negative", "<1.30" — kept verbatim
  unit           text,
  ref_low        numeric,
  ref_high       numeric,
  ref_text       text,                   -- the range as printed, when it isn't numeric
  -- normal | low | high | abnormal | unknown. Derived on write where the range
  -- is numeric, taken from the report's own flag otherwise.
  flag           text not null default 'unknown',
  created_at     timestamptz not null default now()
);

create index if not exists lab_panels_user_date_idx on public.lab_panels(user_id, collected_on desc);
create index if not exists lab_results_user_analyte_idx on public.lab_results(user_id, analyte);
create index if not exists lab_results_panel_idx on public.lab_results(panel_id);

alter table public.lab_panels enable row level security;
alter table public.lab_results enable row level security;

-- Strictly the owner's own. Bloodwork is not family-shared data, even in a
-- family app — sharing it should be a deliberate future decision, not a
-- default that falls out of a permissive policy.
create policy "lab_panels: own" on public.lab_panels
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "lab_results: own" on public.lab_results
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.lab_panels to authenticated, service_role;
grant select, insert, update, delete on public.lab_results to authenticated, service_role;
