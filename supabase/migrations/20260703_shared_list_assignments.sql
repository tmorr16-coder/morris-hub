-- Tag shared-list items to a specific circle member (or leave null = everyone).
-- assigned_to has no FK: it may reference an auth user (adult member) OR a
-- managed child's hub.family_members.id, so we don't constrain it.
-- Safe to re-run.

ALTER TABLE hub.shopping_items   ADD COLUMN IF NOT EXISTS assigned_to UUID;
ALTER TABLE hub.household_goals  ADD COLUMN IF NOT EXISTS assigned_to UUID;
ALTER TABLE hub.meal_plan        ADD COLUMN IF NOT EXISTS assigned_to UUID;
