-- Automatic tax calculation for the net-tithe basis: derive the effective tax
-- rate from federal brackets (by filing status) + a flat state/local rate,
-- instead of a manually entered rate.
alter table finance.retirement_scenarios
  add column if not exists tithe_tax_auto boolean default false,
  add column if not exists state_tax_rate numeric default 5;
