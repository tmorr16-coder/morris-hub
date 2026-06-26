-- Career profile migration
-- Adds career_profile and career_advisor_messages to the career schema

-- career_profile: one row per user, stores background docs, assessment, and interests
CREATE TABLE IF NOT EXISTS career.career_profile (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Current role
  current_title text,
  current_company text,
  years_experience integer,
  industry text,
  -- Grounding documents
  resume_text text,              -- pasted resume or extracted from PDF
  linkedin_url text,
  linkedin_bio text,             -- pasted LinkedIn summary/about section
  portfolio_urls text[] DEFAULT '{}',
  other_context text,            -- any additional context
  -- Assessment
  assessment_completed boolean DEFAULT false,
  assessment_responses jsonb DEFAULT '{}',   -- { q1: value, q2: value, ... }
  career_profile_summary text,   -- AI-generated summary from assessment
  -- Career interests
  career_interests text[] DEFAULT '{}',
  target_roles text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE career.career_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "career_profile_select" ON career.career_profile
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "career_profile_insert" ON career.career_profile
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "career_profile_update" ON career.career_profile
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "career_profile_delete" ON career.career_profile
  FOR DELETE USING (user_id = auth.uid());

GRANT ALL ON career.career_profile TO authenticated, service_role;

-- career_advisor_messages: stores chat history with the AI career advisor
CREATE TABLE IF NOT EXISTS career.career_advisor_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,           -- user | assistant
  content text NOT NULL,
  suggestions jsonb,            -- structured action suggestions from AI
  created_at timestamptz DEFAULT now()
);

ALTER TABLE career.career_advisor_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "career_advisor_messages_select" ON career.career_advisor_messages
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "career_advisor_messages_insert" ON career.career_advisor_messages
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "career_advisor_messages_update" ON career.career_advisor_messages
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "career_advisor_messages_delete" ON career.career_advisor_messages
  FOR DELETE USING (user_id = auth.uid());

GRANT ALL ON career.career_advisor_messages TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
