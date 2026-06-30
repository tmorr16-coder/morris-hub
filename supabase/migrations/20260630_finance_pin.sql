-- Add finance_pin column to hub.preferences if not already present.
-- Plain-text 4-digit PIN — UX barrier, not a cryptographic security boundary.
-- Data is already behind Supabase auth (JWT). The PIN prevents casual shoulder-surfing.
ALTER TABLE hub.preferences
  ADD COLUMN IF NOT EXISTS finance_pin TEXT;
