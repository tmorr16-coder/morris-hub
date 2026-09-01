-- ============================================================
-- Health Records: real medical records (lab panels, body-composition
-- scans, vitals) and the source documents they were read from.
--
-- Lives in the public schema alongside the other health tables
-- (workout_sessions, meals, medications, apple_health_metrics) so the
-- existing admin-client `db.from("…")` calls keep working unprefixed.
--
-- Safe to re-run.
-- ============================================================

-- ── health_record_documents ──────────────────────────────────
-- One row per uploaded/entered report. A lab draw that produced 12
-- panels is ONE document; each analyte becomes a health_lab_results row
-- pointing back here. Manually entered results may have no document.
create table if not exists public.health_record_documents (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  kind               text not null default 'lab_panel',  -- lab_panel|body_composition|vitals|imaging|visit|other
  title              text not null,
  -- Where the record came from: 'Quest Diagnostics', 'InBody 770', a clinic…
  source             text,
  performed_on       date not null,                      -- collection / scan date
  reported_on        date,
  provider           text,                               -- ordering physician
  facility           text,                               -- performing lab / location
  accession          text,                               -- lab accession / order number
  file_name          text,
  file_path          text,                               -- storage object path in `health-records`
  file_mime          text,
  -- Free-text impression, plus the model's own summary of the report.
  summary            text,
  notes              text,
  -- 'ai_extract' when parsed from an upload, 'manual' when typed in.
  entry_method       text not null default 'manual',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists health_record_documents_user_idx
  on public.health_record_documents(user_id, performed_on desc);
create index if not exists health_record_documents_kind_idx
  on public.health_record_documents(user_id, kind, performed_on desc);

-- ── health_lab_results ───────────────────────────────────────
-- One analyte result. `biomarker_key` is the canonical key from
-- lib/health/biomarkers.ts; `name` keeps the label exactly as the lab
-- printed it so a report renders faithfully even for unmapped tests.
create table if not exists public.health_lab_results (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  document_id        uuid references public.health_record_documents(id) on delete cascade,
  biomarker_key      text,                               -- null when the analyte isn't in the catalog
  name               text not null,                      -- as printed on the report
  panel              text,                               -- "LIPID PANEL", "CBC"…
  collected_on       date not null,
  value              numeric,                            -- null when the result is qualitative
  value_text         text,                               -- "SEE NOTE", "NEGATIVE", "<5"
  unit               text,
  ref_low            numeric,
  ref_high           numeric,
  ref_text           text,                               -- "> OR = 60", "<200", "30-100"
  -- H / L / A(bnormal) / C(ritical) as flagged by the lab, else derived.
  flag               text,
  note               text,                               -- interpretive comment from the report
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists health_lab_results_user_idx
  on public.health_lab_results(user_id, collected_on desc);
create index if not exists health_lab_results_doc_idx
  on public.health_lab_results(document_id);
-- Drives the per-biomarker trend view.
create index if not exists health_lab_results_marker_idx
  on public.health_lab_results(user_id, biomarker_key, collected_on desc);

-- Re-importing the same PDF must update the existing rows rather than
-- duplicate the panel. Keyed on the catalog biomarker where we have one.
create unique index if not exists health_lab_results_dedupe_idx
  on public.health_lab_results(user_id, biomarker_key, collected_on)
  where biomarker_key is not null;

-- ── health_body_composition ──────────────────────────────────
-- A DEXA / InBody-style scan. Columns cover the InBody 770 sheet; the
-- segmental breakdowns stay as jsonb because their shape is device-specific.
create table if not exists public.health_body_composition (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  document_id            uuid references public.health_record_documents(id) on delete cascade,
  measured_on            date not null,
  device                 text,                            -- "InBody 770", "DEXA"…

  weight_lbs             numeric(6,1),
  bmi                    numeric(5,2),
  body_fat_pct           numeric(5,2),
  body_fat_mass_lbs      numeric(6,1),
  lean_body_mass_lbs     numeric(6,1),
  skeletal_muscle_lbs    numeric(6,1),
  dry_lean_mass_lbs      numeric(6,1),

  total_body_water_lbs   numeric(6,1),
  intracellular_water_lbs numeric(6,1),
  extracellular_water_lbs numeric(6,1),
  ecw_tbw                numeric(5,3),                    -- edema index, ~0.380

  visceral_fat_area      numeric(6,1),                    -- cm²
  bmr_kcal               integer,                         -- basal metabolic rate
  smi                    numeric(5,2),                    -- skeletal muscle index, kg/m²
  tbw_lbm_pct            numeric(5,1),
  leg_lean_mass_lbs      numeric(6,1),
  phase_angle            numeric(5,2),

  -- { right_arm, left_arm, trunk, right_leg, left_leg } in lbs, plus a
  -- matching *_pct object when the sheet prints "% of ideal".
  segmental_lean         jsonb,
  segmental_fat          jsonb,

  -- InBody "Body Fat - Lean Body Mass Control" targets, in lbs.
  fat_mass_control_lbs   numeric(6,1),
  lean_mass_control_lbs  numeric(6,1),

  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists health_body_composition_user_idx
  on public.health_body_composition(user_id, measured_on desc);
-- One scan per device per day — a re-import updates in place.
create unique index if not exists health_body_composition_dedupe_idx
  on public.health_body_composition(user_id, measured_on, coalesce(device, ''));

-- ── health_vitals ────────────────────────────────────────────
-- Office/home readings that aren't lab analytes.
create table if not exists public.health_vitals (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  document_id        uuid references public.health_record_documents(id) on delete cascade,
  measured_on        date not null,
  measured_at        timestamptz,
  systolic           integer,
  diastolic          integer,
  pulse_bpm          integer,
  temperature_f      numeric(4,1),
  spo2_pct           integer,
  respiratory_rate   integer,
  weight_lbs         numeric(6,1),
  height_in          numeric(5,2),
  waist_in           numeric(5,2),
  context            text,                                -- "office visit", "home", "fasting"
  notes              text,
  created_at         timestamptz not null default now()
);

create index if not exists health_vitals_user_idx
  on public.health_vitals(user_id, measured_on desc);

-- ── updated_at maintenance ───────────────────────────────────
create or replace function public.health_records_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists health_record_documents_touch on public.health_record_documents;
create trigger health_record_documents_touch
  before update on public.health_record_documents
  for each row execute function public.health_records_touch_updated_at();

drop trigger if exists health_lab_results_touch on public.health_lab_results;
create trigger health_lab_results_touch
  before update on public.health_lab_results
  for each row execute function public.health_records_touch_updated_at();

drop trigger if exists health_body_composition_touch on public.health_body_composition;
create trigger health_body_composition_touch
  before update on public.health_body_composition
  for each row execute function public.health_records_touch_updated_at();

-- ── RLS ──────────────────────────────────────────────────────
-- Medical records are the most sensitive data in the hub: every table is
-- owner-only, with no family/household sharing path. Server code reaches
-- them through the service-role client, which bypasses these policies and
-- always filters on user_id itself.
alter table public.health_record_documents enable row level security;
alter table public.health_lab_results      enable row level security;
alter table public.health_body_composition enable row level security;
alter table public.health_vitals           enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'health_record_documents',
    'health_lab_results',
    'health_body_composition',
    'health_vitals'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || ': read own', t);
    execute format('drop policy if exists %I on public.%I', t || ': insert own', t);
    execute format('drop policy if exists %I on public.%I', t || ': update own', t);
    execute format('drop policy if exists %I on public.%I', t || ': delete own', t);

    execute format('create policy %I on public.%I for select using (auth.uid() = user_id)', t || ': read own', t);
    execute format('create policy %I on public.%I for insert with check (auth.uid() = user_id)', t || ': insert own', t);
    execute format('create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t || ': update own', t);
    execute format('create policy %I on public.%I for delete using (auth.uid() = user_id)', t || ': delete own', t);
  end loop;
end
$$;

-- ── Storage: original report files ───────────────────────────
-- Private bucket. Objects are stored as `<user_id>/<document_id>/<filename>`,
-- so the first path segment is the owner check.
insert into storage.buckets (id, name, public)
values ('health-records', 'health-records', false)
on conflict (id) do nothing;

drop policy if exists "users_upload_own_health_records" on storage.objects;
create policy "users_upload_own_health_records" on storage.objects
  for insert with check (
    bucket_id = 'health-records' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "users_view_own_health_records" on storage.objects;
create policy "users_view_own_health_records" on storage.objects
  for select using (
    bucket_id = 'health-records' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "users_delete_own_health_records" on storage.objects;
create policy "users_delete_own_health_records" on storage.objects
  for delete using (
    bucket_id = 'health-records' and
    auth.uid()::text = (storage.foldername(name))[1]
  );
