-- Restored from supabase_migrations.schema_migrations via MCP
-- Filename: 20260425203750_f1_create_is_admin_function
-- Source of truth: live BD (project zenlpuiaavdgeyplfcma)

-- F.1: Crear función is_admin() que faltaba

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE auth_id = auth.uid() AND role IN ('superadmin', 'admin')
  );
$$;

COMMENT ON FUNCTION is_admin() IS 'Retorna true si el usuario autenticado actual tiene rol superadmin o admin';

NOTIFY pgrst, 'reload schema';
