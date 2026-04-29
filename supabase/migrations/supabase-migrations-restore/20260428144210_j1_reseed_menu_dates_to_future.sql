-- Restored from supabase_migrations.schema_migrations via MCP
-- Filename: 20260428144210_j1_reseed_menu_dates_to_future
-- Source of truth: live BD (project zenlpuiaavdgeyplfcma)

-- Reseed fechas de menús a futuras (4 mayo y 11 mayo 2026)

UPDATE weekly_menus
SET week_start = '2026-05-04', week_end = '2026-05-08', week_number = 19
WHERE id = 'f0000000-0000-0000-0000-000000000001';

UPDATE weekly_menus
SET week_start = '2026-05-11', week_end = '2026-05-15', week_number = 20
WHERE id = 'f0000000-0000-0000-0000-000000000002';

UPDATE orders
SET order_code = generate_order_code(organization_id, week_label, created_at, menu_id)
WHERE menu_id IN (
  'f0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000002'
);

UPDATE orders o
SET custom_cutoff_at = (
  SELECT (wm.week_start - (org.cutoff_days_before || ' days')::interval + org.cutoff_time::interval) AT TIME ZONE org.timezone
  FROM weekly_menus wm, organizations org
  WHERE wm.id = o.menu_id AND org.id = o.organization_id
)
WHERE o.menu_id IN (
  'f0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000002'
)
AND o.status NOT IN ('delivered', 'cancelled');
