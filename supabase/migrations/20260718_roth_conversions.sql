-- Roth-conversion plan: convert a fixed pre-tax amount to Roth each year during a
-- low-income window (e.g. early retirement before RMDs). The conversion is taxed
-- as ordinary income; the tax is funded from the taxable bucket.
alter table finance.retirement_scenarios
  add column if not exists roth_convert_enabled boolean default false,
  add column if not exists roth_convert_annual numeric,
  add column if not exists roth_convert_start_age integer,
  add column if not exists roth_convert_end_age integer;
