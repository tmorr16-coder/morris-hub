-- Automatic tithe & offerings as a retirement-plan outflow.
--   tithe_enabled     off by default (opt-in per plan)
--   tithe_pct         percent of income tithed (default 10)
--   tithe_basis       'gross' (all income as received; slight double-count of the
--                     contribution portion) or 'net' (excludes 401k contributions)
--   offering_monthly  assumed additional giving beyond the tithe, per month
alter table finance.retirement_scenarios
  add column if not exists tithe_enabled boolean default false,
  add column if not exists tithe_pct numeric default 10,
  add column if not exists tithe_basis text default 'gross',
  add column if not exists offering_monthly numeric default 0;
