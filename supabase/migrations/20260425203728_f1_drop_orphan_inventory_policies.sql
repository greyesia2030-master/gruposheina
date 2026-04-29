-- Restored from supabase_migrations.schema_migrations via MCP
-- Filename: 20260425203728_f1_drop_orphan_inventory_policies
-- Source of truth: live BD (project zenlpuiaavdgeyplfcma)

-- F.1: Eliminar policies que llaman a is_admin() inexistente

DROP POLICY IF EXISTS "Admin: CRUD de inventario" ON inventory_items;
DROP POLICY IF EXISTS "Admin: crear movimientos" ON inventory_movements;
DROP POLICY IF EXISTS "Admin: ver movimientos" ON inventory_movements;
