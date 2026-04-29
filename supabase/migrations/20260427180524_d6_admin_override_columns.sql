-- Restored from supabase_migrations.schema_migrations via MCP
-- Filename: 20260427180524_d6_admin_override_columns
-- Source of truth: live BD (project zenlpuiaavdgeyplfcma)

-- D.6: columnas de auditoría para override admin sobre el consolidado

ALTER TABLE public.order_lines
  ADD COLUMN IF NOT EXISTS is_admin_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_override_by uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS admin_override_reason text,
  ADD COLUMN IF NOT EXISTS admin_override_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_order_lines_admin_override 
  ON public.order_lines(order_id) 
  WHERE is_admin_override = true;

COMMENT ON COLUMN public.order_lines.is_admin_override IS 
  'true cuando la línea fue creada/editada directamente por admin sobre el consolidado, sin participante asociado';
