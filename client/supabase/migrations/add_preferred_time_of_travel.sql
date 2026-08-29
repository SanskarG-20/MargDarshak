-- Add preferred_time_of_travel column to user_preferences
-- This column is referenced in personalizationService.js but was missing from the schema.
-- Safe to run multiple times (uses IF NOT EXISTS).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_preferences' AND column_name = 'preferred_time_of_travel'
  ) THEN
    ALTER TABLE user_preferences
      ADD COLUMN preferred_time_of_travel SMALLINT
      CHECK (preferred_time_of_travel IS NULL OR (preferred_time_of_travel BETWEEN 0 AND 23));
  END IF;
END $$;
