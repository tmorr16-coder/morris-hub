-- Pin one child to Today.
--
-- Per user, not per household, and that is the point: two parents share a
-- child but not a home screen. One pins Jaxon and the other pins nobody, or
-- their own eldest, and neither overwrites the other.
--
-- No foreign key to hub.family_members on purpose. A pin is a preference, not
-- a relationship — if the child row is ever removed the pin should quietly
-- stop resolving rather than block the delete, and every read re-checks
-- guardianship anyway (see app/children/_lib/pinned.ts), so a stale or forged
-- id resolves to nothing.
ALTER TABLE hub.preferences
  ADD COLUMN IF NOT EXISTS pinned_child_id uuid;

NOTIFY pgrst, 'reload schema';
