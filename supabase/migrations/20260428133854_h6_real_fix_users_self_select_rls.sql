-- Restored from supabase_migrations.schema_migrations via MCP
-- Filename: 20260428133854_h6_real_fix_users_self_select_rls
-- Source of truth: live BD (project zenlpuiaavdgeyplfcma)

-- FIX: kitchen/warehouse expulsados a /login post-fix de force-dynamic
-- Causa: RLS policies de users no permitían SELECT propio si el user no era admin ni cliente

CREATE POLICY "Usuario: leer su propio perfil"
ON public.users
FOR SELECT
USING (auth_id = auth.uid());
