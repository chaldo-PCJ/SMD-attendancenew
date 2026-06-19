-- ============================================================
-- 1. COPY THIS ENTIRE SCRIPT
-- 2. GO TO: https://supabase.com/dashboard/project/fhcrlsbszsietmvtzaby/sql/new
-- 3. PASTE AND RUN
-- ============================================================

-- Create late_penalty_settings table
CREATE TABLE IF NOT EXISTS public.late_penalty_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  late_threshold INTEGER NOT NULL DEFAULT 3,
  penalty_points INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default row if table is empty
INSERT INTO public.late_penalty_settings (late_threshold, penalty_points)
SELECT 3, 5
WHERE NOT EXISTS (SELECT 1 FROM public.late_penalty_settings);

-- Enable Row Level Security
ALTER TABLE public.late_penalty_settings ENABLE ROW LEVEL SECURITY;

-- Clean up old policies (safe to re-run)
DROP POLICY IF EXISTS "authenticated_users_can_select_late_penalty_settings" ON public.late_penalty_settings;
DROP POLICY IF EXISTS "admins_can_insert_late_penalty_settings" ON public.late_penalty_settings;
DROP POLICY IF EXISTS "admins_can_update_late_penalty_settings" ON public.late_penalty_settings;
DROP POLICY IF EXISTS "admins_can_delete_late_penalty_settings" ON public.late_penalty_settings;

-- 1. SELECT: Everyone (including anon/students) can read settings
CREATE POLICY "authenticated_users_can_select_late_penalty_settings"
ON public.late_penalty_settings
FOR SELECT
TO authenticated, anon
USING (true);

-- 2. INSERT: Only admin can insert settings
CREATE POLICY "admins_can_insert_late_penalty_settings"
ON public.late_penalty_settings
FOR INSERT
TO authenticated
WITH CHECK (
  auth.email() = 'admin_md@smd.com'
  OR auth.email() ILIKE 'admin_%@smd.com'
);

-- 3. UPDATE: Only admin can update settings
CREATE POLICY "admins_can_update_late_penalty_settings"
ON public.late_penalty_settings
FOR UPDATE
TO authenticated
USING (
  auth.email() = 'admin_md@smd.com'
  OR auth.email() ILIKE 'admin_%@smd.com'
)
WITH CHECK (
  auth.email() = 'admin_md@smd.com'
  OR auth.email() ILIKE 'admin_%@smd.com'
);

-- 4. DELETE: Only admin can delete settings
CREATE POLICY "admins_can_delete_late_penalty_settings"
ON public.late_penalty_settings
FOR DELETE
TO authenticated
USING (
  auth.email() = 'admin_md@smd.com'
  OR auth.email() ILIKE 'admin_%@smd.com'
);

-- No sequence grant needed for UUID primary key
