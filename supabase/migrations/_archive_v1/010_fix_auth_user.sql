-- 010: Fix auth user mapping and seed data integrity
-- =====================================================================
-- PROBLEMA: Los usuarios seed tenían UUIDs falsos (b0000000-...) sin
-- auth_id vinculado. El usuario real autenticado es garb.sistemas@gmail.com.
--
-- ESTRATEGIA:
--   - public.users.id  : UUID propio de la tabla (sin FK — podemos elegirlo)
--   - public.users.auth_id : FK → auth.users(id) — DEBE existir en auth.users
--
--   Insertar con auth_id = NULL para evitar error de FK.
--   Luego auto-vincular por email desde auth.users.
--   Si el usuario aún no existe en auth.users, la fila queda válida
--   (auth_id NULL) y se puede vincular después.
-- =====================================================================

BEGIN;

-- =====================================================================
-- PASO 1: Drop FK constraints que referencian users(id)
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
-- PASO 2: Eliminar usuarios seed falsos
-- (primero nullificar referencias para que no bloqueen el DELETE)
-- =====================================================================
UPDATE recipe_versions   SET created_by  = NULL WHERE created_by  IN ('b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002');
UPDATE orders            SET confirmed_by = NULL WHERE confirmed_by IN ('b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002');
UPDATE order_events      SET actor_id     = NULL WHERE actor_id     IN ('b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002');
UPDATE inventory_movements SET actor_id   = NULL WHERE actor_id     IN ('b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002');

DELETE FROM users
  WHERE id IN (
    'b0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002'
  );

-- =====================================================================
-- PASO 3: Upsert usuario admin con auth_id = NULL
-- Usamos '07fd7773-...' como id de la tabla (UUID arbitrario, sin FK).
-- El constraint users_auth_id_fkey solo aplica a la columna auth_id,
-- no a id — así que esto NO falla aunque el UUID no exista en auth.users.
-- =====================================================================
INSERT INTO users (id, auth_id, organization_id, role, full_name, phone, email, is_active)
VALUES (
  '07fd7773-fb06-4474-aeb3-b7bde1009053',
  NULL,   -- se vincula en paso 4 por email para evitar FK violation
  NULL,
  'superadmin',
  'Admin Sheina',
  NULL,
  'garb.sistemas@gmail.com',
  true
)
ON CONFLICT (id) DO UPDATE SET
  role      = EXCLUDED.role,
  full_name = EXCLUDED.full_name,
  email     = EXCLUDED.email,
  is_active = EXCLUDED.is_active;

-- =====================================================================
-- PASO 4: Auto-vincular auth_id por email desde auth.users
-- Si el usuario existe en Auth (con ese email), queda vinculado.
-- Si no existe aún, auth_id queda NULL y se puede vincular después
-- ejecutando manualmente:
--   UPDATE users SET auth_id = '<UUID_DE_AUTH>' WHERE email = 'garb.sistemas@gmail.com';
-- =====================================================================
UPDATE users u
  SET auth_id = au.id
  FROM auth.users au
  WHERE au.email = u.email
    AND u.email = 'garb.sistemas@gmail.com'
    AND u.auth_id IS NULL;

-- =====================================================================
-- PASO 5: Actualizar referencias nullificadas → usuario admin real
-- =====================================================================
UPDATE recipe_versions
  SET created_by = '07fd7773-fb06-4474-aeb3-b7bde1009053'
  WHERE created_by IS NULL;

UPDATE orders
  SET confirmed_by = '07fd7773-fb06-4474-aeb3-b7bde1009053'
  WHERE confirmed_by IS NULL;

UPDATE order_events
  SET actor_id = '07fd7773-fb06-4474-aeb3-b7bde1009053'
  WHERE actor_id IS NULL;

UPDATE inventory_movements
  SET actor_id = '07fd7773-fb06-4474-aeb3-b7bde1009053'
  WHERE actor_id IS NULL;

-- =====================================================================
-- PASO 6: Re-crear FK constraints
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
-- PASO 7: Política RLS faltante — usuario puede SELECT su propio perfil
-- =====================================================================
DROP POLICY IF EXISTS "Usuario: ver su propio perfil" ON users;
CREATE POLICY "Usuario: ver su propio perfil"
  ON users FOR SELECT
  USING (auth_id = auth.uid());

-- =====================================================================
-- PASO 8: Verificaciones de integridad
-- =====================================================================
DO $$
DECLARE
  v_days   INTEGER;
  v_org    INTEGER;
  v_bad_rv INTEGER;
  v_linked INTEGER;
BEGIN
  SELECT COUNT(DISTINCT day_of_week) INTO v_days FROM menu_items;
  IF v_days < 5 THEN
    RAISE WARNING 'menu_items tiene solo % día(s) distintos — esperados 5', v_days;
  END IF;

  SELECT COUNT(*) INTO v_org
    FROM organizations WHERE id = 'a0000000-0000-0000-0000-000000000001';
  IF v_org = 0 THEN
    RAISE WARNING 'Organización demo no encontrada';
  END IF;

  SELECT COUNT(*) INTO v_bad_rv
    FROM recipes r
    WHERE is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM recipe_versions rv
        WHERE rv.recipe_id = r.id AND rv.is_current = true
      );
  IF v_bad_rv > 0 THEN
    RAISE WARNING '% receta(s) activa(s) sin versión is_current = true', v_bad_rv;
    UPDATE recipe_versions SET is_current = true
      WHERE id IN (
        SELECT DISTINCT ON (recipe_id) id
        FROM recipe_versions
        WHERE recipe_id IN (
          SELECT r.id FROM recipes r
          WHERE r.is_active = true
            AND NOT EXISTS (
              SELECT 1 FROM recipe_versions rv2
              WHERE rv2.recipe_id = r.id AND rv2.is_current = true
            )
        )
        ORDER BY recipe_id, version DESC
      );
  END IF;

  -- Informar estado del vínculo auth_id
  SELECT COUNT(*) INTO v_linked
    FROM users WHERE email = 'garb.sistemas@gmail.com' AND auth_id IS NOT NULL;
  IF v_linked = 0 THEN
    RAISE WARNING 'ATENCIÓN: auth_id del admin NO fue vinculado — el usuario garb.sistemas@gmail.com no existe aún en auth.users. Crealo en Authentication → Users y luego ejecutá: UPDATE users SET auth_id = (SELECT id FROM auth.users WHERE email = ''garb.sistemas@gmail.com'') WHERE email = ''garb.sistemas@gmail.com'';';
  ELSE
    RAISE NOTICE 'OK: auth_id vinculado correctamente para garb.sistemas@gmail.com';
  END IF;
END $$;

COMMIT;
