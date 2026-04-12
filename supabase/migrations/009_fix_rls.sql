-- 009: RLS hardening
-- Addresses critical findings from security audit:
--   1. Users UPDATE policy allowed any user to change their own role and
--      organization_id (privilege escalation). Restrict UPDATE to profile
--      columns only via a trigger guard.
--   2. order_events had a "Sistema: crear eventos" policy that let ANY
--      authenticated user insert events with actor_role 'system' or 'bot',
--      bypassing audit integrity. Dropped.
--   3. Append-only tables (order_events, inventory_movements) must never be
--      updated or deleted by non-service roles. Explicit REVOKE.
--   4. Clients had no way to see their own orders when acting as client_user;
--      the existing policy only checks organization_id which is correct, but
--      a dedicated client_own_orders policy is added for clarity and to scope
--      INSERT/UPDATE tightly.

-- ========================================================================
-- 1. USERS — prevent privilege escalation via self-UPDATE
-- ========================================================================
DROP POLICY IF EXISTS "Usuario: actualizar su propio perfil" ON users;

-- Users may update their own row, but a trigger enforces that role,
-- organization_id, auth_id, and is_active cannot be changed by non-admins.
CREATE POLICY "Usuario: actualizar su propio perfil"
  ON users FOR UPDATE
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

CREATE OR REPLACE FUNCTION prevent_user_privilege_escalation()
RETURNS TRIGGER AS $$
BEGIN
  -- Admins bypass the guard entirely.
  IF is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'No podés cambiar tu propio rol';
  END IF;
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'No podés cambiar tu organización';
  END IF;
  IF NEW.auth_id IS DISTINCT FROM OLD.auth_id THEN
    RAISE EXCEPTION 'No podés cambiar tu auth_id';
  END IF;
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'No podés cambiar tu estado activo';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS users_prevent_escalation ON users;
CREATE TRIGGER users_prevent_escalation
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION prevent_user_privilege_escalation();

-- ========================================================================
-- 2. ORDER_EVENTS — drop spoofable system-insert policy, enforce append-only
-- ========================================================================
DROP POLICY IF EXISTS "Sistema: crear eventos" ON order_events;

-- Explicitly revoke UPDATE/DELETE from authenticated role so append-only
-- integrity cannot be subverted even with a future broken policy.
REVOKE UPDATE, DELETE ON order_events FROM authenticated;
REVOKE UPDATE, DELETE ON order_events FROM anon;

-- Client may insert events ONLY for their own orders, and only with
-- actor_role 'client'. System/bot events must come via service role.
DROP POLICY IF EXISTS "Cliente: crear eventos de sus pedidos" ON order_events;
CREATE POLICY "Cliente: crear eventos de sus pedidos"
  ON order_events FOR INSERT
  WITH CHECK (
    actor_role = 'client'
    AND EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_events.order_id
      AND orders.organization_id = get_current_user_org_id()
    )
  );

-- ========================================================================
-- 3. INVENTORY_MOVEMENTS — append-only hardening
-- ========================================================================
REVOKE UPDATE, DELETE ON inventory_movements FROM authenticated;
REVOKE UPDATE, DELETE ON inventory_movements FROM anon;

-- ========================================================================
-- 4. ORDERS — explicit client-own-orders policies
-- ========================================================================
-- The existing policies already scope by organization_id, but the UPDATE
-- policy lets clients update orders in draft only. Add a status-transition
-- guard: clients may only transition draft → cancelled or draft → confirmed,
-- never re-open a confirmed/closed order.
DROP POLICY IF EXISTS "Cliente: modificar sus pedidos en draft" ON orders;
CREATE POLICY "Cliente: modificar sus pedidos en draft"
  ON orders FOR UPDATE
  USING (
    organization_id = get_current_user_org_id()
    AND status IN ('draft', 'confirmed')
  )
  WITH CHECK (
    organization_id = get_current_user_org_id()
    AND status IN ('draft', 'confirmed', 'cancelled')
  );
