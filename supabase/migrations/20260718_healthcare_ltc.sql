-- Age-banded healthcare + long-term care for the retirement projection.
--   health_premium_pre65     monthly premium before Medicare (ACA/COBRA); null → monthly_health_premium
--   health_premium_medicare  monthly premium at 65+ (Medicare + supplement, before IRMAA); null → monthly_health_premium
--   healthcare_inflation     healthcare-specific inflation % (typically > general CPI); null → plan inflation
--   ltc_*                    optional late-life long-term-care cost
alter table finance.retirement_scenarios
  add column if not exists health_premium_pre65 numeric,
  add column if not exists health_premium_medicare numeric,
  add column if not exists healthcare_inflation numeric,
  add column if not exists ltc_enabled boolean default false,
  add column if not exists ltc_monthly_cost numeric,
  add column if not exists ltc_start_age integer,
  add column if not exists ltc_years integer;
