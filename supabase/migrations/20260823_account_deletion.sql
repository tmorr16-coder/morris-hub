-- Deleting a linked account has to survive the next sync.
--
-- lib/finance/sync.ts inserts any SimpleFIN account it does not already have a
-- row for, so a plain DELETE would be undone within a day — the account would
-- silently reappear with its balance back in the net position. Hiding was the
-- only option the UI offered, and hiding is not deleting: the row, its balance
-- history and its transactions all stayed.
--
-- A soft delete gives sync something to recognise. The row stays as a tombstone
-- keyed by the provider's account id; sync sees it, skips the insert, and never
-- resurrects the account. Everything that reads accounts filters it out.

alter table if exists finance.accounts
  add column if not exists deleted_at timestamptz;

comment on column finance.accounts.deleted_at is
  'Set when the user deletes a linked account. The row is retained as a tombstone so lib/finance/sync.ts does not re-create the account on the next sync. All reads must filter deleted_at is null.';

create index if not exists accounts_live_idx
  on finance.accounts(item_id)
  where deleted_at is null;

grant select, insert, update, delete on finance.accounts to authenticated, service_role;
grant select, insert, update, delete on finance.plaid_items to authenticated, service_role;
