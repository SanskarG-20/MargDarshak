-- Personalization Engine schema updates
-- Safe to run multiple times

-- Track extra behavior signals in ai_history
ALTER TABLE IF EXISTS ai_history
  ADD COLUMN IF NOT EXISTS detected_mode TEXT,
  ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS travel_hour SMALLINT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'ai_history' AND column_name = 'travel_hour'
  ) THEN
    BEGIN
      ALTER TABLE ai_history
        ADD CONSTRAINT ai_history_travel_hour_check
        CHECK (travel_hour IS NULL OR (travel_hour BETWEEN 0 AND 23));
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- Track extra behavior signals in saved_trips
ALTER TABLE IF EXISTS saved_trips
  ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS travel_hour SMALLINT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'saved_trips' AND column_name = 'travel_hour'
  ) THEN
    BEGIN
      ALTER TABLE saved_trips
        ADD CONSTRAINT saved_trips_travel_hour_check
        CHECK (travel_hour IS NULL OR (travel_hour BETWEEN 0 AND 23));
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- User-level personalization profile
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  preferred_modes JSONB NOT NULL DEFAULT '{}'::jsonb,
  avg_budget NUMERIC(10,2),
  safety_priority NUMERIC(4,3) NOT NULL DEFAULT 0.5 CHECK (safety_priority BETWEEN 0 AND 1),
  eco_priority NUMERIC(4,3) NOT NULL DEFAULT 0.5 CHECK (eco_priority BETWEEN 0 AND 1),
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;

CREATE POLICY "Users can read own preferences" ON user_preferences
  FOR SELECT USING (user_id IN (SELECT id FROM users));

CREATE POLICY "Users can insert own preferences" ON user_preferences
  FOR INSERT WITH CHECK (user_id IN (SELECT id FROM users));

CREATE POLICY "Users can update own preferences" ON user_preferences
  FOR UPDATE USING (user_id IN (SELECT id FROM users));

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
