-- Home / real-estate value for the retirement net-worth figure. Entered manually
-- (e.g. from a Zillow Zestimate). Home equity = home_value − mortgage balance is
-- added to net worth but NOT to the spendable retirement portfolio.
alter table finance.retirement_scenarios
  add column if not exists home_value numeric default 0,
  add column if not exists home_address text;
