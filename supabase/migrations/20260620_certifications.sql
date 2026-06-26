-- Migration: 20260620_certifications.sql
-- Creates certification exam prep tables in the student_support schema

-- Ensure schema exists
CREATE SCHEMA IF NOT EXISTS student_support;

-- Grant usage on schema
GRANT USAGE ON SCHEMA student_support TO authenticated;

-- ============================================================
-- cert_exams
-- ============================================================
CREATE TABLE IF NOT EXISTS student_support.cert_exams (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name               text        NOT NULL,
  vendor             text,
  exam_code          text,
  description        text,
  target_exam_date   date,
  passing_score_pct  integer     DEFAULT 70,
  color_tag          text        DEFAULT '#3B5C7F',
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

ALTER TABLE student_support.cert_exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cert_exams_select" ON student_support.cert_exams
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "cert_exams_insert" ON student_support.cert_exams
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "cert_exams_update" ON student_support.cert_exams
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "cert_exams_delete" ON student_support.cert_exams
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- cert_domains
-- ============================================================
CREATE TABLE IF NOT EXISTS student_support.cert_domains (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id     uuid        NOT NULL REFERENCES student_support.cert_exams(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  weight_pct  integer     DEFAULT 0,
  description text,
  sort_order  integer     DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE student_support.cert_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cert_domains_select" ON student_support.cert_domains
  FOR SELECT USING (
    exam_id IN (
      SELECT id FROM student_support.cert_exams WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "cert_domains_insert" ON student_support.cert_domains
  FOR INSERT WITH CHECK (
    exam_id IN (
      SELECT id FROM student_support.cert_exams WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "cert_domains_update" ON student_support.cert_domains
  FOR UPDATE USING (
    exam_id IN (
      SELECT id FROM student_support.cert_exams WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "cert_domains_delete" ON student_support.cert_domains
  FOR DELETE USING (
    exam_id IN (
      SELECT id FROM student_support.cert_exams WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- cert_materials
-- ============================================================
CREATE TABLE IF NOT EXISTS student_support.cert_materials (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id        uuid        NOT NULL REFERENCES student_support.cert_exams(id) ON DELETE CASCADE,
  type           text        DEFAULT 'url',
  title          text        NOT NULL,
  url            text,
  extracted_text text,
  file_name      text,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE student_support.cert_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cert_materials_select" ON student_support.cert_materials
  FOR SELECT USING (
    exam_id IN (
      SELECT id FROM student_support.cert_exams WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "cert_materials_insert" ON student_support.cert_materials
  FOR INSERT WITH CHECK (
    exam_id IN (
      SELECT id FROM student_support.cert_exams WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "cert_materials_update" ON student_support.cert_materials
  FOR UPDATE USING (
    exam_id IN (
      SELECT id FROM student_support.cert_exams WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "cert_materials_delete" ON student_support.cert_materials
  FOR DELETE USING (
    exam_id IN (
      SELECT id FROM student_support.cert_exams WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- cert_questions
-- ============================================================
CREATE TABLE IF NOT EXISTS student_support.cert_questions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id     uuid        NOT NULL REFERENCES student_support.cert_exams(id) ON DELETE CASCADE,
  domain_id   uuid        REFERENCES student_support.cert_domains(id) ON DELETE SET NULL,
  stem        text        NOT NULL,
  explanation text,
  difficulty  integer     DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
  source      text        DEFAULT 'ai_generated',
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE student_support.cert_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cert_questions_select" ON student_support.cert_questions
  FOR SELECT USING (
    exam_id IN (
      SELECT id FROM student_support.cert_exams WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "cert_questions_insert" ON student_support.cert_questions
  FOR INSERT WITH CHECK (
    exam_id IN (
      SELECT id FROM student_support.cert_exams WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "cert_questions_update" ON student_support.cert_questions
  FOR UPDATE USING (
    exam_id IN (
      SELECT id FROM student_support.cert_exams WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "cert_questions_delete" ON student_support.cert_questions
  FOR DELETE USING (
    exam_id IN (
      SELECT id FROM student_support.cert_exams WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- cert_choices
-- ============================================================
CREATE TABLE IF NOT EXISTS student_support.cert_choices (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid    NOT NULL REFERENCES student_support.cert_questions(id) ON DELETE CASCADE,
  label       text    NOT NULL,
  body        text    NOT NULL,
  is_correct  boolean DEFAULT false,
  UNIQUE (question_id, label)
);

ALTER TABLE student_support.cert_choices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cert_choices_select" ON student_support.cert_choices
  FOR SELECT USING (
    question_id IN (
      SELECT id FROM student_support.cert_questions
      WHERE exam_id IN (
        SELECT id FROM student_support.cert_exams WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "cert_choices_insert" ON student_support.cert_choices
  FOR INSERT WITH CHECK (
    question_id IN (
      SELECT id FROM student_support.cert_questions
      WHERE exam_id IN (
        SELECT id FROM student_support.cert_exams WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "cert_choices_update" ON student_support.cert_choices
  FOR UPDATE USING (
    question_id IN (
      SELECT id FROM student_support.cert_questions
      WHERE exam_id IN (
        SELECT id FROM student_support.cert_exams WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "cert_choices_delete" ON student_support.cert_choices
  FOR DELETE USING (
    question_id IN (
      SELECT id FROM student_support.cert_questions
      WHERE exam_id IN (
        SELECT id FROM student_support.cert_exams WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================================
-- cert_sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS student_support.cert_sessions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_id        uuid        NOT NULL REFERENCES student_support.cert_exams(id) ON DELETE CASCADE,
  domain_id      uuid        REFERENCES student_support.cert_domains(id) ON DELETE SET NULL,
  mode           text        DEFAULT 'practice',
  question_count integer     DEFAULT 10,
  time_limit_s   integer,
  started_at     timestamptz DEFAULT now(),
  ended_at       timestamptz
);

ALTER TABLE student_support.cert_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cert_sessions_select" ON student_support.cert_sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "cert_sessions_insert" ON student_support.cert_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "cert_sessions_update" ON student_support.cert_sessions
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "cert_sessions_delete" ON student_support.cert_sessions
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- cert_attempts
-- ============================================================
CREATE TABLE IF NOT EXISTS student_support.cert_attempts (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         uuid        NOT NULL REFERENCES student_support.cert_sessions(id) ON DELETE CASCADE,
  user_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id        uuid        NOT NULL REFERENCES student_support.cert_questions(id) ON DELETE CASCADE,
  selected_choice_id uuid        REFERENCES student_support.cert_choices(id) ON DELETE SET NULL,
  is_correct         boolean,
  time_spent_s       integer,
  answered_at        timestamptz DEFAULT now()
);

ALTER TABLE student_support.cert_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cert_attempts_select" ON student_support.cert_attempts
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "cert_attempts_insert" ON student_support.cert_attempts
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "cert_attempts_update" ON student_support.cert_attempts
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "cert_attempts_delete" ON student_support.cert_attempts
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- Grants to authenticated role
-- ============================================================
GRANT ALL ON student_support.cert_exams     TO authenticated;
GRANT ALL ON student_support.cert_domains   TO authenticated;
GRANT ALL ON student_support.cert_materials TO authenticated;
GRANT ALL ON student_support.cert_questions TO authenticated;
GRANT ALL ON student_support.cert_choices   TO authenticated;
GRANT ALL ON student_support.cert_sessions  TO authenticated;
GRANT ALL ON student_support.cert_attempts  TO authenticated;
