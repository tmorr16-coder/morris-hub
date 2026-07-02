-- "Me" dashboard: per-user domain order + disabled set.
ALTER TABLE hub.preferences
  ADD COLUMN IF NOT EXISTS me_domain_order text[] DEFAULT ARRAY['career','health','mind','spirit'],
  ADD COLUMN IF NOT EXISTS me_domains_disabled text[] DEFAULT ARRAY[]::text[];

NOTIFY pgrst, 'reload schema';
