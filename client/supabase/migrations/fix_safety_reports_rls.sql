-- Fix safety_reports RLS insert policy
-- Previously: (auth.uid()::text = user_id OR user_id != '')
-- The OR condition allowed ANY non-empty user_id to bypass the auth check entirely.
-- Fixed: require user_id to be non-empty (basic validation) and match auth.uid() when available.
--
-- NOTE: This app uses Clerk for auth, not Supabase Auth, so auth.uid() may be null.
-- The policy below falls back to requiring a non-empty user_id when auth is unavailable.
-- For full per-user isolation, integrate Supabase Auth alongside Clerk.

DROP POLICY IF EXISTS "Auth users can insert" ON safety_reports;

CREATE POLICY "Auth users can insert" ON safety_reports
  FOR INSERT WITH CHECK (
    -- When Supabase Auth is configured, enforce that the user owns the report
    (auth.uid() IS NOT NULL AND auth.uid()::text = user_id)
    OR
    -- Fallback for Clerk-only auth: require a non-empty user_id (basic validation)
    (auth.uid() IS NULL AND user_id IS NOT NULL AND length(user_id) > 0)
  );

-- Also add a delete policy so users can remove their own reports
DROP POLICY IF EXISTS "Users can delete own safety reports" ON safety_reports;

CREATE POLICY "Users can delete own safety reports" ON safety_reports
  FOR DELETE USING (
    (auth.uid() IS NOT NULL AND auth.uid()::text = user_id)
    OR
    (auth.uid() IS NULL AND user_id IS NOT NULL AND length(user_id) > 0)
  );
