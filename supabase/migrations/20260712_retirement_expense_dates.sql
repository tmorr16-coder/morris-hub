-- Retirement outflows use real start/stop dates (more intuitive than ages for
-- things like college tuition). The projection converts these to its age axis
-- using the plan's current age. Nulls preserve prior behavior:
--   start_date null -> begins now
--   end_date   null -> runs through the working years (scenario governs retirement spend)
-- The earlier start_age/end_age columns are left in place but no longer used.
alter table finance.retirement_expenses
  add column if not exists start_date date,
  add column if not exists end_date date;
