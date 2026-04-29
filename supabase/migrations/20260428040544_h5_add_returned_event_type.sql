-- Restored from supabase_migrations.schema_migrations via MCP
-- Filename: 20260428040544_h5_add_returned_event_type
-- Source of truth: live BD (project zenlpuiaavdgeyplfcma)

-- Agregar event_type 'returned' para cuando Sheina devuelve un pedido al cliente para correcciones
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'returned';
