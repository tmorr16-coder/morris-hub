-- Preferred car-rental brands, alongside the airline and hotel-chain
-- preferences that already exist, plus a per-programme points valuation so a
-- user can override the app's default figure for their own programme.

ALTER TABLE travel.preferences ADD COLUMN IF NOT EXISTS preferred_car_companies text[] DEFAULT '{}';

-- Cents per point. NULL means "use the app's published figure for this brand".
ALTER TABLE travel.loyalty_programs ADD COLUMN IF NOT EXISTS points_value_cents numeric;

-- Grants: these are existing tables, already granted — no new privileges
-- needed. Kept here so the file is self-describing if it's ever replayed.
