-- Time-bounded, growth-aware retirement outflows.
-- Lets an expense (e.g. college tuition) start and stop at specific ages and
-- grow at its own rate. Nulls preserve prior behavior:
--   start_age  null -> begins at the plan's current age ("from now")
--   end_age    null -> runs through the working years (scenario governs retirement spend)
--   annual_growth_pct null -> grows with the plan's inflation rate
alter table finance.retirement_expenses
  add column if not exists start_age integer,
  add column if not exists end_age integer,
  add column if not exists annual_growth_pct numeric;
