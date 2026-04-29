-- Restored from supabase_migrations.schema_migrations via MCP
-- Filename: 20260427195856_d6_fix_quantity_constraint_for_overrides
-- Source of truth: live BD (project zenlpuiaavdgeyplfcma)

-- D.6 hotfix: permitir quantity negativa SOLO para líneas is_admin_override

ALTER TABLE public.order_lines DROP CONSTRAINT order_lines_quantity_check;

ALTER TABLE public.order_lines ADD CONSTRAINT order_lines_quantity_check 
  CHECK ((is_admin_override = true) OR (quantity >= 0));

COMMENT ON CONSTRAINT order_lines_quantity_check ON public.order_lines IS
  'Las líneas de participantes deben tener quantity >= 0. Las líneas de admin_override pueden ser negativas para representar reducciones del consolidado. Suma final por (day, option) DEBE ser >= 0 (validado en server action applyAdminOverride).';
