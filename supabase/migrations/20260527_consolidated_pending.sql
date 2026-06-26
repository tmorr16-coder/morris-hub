-- ============================================================
-- CONSOLIDATED PENDING MIGRATIONS — run this once in the
-- Supabase SQL Editor if any of these features aren't working:
--   • Investments page (investment_categories error)
--   • Grade tracker
--   • Study schedule
--   • Course sharing
-- All statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- so it's safe to run even if some parts already exist.
-- ============================================================

-- ── 1. Investment ideas ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS hub.investment_ideas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category         TEXT NOT NULL CHECK (category IN ('stocks','real_estate','transportation','tech','other')),
  title            TEXT NOT NULL,
  rationale        TEXT,
  risk_level       TEXT CHECK (risk_level IS NULL OR risk_level IN ('low','medium','high')),
  time_horizon     TEXT CHECK (time_horizon IS NULL OR time_horizon IN ('short','medium','long')),
  capital_required TEXT,
  expected_returns TEXT,
  related_assets   TEXT[],
  action_items     TEXT[],
  is_ai_generated  BOOLEAN DEFAULT FALSE,
  source           TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user','claude')),
  rating           INTEGER CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
  status           TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','researching','pursuing','passed')),
  is_favorite      BOOLEAN DEFAULT FALSE,
  user_notes       TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investment_ideas_user_id    ON hub.investment_ideas(user_id);
CREATE INDEX IF NOT EXISTS idx_investment_ideas_category   ON hub.investment_ideas(category);
CREATE INDEX IF NOT EXISTS idx_investment_ideas_status     ON hub.investment_ideas(status);
CREATE INDEX IF NOT EXISTS idx_investment_ideas_is_favorite ON hub.investment_ideas(is_favorite);

ALTER TABLE hub.investment_ideas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'investment_ideas' AND policyname = 'Users can view their own investment ideas'
  ) THEN
    CREATE POLICY "Users can view their own investment ideas"
      ON hub.investment_ideas FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'investment_ideas' AND policyname = 'Users can create their own investment ideas'
  ) THEN
    CREATE POLICY "Users can create their own investment ideas"
      ON hub.investment_ideas FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'investment_ideas' AND policyname = 'Users can update their own investment ideas'
  ) THEN
    CREATE POLICY "Users can update their own investment ideas"
      ON hub.investment_ideas FOR UPDATE
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'investment_ideas' AND policyname = 'Users can delete their own investment ideas'
  ) THEN
    CREATE POLICY "Users can delete their own investment ideas"
      ON hub.investment_ideas FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Add investment_categories to preferences (fixes the "column not found" error)
ALTER TABLE hub.preferences
  ADD COLUMN IF NOT EXISTS investment_categories TEXT[]
  DEFAULT '{"stocks","real_estate","transportation","tech","other"}'::text[];

-- ── 2. Course sharing ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS student_support.course_shares (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id            UUID NOT NULL REFERENCES student_support.courses(id) ON DELETE CASCADE,
  owner_user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_grades         BOOLEAN NOT NULL DEFAULT TRUE,
  share_assignments    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, shared_with_user_id)
);

CREATE INDEX IF NOT EXISTS course_shares_owner_idx
  ON student_support.course_shares(owner_user_id);
CREATE INDEX IF NOT EXISTS course_shares_recipient_idx
  ON student_support.course_shares(shared_with_user_id);

-- ── 3. Grade components ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS student_support.grade_components (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id       UUID NOT NULL REFERENCES student_support.courses(id) ON DELETE CASCADE,
  category        TEXT NOT NULL,          -- e.g. "Homework", "Midterm", "Final"
  weight          NUMERIC(5,2) NOT NULL,  -- percentage, e.g. 30.00
  points_earned   NUMERIC(8,2),           -- null until graded
  points_possible NUMERIC(8,2),           -- null until graded
  notes           TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS grade_components_course_idx
  ON student_support.grade_components(course_id, user_id);

ALTER TABLE student_support.grade_components ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'grade_components' AND policyname = 'grade_components: read own'
  ) THEN
    CREATE POLICY "grade_components: read own" ON student_support.grade_components
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'grade_components' AND policyname = 'grade_components: insert own'
  ) THEN
    CREATE POLICY "grade_components: insert own" ON student_support.grade_components
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'grade_components' AND policyname = 'grade_components: update own'
  ) THEN
    CREATE POLICY "grade_components: update own" ON student_support.grade_components
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'grade_components' AND policyname = 'grade_components: delete own'
  ) THEN
    CREATE POLICY "grade_components: delete own" ON student_support.grade_components
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 4. Study schedule ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS student_support.course_schedules (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id  UUID NOT NULL REFERENCES student_support.courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, user_id)
);

CREATE INDEX IF NOT EXISTS course_schedules_course_idx
  ON student_support.course_schedules(course_id, user_id);

CREATE TABLE IF NOT EXISTS student_support.schedule_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id      UUID NOT NULL REFERENCES student_support.course_schedules(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  item_type        TEXT NOT NULL DEFAULT 'study'
                   CHECK (item_type IN ('study','reading','review','assignment','exam','quiz','practice','other')),
  scheduled_date   DATE,
  duration_minutes INTEGER,
  is_completed     BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at     TIMESTAMPTZ,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS schedule_items_schedule_idx
  ON student_support.schedule_items(schedule_id, sort_order);

ALTER TABLE student_support.course_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_support.schedule_items   ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'course_schedules' AND policyname = 'course_schedules: read own'
  ) THEN
    CREATE POLICY "course_schedules: read own" ON student_support.course_schedules
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'course_schedules' AND policyname = 'course_schedules: insert own'
  ) THEN
    CREATE POLICY "course_schedules: insert own" ON student_support.course_schedules
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'course_schedules' AND policyname = 'course_schedules: update own'
  ) THEN
    CREATE POLICY "course_schedules: update own" ON student_support.course_schedules
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'course_schedules' AND policyname = 'course_schedules: delete own'
  ) THEN
    CREATE POLICY "course_schedules: delete own" ON student_support.course_schedules
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'schedule_items' AND policyname = 'schedule_items: read via schedule'
  ) THEN
    CREATE POLICY "schedule_items: read via schedule" ON student_support.schedule_items
      FOR SELECT USING (
        schedule_id IN (
          SELECT id FROM student_support.course_schedules WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'schedule_items' AND policyname = 'schedule_items: insert via schedule'
  ) THEN
    CREATE POLICY "schedule_items: insert via schedule" ON student_support.schedule_items
      FOR INSERT WITH CHECK (
        schedule_id IN (
          SELECT id FROM student_support.course_schedules WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'schedule_items' AND policyname = 'schedule_items: update via schedule'
  ) THEN
    CREATE POLICY "schedule_items: update via schedule" ON student_support.schedule_items
      FOR UPDATE USING (
        schedule_id IN (
          SELECT id FROM student_support.course_schedules WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'schedule_items' AND policyname = 'schedule_items: delete via schedule'
  ) THEN
    CREATE POLICY "schedule_items: delete via schedule" ON student_support.schedule_items
      FOR DELETE USING (
        schedule_id IN (
          SELECT id FROM student_support.course_schedules WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── 5. Extended student_settings columns ────────────────────

ALTER TABLE student_support.student_settings
  ADD COLUMN IF NOT EXISTS phone_number              TEXT,
  ADD COLUMN IF NOT EXISTS sms_notifications_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS reminder_lead_days        INTEGER DEFAULT 3
    CHECK (reminder_lead_days BETWEEN 1 AND 7);

CREATE INDEX IF NOT EXISTS student_settings_phone_idx
  ON student_support.student_settings(phone_number)
  WHERE phone_number IS NOT NULL;

-- ── 6. Research chat tables ─────────────────────────────────

CREATE TABLE IF NOT EXISTS student_support.research_chat_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id  UUID NOT NULL REFERENCES student_support.courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS research_chat_sessions_user_idx
  ON student_support.research_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS research_chat_sessions_course_idx
  ON student_support.research_chat_sessions(course_id);

CREATE TABLE IF NOT EXISTS student_support.research_chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES student_support.research_chat_sessions(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS research_chat_messages_session_idx
  ON student_support.research_chat_messages(session_id, created_at ASC);

ALTER TABLE student_support.research_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_support.research_chat_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'research_chat_sessions' AND policyname = 'users_view_own_sessions'
  ) THEN
    CREATE POLICY "users_view_own_sessions" ON student_support.research_chat_sessions
      FOR SELECT USING (auth.uid() = user_id);
    CREATE POLICY "users_insert_own_sessions" ON student_support.research_chat_sessions
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'research_chat_messages' AND policyname = 'users_view_own_messages'
  ) THEN
    CREATE POLICY "users_view_own_messages" ON student_support.research_chat_messages
      FOR SELECT USING (
        session_id IN (
          SELECT id FROM student_support.research_chat_sessions WHERE user_id = auth.uid()
        )
      );
    CREATE POLICY "users_insert_own_messages" ON student_support.research_chat_messages
      FOR INSERT WITH CHECK (
        session_id IN (
          SELECT id FROM student_support.research_chat_sessions WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── 7. Service role grants for all new tables ───────────────

GRANT ALL ON hub.investment_ideas TO service_role;
GRANT ALL ON student_support.course_shares       TO service_role;
GRANT ALL ON student_support.grade_components    TO service_role;
GRANT ALL ON student_support.course_schedules    TO service_role;
GRANT ALL ON student_support.schedule_items      TO service_role;
GRANT ALL ON student_support.research_chat_sessions  TO service_role;
GRANT ALL ON student_support.research_chat_messages  TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON hub.investment_ideas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON student_support.course_shares       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON student_support.grade_components    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON student_support.course_schedules    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON student_support.schedule_items      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON student_support.research_chat_sessions  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON student_support.research_chat_messages  TO authenticated;
