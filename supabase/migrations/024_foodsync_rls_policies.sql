-- FoodSync v2 — Migration 014 (local: 024)
-- RLS para tablas nuevas del blueprint

ALTER TABLE public.business_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "business_units_read_internal" ON business_units;
CREATE POLICY "business_units_read_internal" ON business_units FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid()
      AND role IN ('superadmin', 'admin', 'operator', 'warehouse', 'kitchen')
  ));

DROP POLICY IF EXISTS "business_units_modify_admin" ON business_units;
CREATE POLICY "business_units_modify_admin" ON business_units FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid() AND role IN ('superadmin', 'admin')
  ));

ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sites_access_internal" ON sites;
CREATE POLICY "sites_access_internal" ON sites FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM users
    WHERE auth_id = auth.uid()
      AND role IN ('superadmin', 'admin', 'operator', 'warehouse', 'kitchen')
  ));

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppliers_access" ON suppliers;
CREATE POLICY "suppliers_access" ON suppliers FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM users
    WHERE auth_id = auth.uid()
      AND role IN ('superadmin', 'admin', 'operator', 'warehouse')
  ));

ALTER TABLE public.inventory_lots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_lots_access" ON inventory_lots;
CREATE POLICY "inventory_lots_access" ON inventory_lots FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users u
    JOIN sites s ON s.id = inventory_lots.site_id
    WHERE u.auth_id = auth.uid()
      AND u.role IN ('superadmin', 'admin', 'operator', 'warehouse', 'kitchen')
      AND u.organization_id = s.organization_id
  ));

ALTER TABLE public.production_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "production_tickets_access" ON production_tickets;
CREATE POLICY "production_tickets_access" ON production_tickets FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid()
      AND role IN ('superadmin', 'admin', 'operator', 'kitchen', 'warehouse')
  ));

ALTER TABLE public.production_lot_consumption ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plc_access" ON production_lot_consumption;
CREATE POLICY "plc_access" ON production_lot_consumption FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid()
      AND role IN ('superadmin', 'admin', 'kitchen', 'warehouse')
  ));

ALTER TABLE public.order_form_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_form_tokens_admin" ON order_form_tokens;
CREATE POLICY "order_form_tokens_admin" ON order_form_tokens FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid() AND role IN ('superadmin', 'admin')
  ));

ALTER TABLE public.order_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_sections_access" ON order_sections;
CREATE POLICY "order_sections_access" ON order_sections FOR ALL
  USING (EXISTS (
    SELECT 1 FROM orders o
    JOIN users u ON (u.organization_id = o.organization_id
                     OR u.role IN ('superadmin', 'admin'))
    WHERE o.id = order_sections.order_id
      AND u.auth_id = auth.uid()
  ));

ALTER TABLE public.order_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_participants_access" ON order_participants;
CREATE POLICY "order_participants_access" ON order_participants FOR ALL
  USING (EXISTS (
    SELECT 1 FROM orders o
    JOIN users u ON (u.organization_id = o.organization_id
                     OR u.role IN ('superadmin', 'admin'))
    WHERE o.id = order_participants.order_id
      AND u.auth_id = auth.uid()
  ));

ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "communications_admin_all" ON communications;
CREATE POLICY "communications_admin_all" ON communications FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid() AND role IN ('superadmin', 'admin', 'operator')
  ));

DROP POLICY IF EXISTS "communications_client_own" ON communications;
CREATE POLICY "communications_client_own" ON communications FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid()
      AND role IN ('client_admin', 'client_user')
      AND organization_id = communications.organization_id
  ));

ALTER TABLE public.communication_threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "threads_admin_all" ON communication_threads;
CREATE POLICY "threads_admin_all" ON communication_threads FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid() AND role IN ('superadmin', 'admin', 'operator')
  ));

DROP POLICY IF EXISTS "threads_client_own" ON communication_threads;
CREATE POLICY "threads_client_own" ON communication_threads FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid()
      AND role IN ('client_admin', 'client_user')
      AND organization_id = communication_threads.organization_id
  ));

ALTER TABLE public.communication_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "templates_read_internal" ON communication_templates;
CREATE POLICY "templates_read_internal" ON communication_templates FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid()
  ));

DROP POLICY IF EXISTS "templates_modify_admin" ON communication_templates;
CREATE POLICY "templates_modify_admin" ON communication_templates FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid() AND role IN ('superadmin', 'admin')
  ));

DROP POLICY IF EXISTS "templates_update_admin" ON communication_templates;
CREATE POLICY "templates_update_admin" ON communication_templates FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid() AND role IN ('superadmin', 'admin')
  ));

DROP POLICY IF EXISTS "templates_delete_admin" ON communication_templates;
CREATE POLICY "templates_delete_admin" ON communication_templates FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid() AND role IN ('superadmin', 'admin')
  ));
