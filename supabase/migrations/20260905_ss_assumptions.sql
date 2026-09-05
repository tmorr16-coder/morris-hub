-- Social Security assumptions the retirement engine needed and did not have.
--
-- The benefit entered on an income row is the full-retirement-age figure from
-- an SSA statement, in today's dollars. The engine grew it at the plan's
-- general inflation rate from the current age onward — before claiming and for
-- life — with no way to assume a smaller COLA and no way to model the trust
-- fund shortfall. A $2,613/mo statement figure became $140k a year at age 100,
-- and the plan treated all of it as certain.
--
-- Both are plan-wide assumptions, so they live on the profile next to the
-- return and inflation rates. Null means "as before": COLA at plan inflation,
-- no reduction.

alter table if exists finance.retirement_profiles
  add column if not exists ss_cola_rate numeric,
  add column if not exists ss_cut_pct numeric,
  add column if not exists ss_cut_year integer;

comment on column finance.retirement_profiles.ss_cola_rate is
  'Annual Social Security cost-of-living growth as a fraction (0.025 = 2.5%). Null uses the plan inflation rate.';
comment on column finance.retirement_profiles.ss_cut_pct is
  'Percent reduction applied to every Social Security benefit from ss_cut_year onward (0-100). Null or 0 = no reduction.';
comment on column finance.retirement_profiles.ss_cut_year is
  'Calendar year the reduction begins. Null with a non-zero ss_cut_pct is treated as 2033.';
