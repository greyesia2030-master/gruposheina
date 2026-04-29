-- Restored from supabase_migrations.schema_migrations via MCP
-- Filename: 20260429000945_fix_m_extend_event_type_enum
-- Source of truth: live BD (project zenlpuiaavdgeyplfcma)

-- Agregar event_types de logística
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'ready_for_delivery' AFTER 'confirmed';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'dispatched' AFTER 'ready_for_delivery';
