-- ============================================================
-- LSAT Prep Module
-- All tables live in the student_support schema alongside
-- existing course/reminder tables.  auth.users provides the
-- user identity — no separate users table needed.
-- ============================================================

-- ── LSAT enabled flag on student_settings ────────────────────
ALTER TABLE student_support.student_settings
  ADD COLUMN IF NOT EXISTS lsat_enabled      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lsat_target_score INT;

-- ── Question taxonomy ─────────────────────────────────────────
CREATE TABLE student_support.lsat_question_types (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section     TEXT NOT NULL CHECK (section IN ('LR','RC','WRITING')),
  category    TEXT NOT NULL,    -- e.g. 'Assumption', 'Strengthen'
  subcategory TEXT,             -- e.g. 'Necessary', 'Sufficient'
  description TEXT,
  UNIQUE (section, category, subcategory)
);

-- ── Reading passages (RC only) ────────────────────────────────
CREATE TABLE student_support.lsat_passages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source       TEXT,            -- provenance string
  passage_type TEXT,            -- 'Comparative','Science','Law','Humanities'
  body         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Questions ─────────────────────────────────────────────────
CREATE TABLE student_support.lsat_questions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id     UUID NOT NULL REFERENCES student_support.lsat_question_types(id),
  passage_id  UUID REFERENCES student_support.lsat_passages(id),  -- NULL for LR
  source      TEXT,             -- 'PrepTest 73/S2/Q14' or 'AI-generated'
  stem        TEXT NOT NULL,
  difficulty  SMALLINT CHECK (difficulty BETWEEN 1 AND 5),
  is_official BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Answer choices (A–E) ──────────────────────────────────────
CREATE TABLE student_support.lsat_answer_choices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES student_support.lsat_questions(id) ON DELETE CASCADE,
  label       CHAR(1) NOT NULL CHECK (label IN ('A','B','C','D','E')),
  body        TEXT NOT NULL,
  is_correct  BOOLEAN NOT NULL DEFAULT false,
  trap_type   TEXT CHECK (trap_type IN (
                'out_of_scope','too_strong','reverses_logic','half_right',
                'true_but_irrelevant','opposite','premise_restatement',
                'unsupported_comparison')),
  UNIQUE (question_id, label)
);

-- ── Practice sessions ─────────────────────────────────────────
CREATE TABLE student_support.lsat_practice_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode          TEXT NOT NULL CHECK (mode IN ('drill','timed_section','full_mock','blind_review')),
  section       TEXT CHECK (section IN ('LR','RC','WRITING')),  -- NULL for full_mock
  is_timed      BOOLEAN NOT NULL DEFAULT false,
  time_limit_s  INT,    -- e.g. 2100 for 35-min section
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at      TIMESTAMPTZ
);

-- ── Attempts (core fact table) ────────────────────────────────
CREATE TABLE student_support.lsat_attempts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID NOT NULL REFERENCES student_support.lsat_practice_sessions(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id),  -- denormalized for fast analytics
  question_id         UUID NOT NULL REFERENCES student_support.lsat_questions(id),
  selected_choice_id  UUID REFERENCES student_support.lsat_answer_choices(id),  -- NULL if skipped
  is_correct          BOOLEAN NOT NULL,
  confidence          SMALLINT CHECK (confidence BETWEEN 1 AND 5),  -- captured at answer time
  time_spent_s        INT,
  flagged             BOOLEAN NOT NULL DEFAULT false,  -- marked for blind review
  answered_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Review notes (blind review, created after the attempt) ────
CREATE TABLE student_support.lsat_review_notes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id     UUID NOT NULL UNIQUE REFERENCES student_support.lsat_attempts(id) ON DELETE CASCADE,
  user_note      TEXT,         -- Maya's own reflection
  ai_explanation TEXT,         -- personalized AI walkthrough
  error_pattern  TEXT,         -- e.g. 'misread_stem','fell_for_strong_language'
  reviewed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes (hot query paths) ─────────────────────────────────
CREATE INDEX lsat_attempts_user_question ON student_support.lsat_attempts(user_id, question_id);
CREATE INDEX lsat_attempts_session       ON student_support.lsat_attempts(session_id);
CREATE INDEX lsat_attempts_flagged       ON student_support.lsat_attempts(user_id, flagged) WHERE flagged = true;
CREATE INDEX lsat_questions_type         ON student_support.lsat_questions(type_id);
CREATE INDEX lsat_choices_question       ON student_support.lsat_answer_choices(question_id);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE student_support.lsat_practice_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_support.lsat_attempts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_support.lsat_review_notes       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_sessions"     ON student_support.lsat_practice_sessions USING (auth.uid() = user_id);
CREATE POLICY "own_attempts"     ON student_support.lsat_attempts           USING (auth.uid() = user_id);
CREATE POLICY "own_review_notes" ON student_support.lsat_review_notes       USING (
  EXISTS (SELECT 1 FROM student_support.lsat_attempts a WHERE a.id = attempt_id AND a.user_id = auth.uid())
);

-- Questions/types/passages/choices are read-only catalog data (no RLS)
GRANT SELECT ON student_support.lsat_question_types   TO authenticated, anon;
GRANT SELECT ON student_support.lsat_passages         TO authenticated, anon;
GRANT SELECT ON student_support.lsat_questions        TO authenticated, anon;
GRANT SELECT ON student_support.lsat_answer_choices   TO authenticated, anon;
GRANT ALL    ON student_support.lsat_practice_sessions TO authenticated;
GRANT ALL    ON student_support.lsat_attempts          TO authenticated;
GRANT ALL    ON student_support.lsat_review_notes      TO authenticated;

-- ── Seed: LSAT question type taxonomy ────────────────────────
INSERT INTO student_support.lsat_question_types (section, category, subcategory, description) VALUES
  -- Logical Reasoning
  ('LR','Assumption','Necessary','Find the assumption the argument requires to be valid'),
  ('LR','Assumption','Sufficient','Find an assumption that, if true, makes the conclusion certain'),
  ('LR','Strengthen',NULL,'Find evidence that strengthens the argument'),
  ('LR','Weaken',NULL,'Find evidence that undermines or weakens the argument'),
  ('LR','Flaw',NULL,'Identify the logical error or flaw in the argument'),
  ('LR','Inference',NULL,'Determine what must or can be true based on the statements'),
  ('LR','Main Point',NULL,'Identify the main conclusion of the argument'),
  ('LR','Method of Reasoning',NULL,'Describe how the argument makes its point'),
  ('LR','Role of Statement',NULL,'Identify the role a specific statement plays'),
  ('LR','Point at Issue',NULL,'Identify what two speakers disagree about'),
  ('LR','Parallel Reasoning',NULL,'Find an argument with the same logical structure'),
  ('LR','Principle','Apply','Apply a general principle to a specific case'),
  ('LR','Principle','Identify','Identify the principle underlying an argument'),
  ('LR','Resolve','NULL','Find information that resolves an apparent contradiction'),
  ('LR','Complete the Argument',NULL,'Choose the statement that best completes the argument'),
  -- Reading Comprehension
  ('RC','Main Point',NULL,'Identify the central idea of the passage'),
  ('RC','Inference',NULL,'Determine what can be inferred from the passage'),
  ('RC','Purpose',NULL,'Identify the author''s purpose or tone'),
  ('RC','Detail',NULL,'Locate specific information from the passage'),
  ('RC','Organization',NULL,'Describe how the passage is structured'),
  ('RC','Analogy',NULL,'Find a situation analogous to one in the passage'),
  ('RC','Application',NULL,'Apply information from the passage to a new situation')
ON CONFLICT (section, category, subcategory) DO NOTHING;

-- ── Seed: One sample LR question (Strengthen) ─────────────────
DO $$
DECLARE
  qtype_id UUID;
  q_id     UUID;
BEGIN
  SELECT id INTO qtype_id FROM student_support.lsat_question_types WHERE section='LR' AND category='Strengthen';

  INSERT INTO student_support.lsat_questions (type_id, source, stem, difficulty, is_official)
  VALUES (
    qtype_id,
    'Sample',
    E'Medical researchers have discovered that people who regularly eat fish have a significantly lower rate of heart disease than people who rarely or never eat fish. The researchers concluded that eating fish reduces the risk of heart disease.\n\nWhich of the following, if true, most strengthens the researchers'' conclusion?',
    2,
    false
  ) RETURNING id INTO q_id;

  INSERT INTO student_support.lsat_answer_choices (question_id, label, body, is_correct, trap_type) VALUES
    (q_id, 'A', 'Many people who eat fish also engage in other heart-healthy behaviors such as regular exercise.', false, 'half_right'),
    (q_id, 'B', 'People who eat fish tend to have lower levels of saturated fat in their diets overall.', false, 'half_right'),
    (q_id, 'C', 'When people who rarely eat fish begin eating fish regularly, their rate of heart disease decreases.', true, NULL),
    (q_id, 'D', 'The rate of heart disease varies significantly across different countries and cultures.', false, 'out_of_scope'),
    (q_id, 'E', 'Heart disease is the leading cause of death in countries where fish consumption is low.', false, 'true_but_irrelevant');
END $$;

-- ── Seed: One sample LR question (Assumption – Necessary) ─────
DO $$
DECLARE
  qtype_id UUID;
  q_id     UUID;
BEGIN
  SELECT id INTO qtype_id FROM student_support.lsat_question_types WHERE section='LR' AND category='Assumption' AND subcategory='Necessary';

  INSERT INTO student_support.lsat_questions (type_id, source, stem, difficulty, is_official)
  VALUES (
    qtype_id,
    'Sample',
    E'The city council should reject the proposed downtown development plan. Studies show that similar developments in other cities have increased traffic congestion by 40 percent, and our city''s infrastructure simply cannot handle additional strain.\n\nThe argument above assumes which of the following?',
    3,
    false
  ) RETURNING id INTO q_id;

  INSERT INTO student_support.lsat_answer_choices (question_id, label, body, is_correct, trap_type) VALUES
    (q_id, 'A', 'Traffic congestion is the only problem caused by downtown development.', false, 'too_strong'),
    (q_id, 'B', 'The proposed development would result in traffic increases similar to those in the studied cities.', true, NULL),
    (q_id, 'C', 'The city council has previously rejected downtown development plans.', false, 'out_of_scope'),
    (q_id, 'D', 'No other improvements to the city''s infrastructure are planned.', false, 'out_of_scope'),
    (q_id, 'E', 'Downtown development always causes traffic congestion in cities of any size.', false, 'too_strong');
END $$;

-- ── Seed: One sample LR question (Weaken) ─────────────────────
DO $$
DECLARE
  qtype_id UUID;
  q_id     UUID;
BEGIN
  SELECT id INTO qtype_id FROM student_support.lsat_question_types WHERE section='LR' AND category='Weaken';

  INSERT INTO student_support.lsat_questions (type_id, source, stem, difficulty, is_official)
  VALUES (
    qtype_id,
    'Sample',
    E'A university study found that students who participate in extracurricular activities have higher grade point averages than those who do not. The university concluded that participation in extracurricular activities improves academic performance.\n\nWhich of the following, if true, most weakens the university''s conclusion?',
    2,
    false
  ) RETURNING id INTO q_id;

  INSERT INTO student_support.lsat_answer_choices (question_id, label, body, is_correct, trap_type) VALUES
    (q_id, 'A', 'Some extracurricular activities require a minimum GPA for participation.', true, NULL),
    (q_id, 'B', 'Students who participate in extracurricular activities report higher levels of satisfaction with college life.', false, 'out_of_scope'),
    (q_id, 'C', 'The university has a wide variety of extracurricular activities available.', false, 'out_of_scope'),
    (q_id, 'D', 'Students who participate in multiple activities have higher GPAs than those in only one activity.', false, 'half_right'),
    (q_id, 'E', 'Academic performance is measured differently across departments.', false, 'true_but_irrelevant');
END $$;

NOTIFY pgrst, 'reload schema';
