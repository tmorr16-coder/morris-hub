-- ============================================================
-- Health Tier 2: cardio metrics + macro nutrients
-- Columns were added to code in Phase 1 but migrations never ran.
-- Safe to re-run (ADD COLUMN IF NOT EXISTS).
-- ============================================================

-- ── workout_sessions: cardio performance columns ──────────────
ALTER TABLE workout_sessions
  ADD COLUMN IF NOT EXISTS pace_min_per_mile NUMERIC(5,2),  -- e.g. 9.5 = 9:30/mile
  ADD COLUMN IF NOT EXISTS hr_avg            INT;           -- average BPM

-- ── meals: macro nutrient columns ────────────────────────────
ALTER TABLE meals
  ADD COLUMN IF NOT EXISTS protein_g NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS carbs_g   NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS fat_g     NUMERIC(6,1);
