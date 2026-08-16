-- Trip tracking: an itinerary of segments per trip, plus the alert schedule
-- that drives flight check-in reminders.
--
-- travel.trips already existed as a planning stub (name, dates, status). This
-- adds the pieces needed to actually track a trip you've booked: what's in it,
-- and what we owe you a nudge about.

-- Where the trip came from, and a stable dedupe key for re-imports.
ALTER TABLE travel.trips ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';        -- manual | import | booking
ALTER TABLE travel.trips ADD COLUMN IF NOT EXISTS import_hash text;                    -- dedupes a re-pasted confirmation
ALTER TABLE travel.trips ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- One row per thing that happens on a trip: a flight, a hotel stay, a car, an
-- activity. Times are absolute (timestamptz) with the local zone kept alongside
-- so an itinerary can render in the time zone the traveler will be standing in.
CREATE TABLE IF NOT EXISTS travel.trip_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES travel.trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,                  -- flight | hotel | car | rail | activity | note
  title text,                          -- "Delta 30" / "Hotel Ganivet" / "Pickup — Hertz"
  confirmation_code text,
  start_at timestamptz,                -- departure / check-in / pickup
  end_at timestamptz,                  -- arrival / check-out / drop-off
  start_tz text,                       -- IANA zone for start_at, when known
  end_tz text,
  origin text,                         -- IATA or city, for flights/rail/car
  destination text,
  location text,                       -- address / city, for hotels & activities
  carrier text,                        -- airline, hotel chain, rental company
  number text,                         -- flight number, room, reservation number
  seat text,
  terminal text,
  travelers int DEFAULT 1,
  price numeric,
  currency text DEFAULT 'USD',
  notes text,
  source text DEFAULT 'manual',        -- manual | import | booking
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trip_segments_trip_idx ON travel.trip_segments(trip_id, start_at);
CREATE INDEX IF NOT EXISTS trip_segments_user_start_idx ON travel.trip_segments(user_id, start_at);

-- Scheduled nudges. One row per (segment, kind) so the cron is idempotent:
-- it sends what is due and unsent, and never twice.
CREATE TABLE IF NOT EXISTS travel.trip_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id uuid NOT NULL REFERENCES travel.trips(id) ON DELETE CASCADE,
  segment_id uuid REFERENCES travel.trip_segments(id) ON DELETE CASCADE,
  kind text NOT NULL,                  -- checkin | departure_day | leave_for_airport | hotel_checkin | trip_tomorrow
  send_at timestamptz NOT NULL,
  sent_at timestamptz,
  channel text,                        -- email | sms (what actually went out)
  title text,
  body text,
  created_at timestamptz DEFAULT now()
);

-- The cron's working query: everything due and not yet sent.
CREATE INDEX IF NOT EXISTS trip_alerts_due_idx ON travel.trip_alerts(send_at) WHERE sent_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS trip_alerts_unique_idx ON travel.trip_alerts(segment_id, kind) WHERE segment_id IS NOT NULL;

-- Per-user switches for the trip nudges (the price-watch toggles already live
-- in travel.preferences and stay separate).
ALTER TABLE travel.preferences ADD COLUMN IF NOT EXISTS notify_checkin boolean DEFAULT true;
ALTER TABLE travel.preferences ADD COLUMN IF NOT EXISTS notify_trip_summary boolean DEFAULT true;

-- ── RLS ────────────────────────────────────────────────────────────────
ALTER TABLE travel.trip_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel.trip_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own segments" ON travel.trip_segments;
CREATE POLICY "own segments" ON travel.trip_segments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own alerts" ON travel.trip_alerts;
CREATE POLICY "own alerts" ON travel.trip_alerts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Grants ─────────────────────────────────────────────────────────────
-- Tables in a non-public schema start with no privileges for the API roles, so
-- without these every query fails with "permission denied for table" before RLS
-- is ever consulted. The default privileges line covers whatever is added to
-- this schema next.
GRANT USAGE ON SCHEMA travel TO authenticated, service_role;
GRANT ALL ON travel.trip_segments TO authenticated, service_role;
GRANT ALL ON travel.trip_alerts   TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA travel
  GRANT ALL ON TABLES TO authenticated, service_role;
