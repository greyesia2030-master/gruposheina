-- 004: Row Level Security (RLS) Policies
-- Sistema de Gestión de Viandas — Grupo Sheina
--
-- Estrategia:
--   - Superadmin/Admin: acceso total a todas las filas
--   - Client (client_admin, client_user): solo ven datos de su organización
--   - Las tablas append-only (events, movements) no permiten UPDATE/DELETE

-- ===== Habilitar RLS en todas las tablas =====
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- ===== Helper: obtener el user record desde auth.uid() =====
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_current_user_org_id()
RETURNS UUID AS $$
  SELECT organization_id FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT get_current_user_role() IN ('superadmin', 'admin', 'operator');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ===== ORGANIZATIONS =====
CREATE POLICY "Admin: acceso total a organizaciones"
  ON organizations FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Cliente: ver solo su organización"
  ON organizations FOR SELECT
  USING (id = get_current_user_org_id());

-- ===== USERS =====
CREATE POLICY "Admin: acceso total a usuarios"
  ON users FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Cliente: ver usuarios de su organización"
  ON users FOR SELECT
  USING (organization_id = get_current_user_org_id());

CREATE POLICY "Usuario: actualizar su propio perfil"
  ON users FOR UPDATE
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

-- ===== WEEKLY MENUS (visibles para todos los autenticados) =====
CREATE POLICY "Admin: CRUD de menús"
  ON weekly_menus FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Autenticado: ver menús publicados"
  ON weekly_menus FOR SELECT
  USING (status = 'published' OR is_admin());

-- ===== MENU ITEMS =====
CREATE POLICY "Admin: CRUD de opciones de menú"
  ON menu_items FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Autenticado: ver opciones de menú"
  ON menu_items FOR SELECT
  USING (true); -- Todos los autenticados ven las opciones

-- ===== RECIPES =====
CREATE POLICY "Admin: CRUD de recetas"
  ON recipes FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Autenticado: ver recetas activas"
  ON recipes FOR SELECT
  USING (is_active = true OR is_admin());

-- ===== RECIPE VERSIONS =====
CREATE POLICY "Admin: CRUD de versiones"
  ON recipe_versions FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Autenticado: ver versiones"
  ON recipe_versions FOR SELECT
  USING (true);

-- ===== RECIPE INGREDIENTS =====
CREATE POLICY "Admin: CRUD de ingredientes"
  ON recipe_ingredients FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Autenticado: ver ingredientes"
  ON recipe_ingredients FOR SELECT
  USING (true);

-- ===== ORDERS =====
CREATE POLICY "Admin: acceso total a pedidos"
  ON orders FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Cliente: ver pedidos de su organización"
  ON orders FOR SELECT
  USING (organization_id = get_current_user_org_id());

CREATE POLICY "Cliente: crear pedidos para su organización"
  ON orders FOR INSERT
  WITH CHECK (organization_id = get_current_user_org_id());

CREATE POLICY "Cliente: modificar sus pedidos en draft"
  ON orders FOR UPDATE
  USING (organization_id = get_current_user_org_id() AND status = 'draft')
  WITH CHECK (organization_id = get_current_user_org_id());

-- ===== ORDER LINES =====
CREATE POLICY "Admin: acceso total a líneas"
  ON order_lines FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Cliente: ver líneas de sus pedidos"
  ON order_lines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_lines.order_id
      AND orders.organization_id = get_current_user_org_id()
    )
  );

CREATE POLICY "Cliente: modificar líneas de sus pedidos draft"
  ON order_lines FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_lines.order_id
      AND orders.organization_id = get_current_user_org_id()
      AND orders.status = 'draft'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_lines.order_id
      AND orders.organization_id = get_current_user_org_id()
      AND orders.status = 'draft'
    )
  );

-- ===== ORDER EVENTS (append-only: solo INSERT, sin UPDATE/DELETE) =====
CREATE POLICY "Admin: ver todos los eventos"
  ON order_events FOR SELECT
  USING (is_admin());

CREATE POLICY "Admin: crear eventos"
  ON order_events FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Sistema: crear eventos"
  ON order_events FOR INSERT
  WITH CHECK (actor_role IN ('system', 'bot'));

CREATE POLICY "Cliente: ver eventos de sus pedidos"
  ON order_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_events.order_id
      AND orders.organization_id = get_current_user_org_id()
    )
  );

-- ===== INVENTORY ITEMS =====
CREATE POLICY "Admin: CRUD de inventario"
  ON inventory_items FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Inventario no es visible para clientes (solo admin/operador)

-- ===== INVENTORY MOVEMENTS (append-only) =====
CREATE POLICY "Admin: ver movimientos"
  ON inventory_movements FOR SELECT
  USING (is_admin());

CREATE POLICY "Admin: crear movimientos"
  ON inventory_movements FOR INSERT
  WITH CHECK (is_admin());
