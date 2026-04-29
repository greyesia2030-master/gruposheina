-- Restored from supabase_migrations.schema_migrations via MCP
-- Filename: 20260428004848_e2_rename_cutoff_at_to_custom
-- Source of truth: live BD (project zenlpuiaavdgeyplfcma)

-- Fix design drift E.2: renombrar cutoff_at → custom_cutoff_at para coincidir con código

ALTER TABLE public.orders RENAME COLUMN cutoff_at TO custom_cutoff_at;

COMMENT ON COLUMN public.orders.custom_cutoff_at IS 
  'Cutoff específico del pedido. NULL = usar default org. Si seteado, este valor manda. Editable por admin Sheina.';
