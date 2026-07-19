-- Travel & vacation planning module.
CREATE SCHEMA IF NOT EXISTS travel;

-- Per-user travel preferences (one row per user).
CREATE TABLE IF NOT EXISTS travel.preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  home_airport text,
  cabin_class text DEFAULT 'ECONOMY',
  max_stops int DEFAULT 2,
  preferred_airlines text[] DEFAULT '{}',
  preferred_hotel_chains text[] DEFAULT '{}',
  hotel_min_rating int DEFAULT 3,
  currency text DEFAULT 'USD',
  notify_email boolean DEFAULT true,
  notify_sms boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

-- Loyalty programs / memberships.
CREATE TABLE IF NOT EXISTS travel.loyalty_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,            -- air | hotel | car | rail | credit_card
  program_name text NOT NULL,
  member_number text,
  tier text,
  points_balance numeric,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Trips being planned / booked.
CREATE TABLE IF NOT EXISTS travel.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  origin text,
  destination text,
  depart_date date,
  return_date date,
  travelers int DEFAULT 1,
  status text DEFAULT 'planning',    -- planning | booked | completed
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Price watches → notify when the fare/rate drops to a target.
CREATE TABLE IF NOT EXISTS travel.price_watches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,                -- flight | hotel
  origin text,
  destination text,
  depart_date date,
  return_date date,
  cabin text,
  adults int DEFAULT 1,
  target_price numeric,
  last_price numeric,
  last_checked timestamptz,
  active boolean DEFAULT true,
  notify boolean DEFAULT true,
  notified_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE travel.preferences      ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel.loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel.trips            ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel.price_watches    ENABLE ROW LEVEL SECURITY;

-- RLS: users only see their own rows.
CREATE POLICY "travel_prefs_all"   ON travel.preferences      FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "travel_loyalty_all" ON travel.loyalty_programs FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "travel_trips_all"   ON travel.trips            FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "travel_watches_all" ON travel.price_watches    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

GRANT USAGE ON SCHEMA travel TO authenticated, service_role;
GRANT ALL ON travel.preferences      TO authenticated, service_role;
GRANT ALL ON travel.loyalty_programs TO authenticated, service_role;
GRANT ALL ON travel.trips            TO authenticated, service_role;
GRANT ALL ON travel.price_watches    TO authenticated, service_role;
