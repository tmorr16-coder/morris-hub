-- ============================================================
-- morris-bible: Supabase schema migration
-- Run in your Supabase SQL editor (or via supabase CLI)
-- ============================================================

CREATE SCHEMA IF NOT EXISTS bible;

-- ── Notes ────────────────────────────────────────────────────
CREATE TABLE bible.notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bible_id    TEXT NOT NULL DEFAULT 'de4e12af7f28f599-02',
  book_id     TEXT NOT NULL,
  chapter_num INT,
  verse_start INT,
  verse_end   INT,
  reference   TEXT NOT NULL,
  content     TEXT NOT NULL,
  tags        TEXT[] DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bible.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own notes"   ON bible.notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own notes" ON bible.notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own notes" ON bible.notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users delete own notes" ON bible.notes FOR DELETE USING (auth.uid() = user_id);

-- ── Reading Plans ─────────────────────────────────────────────
CREATE TABLE bible.reading_plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL = built-in plan
  title         TEXT NOT NULL,
  description   TEXT,
  is_ai_generated BOOLEAN DEFAULT FALSE,
  is_public     BOOLEAN DEFAULT FALSE,
  duration_days INT NOT NULL,
  -- readings: [{day:number, readings:[{bookId,chapterStart,chapterEnd,reference}]}]
  readings      JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bible.reading_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own or public plans" ON bible.reading_plans FOR SELECT
  USING (is_public = TRUE OR user_id IS NULL OR auth.uid() = user_id);
CREATE POLICY "users insert own plans" ON bible.reading_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own plans" ON bible.reading_plans FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "users delete own plans" ON bible.reading_plans FOR DELETE
  USING (auth.uid() = user_id);

-- ── User Plan Enrollment ──────────────────────────────────────
CREATE TABLE bible.user_plans (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id            UUID NOT NULL REFERENCES bible.reading_plans(id) ON DELETE CASCADE,
  started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  preferred_bible_id TEXT NOT NULL DEFAULT 'de4e12af7f28f599-02',
  UNIQUE(user_id, plan_id)
);

ALTER TABLE bible.user_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own enrollments" ON bible.user_plans
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Reading Completions ───────────────────────────────────────
CREATE TABLE bible.reading_completions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id     UUID NOT NULL REFERENCES bible.reading_plans(id) ON DELETE CASCADE,
  day_number  INT NOT NULL,
  reading_ref TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, plan_id, day_number, reading_ref)
);

ALTER TABLE bible.reading_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own completions" ON bible.reading_completions
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Platform Challenges ───────────────────────────────────────
CREATE TABLE bible.challenges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     UUID NOT NULL REFERENCES bible.reading_plans(id),
  title       TEXT NOT NULL,
  description TEXT,
  start_date  DATE NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  created_by  UUID NOT NULL REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bible.challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads active challenges" ON bible.challenges FOR SELECT
  USING (TRUE);
CREATE POLICY "admins manage challenges" ON bible.challenges
  USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

-- ── Challenge Participants ────────────────────────────────────
CREATE TABLE bible.challenge_participants (
  challenge_id UUID NOT NULL REFERENCES bible.challenges(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (challenge_id, user_id)
);

ALTER TABLE bible.challenge_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own participation" ON bible.challenge_participants
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "participants see each other" ON bible.challenge_participants FOR SELECT
  USING (TRUE);

-- ── Bookmarks ─────────────────────────────────────────────────
CREATE TABLE bible.bookmarks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bible_id    TEXT NOT NULL,
  reference   TEXT NOT NULL,
  book_id     TEXT NOT NULL,
  chapter_num INT NOT NULL,
  verse_num   INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, bible_id, reference)
);

ALTER TABLE bible.bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own bookmarks" ON bible.bookmarks
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Highlights ────────────────────────────────────────────────
CREATE TABLE bible.highlights (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bible_id   TEXT NOT NULL,
  reference  TEXT NOT NULL,
  verse_id   TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT 'yellow',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, bible_id, verse_id)
);

ALTER TABLE bible.highlights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own highlights" ON bible.highlights
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Reading streak helper view ────────────────────────────────
CREATE OR REPLACE VIEW bible.user_streaks AS
SELECT
  user_id,
  COUNT(DISTINCT DATE(completed_at)) AS total_days_read,
  MAX(DATE(completed_at)) AS last_read_date
FROM bible.reading_completions
GROUP BY user_id;
