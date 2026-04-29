-- Restored from supabase_migrations.schema_migrations via MCP
-- Filename: 20260428212319_fix_m_add_logistics_timestamps
-- Source of truth: live BD (project zenlpuiaavdgeyplfcma)

-- FIX-M: timestamps de logística en orders

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS ready_for_delivery_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatched_at         timestamptz,
  ADD COLUMN IF NOT EXISTS dispatched_by         uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS delivered_by          uuid REFERENCES users(id);

UPDATE orders
SET ready_for_delivery_at = NOW()
WHERE id = '1cf510b8-9149-4684-a0da-276c1c14b9f7'
  AND ready_for_delivery_at IS NULL;
