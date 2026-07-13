-- Net-basis tithe is on after-tax income. Store the assumed effective tax rate
-- used to derive take-home pay (only applied when tithe_basis = 'net').
alter table finance.retirement_scenarios
  add column if not exists tithe_tax_rate numeric default 25;
