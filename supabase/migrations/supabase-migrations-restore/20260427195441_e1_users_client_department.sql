-- Restored from supabase_migrations.schema_migrations via MCP
-- Filename: 20260427195441_e1_users_client_department
-- Source of truth: live BD (project zenlpuiaavdgeyplfcma)

-- E.1: vincular usuarios cliente a un departamento (1:N)

ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS client_department_id uuid REFERENCES public.client_departments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_client_department 
  ON public.users(client_department_id) 
  WHERE client_department_id IS NOT NULL;

COMMENT ON COLUMN public.users.client_department_id IS 
  'Depto al que pertenece el usuario cliente. NULL = client_admin ve todos los deptos de la org. Solo aplica para roles client_admin/client_user.';
