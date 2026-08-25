-- Record why a connection is failing, not just that it synced once.
--
-- On success, sync writes status='active' and last_synced_at. On failure it
-- wrote nothing at all: the error went to the server console and the row kept
-- saying 'active' forever. A connection that had been broken for weeks looked
-- identical to a healthy one, and the only hint anywhere was a staleness
-- heuristic on the dashboard inferring trouble from an old last_synced_at.
--
-- These two columns hold the reason and when it happened, so the interface can
-- say what is actually wrong and when it last worked.

alter table if exists finance.plaid_items
  add column if not exists last_error text,
  add column if not exists last_error_at timestamptz;

comment on column finance.plaid_items.last_error is
  'Why the most recent sync failed. Cleared on the next success. Never contains the access URL or any credential.';

grant select, insert, update, delete on finance.plaid_items to authenticated, service_role;
