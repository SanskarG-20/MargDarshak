-- ============================================================
-- Fix RLS policies for per-user isolation
-- ============================================================
--
-- PROBLEM:
-- The existing RLS policies are too permissive:
--   - users table: using (true) — any user can read/modify ANY row
--   - All other tables: user_id in (select id from users) — matches ALL users
--
-- SOLUTION:
-- Use a session variable approach with a set_app_user() function.
-- The client calls this RPC at connection time to identify the user.
-- RLS policies then check this session variable.
--
-- For Clerk-only auth (no Supabase Auth), this is the most practical
-- approach. When Supabase Auth is added later, policies can be upgraded
-- to use auth.uid() directly.
-- ============================================================

-- 1. Create function to set the current user in the session
CREATE OR REPLACE FUNCTION set_app_user(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_user_id', user_uuid::text, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop all existing permissive policies

-- Users
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can insert own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;

-- Trips
DROP POLICY IF EXISTS "Users can read own trips" ON trips;
DROP POLICY IF EXISTS "Users can insert own trips" ON trips;
DROP POLICY IF EXISTS "Users can delete own trips" ON trips;

-- AI History
DROP POLICY IF EXISTS "Users can read own ai_history" ON ai_history;
DROP POLICY IF EXISTS "Users can insert own ai_history" ON ai_history;

-- Intents
DROP POLICY IF EXISTS "Users can read own intents" ON intents;
DROP POLICY IF EXISTS "Users can insert own intents" ON intents;
DROP POLICY IF EXISTS "Users can delete own intents" ON intents;

-- Environment Logs
DROP POLICY IF EXISTS "Users can read own env_logs" ON environment_logs;
DROP POLICY IF EXISTS "Users can insert own env_logs" ON environment_logs;

-- Saved Trips
DROP POLICY IF EXISTS "Users can read own saved_trips" ON saved_trips;
DROP POLICY IF EXISTS "Users can insert own saved_trips" ON saved_trips;
DROP POLICY IF EXISTS "Users can delete own saved_trips" ON saved_trips;

-- User Preferences
DROP POLICY IF EXISTS "Users can read own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;

-- SOS Logs
DROP POLICY IF EXISTS "Users can read own sos_logs" ON sos_logs;
DROP POLICY IF EXISTS "Users can insert own sos_logs" ON sos_logs;

-- 3. Create proper per-user policies

-- Helper: check if the session user matches the row's user_id
-- Uses app.current_user_id set by set_app_user() RPC

-- Users
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (id::text = current_setting('app.current_user_id', true));

CREATE POLICY "Users can insert own data" ON users
  FOR INSERT WITH CHECK (id::text = current_setting('app.current_user_id', true));

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (id::text = current_setting('app.current_user_id', true));

-- Trips
CREATE POLICY "Users can read own trips" ON trips
  FOR SELECT USING (user_id::text = current_setting('app.current_user_id', true));

CREATE POLICY "Users can insert own trips" ON trips
  FOR INSERT WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

CREATE POLICY "Users can delete own trips" ON trips
  FOR DELETE USING (user_id::text = current_setting('app.current_user_id', true));

-- AI History
CREATE POLICY "Users can read own ai_history" ON ai_history
  FOR SELECT USING (user_id::text = current_setting('app.current_user_id', true));

CREATE POLICY "Users can insert own ai_history" ON ai_history
  FOR INSERT WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

-- Intents
CREATE POLICY "Users can read own intents" ON intents
  FOR SELECT USING (user_id::text = current_setting('app.current_user_id', true));

CREATE POLICY "Users can insert own intents" ON intents
  FOR INSERT WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

CREATE POLICY "Users can delete own intents" ON intents
  FOR DELETE USING (user_id::text = current_setting('app.current_user_id', true));

-- Environment Logs
CREATE POLICY "Users can read own env_logs" ON environment_logs
  FOR SELECT USING (user_id::text = current_setting('app.current_user_id', true));

CREATE POLICY "Users can insert own env_logs" ON environment_logs
  FOR INSERT WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

-- Saved Trips
CREATE POLICY "Users can read own saved_trips" ON saved_trips
  FOR SELECT USING (user_id::text = current_setting('app.current_user_id', true));

CREATE POLICY "Users can insert own saved_trips" ON saved_trips
  FOR INSERT WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

CREATE POLICY "Users can delete own saved_trips" ON saved_trips
  FOR DELETE USING (user_id::text = current_setting('app.current_user_id', true));

-- User Preferences
CREATE POLICY "Users can read own preferences" ON user_preferences
  FOR SELECT USING (user_id::text = current_setting('app.current_user_id', true));

CREATE POLICY "Users can insert own preferences" ON user_preferences
  FOR INSERT WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

CREATE POLICY "Users can update own preferences" ON user_preferences
  FOR UPDATE USING (user_id::text = current_setting('app.current_user_id', true));

-- SOS Logs
CREATE POLICY "Users can read own sos_logs" ON sos_logs
  FOR SELECT USING (user_id::text = current_setting('app.current_user_id', true));

CREATE POLICY "Users can insert own sos_logs" ON sos_logs
  FOR INSERT WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

-- 4. Grant execute permission on set_app_user to authenticated role
GRANT EXECUTE ON FUNCTION set_app_user(UUID) TO anon;
GRANT EXECUTE ON FUNCTION set_app_user(UUID) TO authenticated;
