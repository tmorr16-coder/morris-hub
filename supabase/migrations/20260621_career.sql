-- Career schema migration
-- Creates tables for career goals, milestones, notes, experiences, relationships, interactions, and learning

CREATE SCHEMA IF NOT EXISTS career;

-- career_goals
CREATE TABLE IF NOT EXISTS career.career_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  why text,
  success_criteria text,
  category text DEFAULT 'career',
  horizon text DEFAULT 'medium',
  target_date date,
  start_date date DEFAULT CURRENT_DATE,
  status text DEFAULT 'active',
  color_tag text DEFAULT '#3B5C7F',
  progress_pct integer DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE career.career_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "career_goals_select" ON career.career_goals
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "career_goals_insert" ON career.career_goals
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "career_goals_update" ON career.career_goals
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "career_goals_delete" ON career.career_goals
  FOR DELETE USING (user_id = auth.uid());

GRANT USAGE ON SCHEMA career TO authenticated, service_role;
GRANT ALL ON career.career_goals TO authenticated, service_role;

-- career_milestones
CREATE TABLE IF NOT EXISTS career.career_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES career.career_goals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  target_date date,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE career.career_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "career_milestones_select" ON career.career_milestones
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "career_milestones_insert" ON career.career_milestones
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "career_milestones_update" ON career.career_milestones
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "career_milestones_delete" ON career.career_milestones
  FOR DELETE USING (user_id = auth.uid());

GRANT ALL ON career.career_milestones TO authenticated, service_role;

-- career_goal_notes
CREATE TABLE IF NOT EXISTS career.career_goal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES career.career_goals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  note_type text DEFAULT 'reflection',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE career.career_goal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "career_goal_notes_select" ON career.career_goal_notes
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "career_goal_notes_insert" ON career.career_goal_notes
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "career_goal_notes_update" ON career.career_goal_notes
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "career_goal_notes_delete" ON career.career_goal_notes
  FOR DELETE USING (user_id = auth.uid());

GRANT ALL ON career.career_goal_notes TO authenticated, service_role;

-- career_experiences
CREATE TABLE IF NOT EXISTS career.career_experiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  experience_date date DEFAULT CURRENT_DATE,
  experience_type text DEFAULT 'project',
  reflection text,
  impact text,
  skills_developed text[] DEFAULT '{}',
  linked_goal_ids uuid[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE career.career_experiences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "career_experiences_select" ON career.career_experiences
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "career_experiences_insert" ON career.career_experiences
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "career_experiences_update" ON career.career_experiences
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "career_experiences_delete" ON career.career_experiences
  FOR DELETE USING (user_id = auth.uid());

GRANT ALL ON career.career_experiences TO authenticated, service_role;

-- career_relationships
CREATE TABLE IF NOT EXISTS career.career_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  organization text,
  relationship_type text DEFAULT 'mentor',
  notes text,
  meeting_frequency text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE career.career_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "career_relationships_select" ON career.career_relationships
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "career_relationships_insert" ON career.career_relationships
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "career_relationships_update" ON career.career_relationships
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "career_relationships_delete" ON career.career_relationships
  FOR DELETE USING (user_id = auth.uid());

GRANT ALL ON career.career_relationships TO authenticated, service_role;

-- career_interactions
CREATE TABLE IF NOT EXISTS career.career_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id uuid NOT NULL REFERENCES career.career_relationships(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interaction_date date DEFAULT CURRENT_DATE,
  interaction_type text DEFAULT '1on1',
  notes text,
  insights text,
  action_items text[] DEFAULT '{}',
  linked_goal_ids uuid[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE career.career_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "career_interactions_select" ON career.career_interactions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "career_interactions_insert" ON career.career_interactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "career_interactions_update" ON career.career_interactions
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "career_interactions_delete" ON career.career_interactions
  FOR DELETE USING (user_id = auth.uid());

GRANT ALL ON career.career_interactions TO authenticated, service_role;

-- career_learning
CREATE TABLE IF NOT EXISTS career.career_learning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  learning_type text DEFAULT 'course',
  provider text,
  start_date date,
  end_date date,
  status text DEFAULT 'planned',
  cert_exam_id uuid,
  linked_goal_ids uuid[] DEFAULT '{}',
  notes text,
  url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE career.career_learning ENABLE ROW LEVEL SECURITY;

CREATE POLICY "career_learning_select" ON career.career_learning
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "career_learning_insert" ON career.career_learning
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "career_learning_update" ON career.career_learning
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "career_learning_delete" ON career.career_learning
  FOR DELETE USING (user_id = auth.uid());

GRANT ALL ON career.career_learning TO authenticated, service_role;
