-- Restored from supabase_migrations.schema_migrations via MCP
-- Filename: 20260425171444_b10_client_departments
-- Source of truth: live BD (project zenlpuiaavdgeyplfcma)

-- B.10: Modelo de departamentos por cliente

CREATE TABLE IF NOT EXISTS client_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  expected_participants INTEGER DEFAULT 1 CHECK (expected_participants >= 0),
  authorized_emails TEXT[] DEFAULT '{}',
  authorized_phones TEXT[] DEFAULT '{}',
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_client_dept_name UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_client_departments_org ON client_departments(organization_id, is_active);

COMMENT ON TABLE client_departments IS 'Departamentos preconfigurados por cliente, reutilizables en múltiples pedidos';
COMMENT ON COLUMN client_departments.expected_participants IS 'Cantidad esperada de personas que van a cargar viandas en este depto';
COMMENT ON COLUMN client_departments.authorized_emails IS 'Whitelist de emails autorizados a cargar pedido en este depto';

ALTER TABLE order_sections 
  ADD COLUMN IF NOT EXISTS client_department_id UUID REFERENCES client_departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expected_participants INTEGER DEFAULT 0;

COMMENT ON COLUMN order_sections.client_department_id IS 'Si la sección fue creada desde un departamento configurado del cliente';
COMMENT ON COLUMN order_sections.expected_participants IS 'Snapshot de la cantidad esperada al crear el pedido';

ALTER TABLE client_departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_departments_admin_all ON client_departments;
CREATE POLICY client_departments_admin_all ON client_departments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('superadmin', 'admin')));

DROP POLICY IF EXISTS client_departments_self_org ON client_departments;
CREATE POLICY client_departments_self_org ON client_departments
  FOR ALL TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE auth_id = auth.uid() AND role IN ('client_admin', 'client_user')
  ));

CREATE TABLE IF NOT EXISTS client_department_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID REFERENCES client_departments(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('created', 'updated', 'deleted', 'activated', 'deactivated', 'emails_added', 'emails_removed')),
  actor_id UUID REFERENCES users(id),
  actor_role VARCHAR(50),
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_dept_events_dept ON client_department_events(department_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_dept_events_org ON client_department_events(organization_id, created_at DESC);

ALTER TABLE client_department_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_dept_events_admin_read ON client_department_events;
CREATE POLICY client_dept_events_admin_read ON client_department_events
  FOR SELECT TO authenticated USING (true);
