-- Three inputs the retirement engine needed and did not have.
--
-- 1. cost_basis_pct — the model hardcoded a 50% gain on every taxable
--    withdrawal. Because taxable is the first bucket drawn, that constant set
--    the early-retirement tax bill and therefore the whole Roth-conversion
--    calculation. Someone holding long-appreciated stock and someone holding
--    recently-invested cash were given the same answer.
--
-- 2. survivor_* — the plan modelled one life. The first death changes filing
--    status to single (brackets roughly halve at the same income), stops the
--    smaller Social Security benefit permanently, and halves the IRMAA
--    thresholds. survivor_spend_pct already existed and was already editable in
--    the UI; nothing ever read it.
--
-- 3. spending_smile_enabled — real retiree spending drifts down in real terms
--    through the middle years and rises again with healthcare. Flat real
--    spending for life was the model's largest unstated conservatism.

alter table if exists finance.retirement_accounts
  add column if not exists cost_basis_pct numeric;

comment on column finance.retirement_accounts.cost_basis_pct is
  'Percent of this account''s balance that is cost basis (0-100). Null falls back to the plan default. Only meaningful for taxable accounts.';

alter table if exists finance.retirement_scenarios
  add column if not exists survivor_enabled boolean default false,
  add column if not exists survivor_age integer,
  add column if not exists spending_smile_enabled boolean default false;

comment on column finance.retirement_scenarios.survivor_age is
  'Age (of the plan owner) at which the first death occurs. Filing switches to single and the smaller Social Security benefit stops.';

-- 4. roth_convert_to_bracket — converting a fixed dollar amount either wastes
--    cheap bracket room in a lean year or spills into a higher rate in a fat
--    one. This lets the conversion fill to the top of a chosen bracket instead.
alter table if exists finance.retirement_scenarios
  add column if not exists roth_convert_to_bracket numeric;

grant select, insert, update, delete on finance.retirement_accounts to authenticated, service_role;
grant select, insert, update, delete on finance.retirement_scenarios to authenticated, service_role;
