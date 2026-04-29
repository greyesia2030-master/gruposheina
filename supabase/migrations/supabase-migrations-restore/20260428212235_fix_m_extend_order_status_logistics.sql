-- Restored from supabase_migrations.schema_migrations via MCP
-- Filename: 20260428212235_fix_m_extend_order_status_logistics
-- Source of truth: live BD (project zenlpuiaavdgeyplfcma)

-- FIX-M: agregar estados intermedios de logística entre producción y entrega
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'ready_for_delivery' AFTER 'in_production';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'out_for_delivery' AFTER 'ready_for_delivery';
