-- Flag which income sources count toward the 401(k) employer-match base.
-- null preserves prior behavior: only salary income is treated as match-eligible.
alter table finance.retirement_incomes
  add column if not exists match_eligible boolean;
