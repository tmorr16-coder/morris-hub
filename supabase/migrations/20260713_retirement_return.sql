-- Optional lower expected return applied at/after the retirement age, to model a
-- glide path to a more conservative allocation. null = same as base_return.
alter table finance.retirement_profiles
  add column if not exists retirement_return numeric;
