-- Phase 2 booking foundation: traveler profiles + booking orders.

-- Traveler profiles (booking-required details), optionally linked to a Family member.
-- NOTE: passport_number is sensitive PII — isolated in the travel schema, RLS-gated
-- to the owner. Consider column-level encryption before international booking goes live.
CREATE TABLE IF NOT EXISTS travel.travelers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_member_id uuid,               -- optional link to hub.family_members.id
  is_self boolean DEFAULT false,
  given_name text,
  family_name text,
  date_of_birth date,
  gender text,                          -- m | f | x
  nationality text,                     -- ISO country code
  passport_number text,
  passport_expiry date,
  passport_country text,                -- ISO country code
  known_traveler_number text,           -- TSA PreCheck / Global Entry
  seat_pref text,                       -- window | aisle | no_pref
  meal_pref text,
  email text,
  phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Booking orders. status lifecycle:
--   draft -> awaiting_payment -> confirmed | failed | cancelled
CREATE TABLE IF NOT EXISTS travel.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,                   -- flight | hotel
  status text NOT NULL DEFAULT 'draft',
  provider text DEFAULT 'duffel',
  provider_order_id text,
  offer_id text,
  traveler_ids jsonb DEFAULT '[]'::jsonb,
  amount numeric,
  currency text,
  stripe_payment_intent text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE travel.travelers ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel.bookings  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "travel_travelers_all" ON travel.travelers FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "travel_bookings_all"  ON travel.bookings  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

GRANT ALL ON travel.travelers TO authenticated, service_role;
GRANT ALL ON travel.bookings  TO authenticated, service_role;
