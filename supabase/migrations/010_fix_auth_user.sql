-- 010: Fix auth user mapping and seed data integrity
-- =====================================================================
-- PROBLEMA: Los usuarios seed tenían UUIDs falsos (b0000000-...) sin
-- auth_id vinculado. El usuario real autenticado es:
--   auth.users.id = 07fd7773-fb06-4474-aeb3-b7bde1009053
--   email          = garb.sistemas@gmail.com
--
-- SOLUCIÓN:
--   1. Drop FK constraints que referencian users(id)
--   2. Redirigir todas las referencias de UUIDs falsos → UUID real
--   3. Eliminar usuarios seed falsos
--   4. Upsert usuario real (id = auth_id = auth.uid() real)
--   5. Re-crear FK constraints
--   6. Agregar política RLS faltante: usuario puede ver su propio perfil
-- =====================================================================

BEGIN;

-- =====================================================================
-- PASO 1: Drop FK constraints que referencian users(id)
-- (necesario para poder redirigir referencias antes de eliminar los
--  usuarios falsos, y para insertar el nuevo usuario con el mismo UUID)
-- =====================================================================
ALTER TABLE recipe_versions
  DROP CONSTRAINT IF EXISTS recipe_versions_created_by_fkey;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_confirmed_by_fkey;

ALTER TABLE order_events
  DROP CONSTRAINT IF EXISTS order_events_actor_id_fkey;

ALTER TABLE inventory_movements
  DROP CONSTRAINT IF EXISTS inventory_movements_actor_id_fkey;

-- =====================================================================
-- PASO 2: Redirigir todas las referencias de usuarios falsos → UUID real
-- (se hace ANTES de eliminar los usuarios para que las FKs no bloqueen)
-- =====================================================================
UPDATE recipe_versions
  SET created_by = '07fd7773-fb06-4474-aeb3-b7bde1009053'
  WHERE created_by IN (
    'b0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002'
  );

UPDATE orders
  SET confirmed_by = '07fd7773-fb06-4474-aeb3-b7bde1009053'
  WHERE confirmed_by IN (
    'b0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002'
  );

UPDATE order_events
  SET actor_id = '07fd7773-fb06-4474-aeb3-b7bde1009053'
  WHERE actor_id IN (
    'b0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002'
  );

UPDATE inventory_movements
  SET actor_id = '07fd7773-fb06-4474-aeb3-b7bde1009053'
  WHERE actor_id IN (
    'b0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002'
  );

-- =====================================================================
-- PASO 3: Eliminar usuarios seed falsos
-- =====================================================================
DELETE FROM users
  WHERE id IN (
    'b0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002'
  );

-- Limpiar cualquier intento previo de fix parcial (mismo auth_id, id distinto)
DELETE FROM users
  WHERE auth_id = '07fd7773-fb06-4474-aeb3-b7bde1009053'
    AND id != '07fd7773-fb06-4474-aeb3-b7bde1009053';

-- =====================================================================
-- PASO 4: Upsert usuario real
-- id = auth_id = UUID real de auth.users para simplificar lookups
-- =====================================================================
INSERT INTO users (id, auth_id, organization_id, role, full_name, phone, email, is_active)
VALUES (
  '07fd7773-fb06-4474-aeb3-b7bde1009053',
  '07fd7773-fb06-4474-aeb3-b7bde1009053',
  NULL,
  'superadmin',
  'Admin Sheina',
  NULL,
  'garb.sistemas@gmail.com',
  true
)
ON CONFLICT (id) DO UPDATE SET
  auth_id    = EXCLUDED.auth_id,
  role       = EXCLUDED.role,
  full_name  = EXCLUDED.full_name,
  email      = EXCLUDED.email,
  is_active  = EXCLUDED.is_active;

-- =====================================================================
-- PASO 5: Re-crear FK constraints
-- (ahora todas las referencias apuntan al usuario real que ya existe)
-- =====================================================================
ALTER TABLE recipe_versions
  ADD CONSTRAINT recipe_versions_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE orders
  ADD CONSTRAINT orders_confirmed_by_fkey
  FOREIGN KEY (confirmed_by) REFERENCES users(id);

ALTER TABLE order_events
  ADD CONSTRAINT order_events_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES users(id);

ALTER TABLE inventory_movements
  ADD CONSTRAINT inventory_movements_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES users(id);

-- =====================================================================
-- PASO 6: Política RLS faltante — usuario puede ver su propio perfil
-- Sin esta política, un usuario no-admin con org_id NULL no puede
-- leer su propio perfil aunque is_admin() funcione correctamente.
-- =====================================================================
DROP POLICY IF EXISTS "Usuario: ver su propio perfil" ON users;
CREATE POLICY "Usuario: ver su propio perfil"
  ON users FOR SELECT
  USING (auth_id = auth.uid());

-- =====================================================================
-- PASO 7: Verificaciones de integridad (assertions con WARNING)
-- =====================================================================
DO $$
DECLARE
  v_days      INTEGER;
  v_org       INTEGER;
  v_bad_rv    INTEGER;
BEGIN
  -- menu_items debe tener las 5 días distintos
  SELECT COUNT(DISTINCT day_of_week) INTO v_days FROM menu_items;
  IF v_days < 5 THEN
    RAISE WARNING 'menu_items tiene solo % día(s) distintos — esperados 5', v_days;
  END IF;

  -- Organización demo debe existir
  SELECT COUNT(*) INTO v_org
    FROM organizations WHERE id = 'a0000000-0000-0000-0000-000000000001';
  IF v_org = 0 THEN
    RAISE WARNING 'Organización demo no encontrada';
  END IF;

  -- Cada receta debe tener al menos una versión is_current = true
  SELECT COUNT(*) INTO v_bad_rv
    FROM recipes r
    WHERE is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM recipe_versions rv
        WHERE rv.recipe_id = r.id AND rv.is_current = true
      );
  IF v_bad_rv > 0 THEN
    RAISE WARNING '% receta(s) activa(s) sin versión is_current = true', v_bad_rv;
    -- Fix automático: marcar is_current en la versión más reciente de cada receta afectada
    UPDATE recipe_versions rv
      SET is_current = true
      WHERE rv.id IN (
        SELECT DISTINCT ON (recipe_id) id
        FROM recipe_versions
        WHERE recipe_id IN (
          SELECT id FROM recipes
          WHERE is_active = true
            AND NOT EXISTS (
              SELECT 1 FROM recipe_versions rv2
              WHERE rv2.recipe_id = recipes.id AND rv2.is_current = true
            )
        )
        ORDER BY recipe_id, version DESC
      );
  END IF;
END $$;

COMMIT;
