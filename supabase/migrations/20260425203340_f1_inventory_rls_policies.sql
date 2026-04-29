-- Restored from supabase_migrations.schema_migrations via MCP
-- Filename: 20260425203340_f1_inventory_rls_policies
-- Source of truth: live BD (project zenlpuiaavdgeyplfcma)

-- F.1: RLS policies para inventory_items y inventory_movements

CREATE POLICY inventory_items_admin_all ON inventory_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('superadmin', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('superadmin', 'admin')));

CREATE POLICY inventory_items_staff_read ON inventory_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('kitchen', 'warehouse', 'superadmin', 'admin')));

CREATE POLICY inventory_movements_admin_all ON inventory_movements
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('superadmin', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('superadmin', 'admin')));

CREATE POLICY inventory_movements_staff_rw ON inventory_movements
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('kitchen', 'warehouse', 'superadmin', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('kitchen', 'warehouse', 'superadmin', 'admin')));
