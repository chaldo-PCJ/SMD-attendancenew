-- ============================================================
-- 1. COPY THIS ENTIRE SCRIPT
-- 2. GO TO: https://supabase.com/dashboard/project/fhcrlsbszsietmvtzaby/sql/new
-- 3. PASTE AND RUN
-- ============================================================

-- Create penalty_log table to track all penalty deductions
CREATE TABLE IF NOT EXISTS public.penalty_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  classroom TEXT NOT NULL,
  penalty_type TEXT NOT NULL CHECK (penalty_type IN ('late', 'uniform', 'hair', 'nail')),
  points_deducted INTEGER NOT NULL,
  reason TEXT,
  recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_penalty_log_student_id ON public.penalty_log(student_id);
CREATE INDEX IF NOT EXISTS idx_penalty_log_classroom ON public.penalty_log(classroom);
CREATE INDEX IF NOT EXISTS idx_penalty_log_recorded_date ON public.penalty_log(recorded_date);
CREATE INDEX IF NOT EXISTS idx_penalty_log_penalty_type ON public.penalty_log(penalty_type);

-- Enable Row Level Security
ALTER TABLE public.penalty_log ENABLE ROW LEVEL SECURITY;

-- Clean up old policies (safe to re-run)
DROP POLICY IF EXISTS "authenticated_users_can_select_penalty_log" ON public.penalty_log;
DROP POLICY IF EXISTS "authenticated_users_can_insert_penalty_log" ON public.penalty_log;
DROP POLICY IF EXISTS "admins_can_update_penalty_log" ON public.penalty_log;
DROP POLICY IF EXISTS "admins_can_delete_penalty_log" ON public.penalty_log;

-- 1. SELECT: Everyone (including anon/students) can read penalty log
CREATE POLICY "authenticated_users_can_select_penalty_log"
ON public.penalty_log
FOR SELECT
TO authenticated, anon
USING (true);

-- 2. INSERT: All authenticated users can insert penalty log (when saving attendance/uniform check)
CREATE POLICY "authenticated_users_can_insert_penalty_log"
ON public.penalty_log
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 3. UPDATE: Only admin can update penalty log
CREATE POLICY "admins_can_update_penalty_log"
ON public.penalty_log
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

-- 4. DELETE: Only admin can delete penalty log
CREATE POLICY "admins_can_delete_penalty_log"
ON public.penalty_log
FOR DELETE
TO authenticated
USING (
  auth.email() = 'admin_md@smd.com'
  OR auth.email() ILIKE 'admin_%@smd.com'
);

-- No sequence grant needed for UUID primary key
