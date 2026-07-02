-- ============================================================
-- Household and Personal modes: shopping, household goals, meal
-- planning (shared/family), mental wellness + journal (private).
-- Safe to re-run (IF NOT EXISTS + DROP POLICY IF EXISTS)
-- ============================================================

-- ── Shopping list — one running household checklist ────────────
CREATE TABLE IF NOT EXISTS hub.shopping_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item           TEXT NOT NULL,
  quantity       TEXT,
  checked        BOOLEAN NOT NULL DEFAULT FALSE,
  added_by       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE hub.shopping_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "circle reads shopping items" ON hub.shopping_items;
DROP POLICY IF EXISTS "circle manages shopping items" ON hub.shopping_items;
CREATE POLICY "circle reads shopping items" ON hub.shopping_items FOR SELECT USING (
  circle_owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM hub.family_members fm
    WHERE fm.user_id = shopping_items.circle_owner_id AND fm.member_user_id = auth.uid()
  )
);
CREATE POLICY "circle manages shopping items" ON hub.shopping_items FOR ALL USING (
  circle_owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM hub.family_members fm
    WHERE fm.user_id = shopping_items.circle_owner_id AND fm.member_user_id = auth.uid()
  )
) WITH CHECK (
  circle_owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM hub.family_members fm
    WHERE fm.user_id = shopping_items.circle_owner_id AND fm.member_user_id = auth.uid()
  )
);
GRANT ALL ON hub.shopping_items TO authenticated, service_role;

-- ── Household goals ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hub.household_goals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  description    TEXT,
  target_date    DATE,
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_by     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at   TIMESTAMPTZ
);
ALTER TABLE hub.household_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "circle reads household goals" ON hub.household_goals;
DROP POLICY IF EXISTS "circle manages household goals" ON hub.household_goals;
CREATE POLICY "circle reads household goals" ON hub.household_goals FOR SELECT USING (
  circle_owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM hub.family_members fm
    WHERE fm.user_id = household_goals.circle_owner_id AND fm.member_user_id = auth.uid()
  )
);
CREATE POLICY "circle manages household goals" ON hub.household_goals FOR ALL USING (
  circle_owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM hub.family_members fm
    WHERE fm.user_id = household_goals.circle_owner_id AND fm.member_user_id = auth.uid()
  )
) WITH CHECK (
  circle_owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM hub.family_members fm
    WHERE fm.user_id = household_goals.circle_owner_id AND fm.member_user_id = auth.uid()
  )
);
GRANT ALL ON hub.household_goals TO authenticated, service_role;

-- ── Meal plan — shared weekly "what's for dinner", distinct from
-- health.meals (the private personal nutrition log) ────────────
CREATE TABLE IF NOT EXISTS hub.meal_plan (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date           DATE NOT NULL,
  meal_type      TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  name           TEXT NOT NULL,
  notes          TEXT,
  created_by     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE hub.meal_plan ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "circle reads meal plan" ON hub.meal_plan;
DROP POLICY IF EXISTS "circle manages meal plan" ON hub.meal_plan;
CREATE POLICY "circle reads meal plan" ON hub.meal_plan FOR SELECT USING (
  circle_owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM hub.family_members fm
    WHERE fm.user_id = meal_plan.circle_owner_id AND fm.member_user_id = auth.uid()
  )
);
CREATE POLICY "circle manages meal plan" ON hub.meal_plan FOR ALL USING (
  circle_owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM hub.family_members fm
    WHERE fm.user_id = meal_plan.circle_owner_id AND fm.member_user_id = auth.uid()
  )
) WITH CHECK (
  circle_owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM hub.family_members fm
    WHERE fm.user_id = meal_plan.circle_owner_id AND fm.member_user_id = auth.uid()
  )
);
GRANT ALL ON hub.meal_plan TO authenticated, service_role;

-- ── Mental wellness — always private, mirrors every other health
-- table's RLS (user_id = auth.uid() only, no sharing) ───────────
CREATE TABLE IF NOT EXISTS wellness_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  mood        SMALLINT CHECK (mood BETWEEN 1 AND 5),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)
);
ALTER TABLE wellness_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users manage own wellness entries" ON wellness_entries;
CREATE POLICY "users manage own wellness entries" ON wellness_entries
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT ALL ON wellness_entries TO authenticated, service_role;

-- ── Journal — always private, no sharing mechanism, ever ────────
CREATE TABLE IF NOT EXISTS hub.journal_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT,
  content     TEXT NOT NULL,
  mood        SMALLINT CHECK (mood BETWEEN 1 AND 5),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE hub.journal_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users manage own journal entries" ON hub.journal_entries;
CREATE POLICY "users manage own journal entries" ON hub.journal_entries
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT ALL ON hub.journal_entries TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
