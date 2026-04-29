-- 012: MVP fix — link auth_id, phone+org, seed completo, menú semana actual
-- =====================================================================
-- NOTA: El UUID real del auth user es 07fd7773-fb06-4474-aeb3-b7bde1008053
--       (distinto del 1009053 usado en migration 010 — ese no fue aplicado).
--
-- Fixes:
--   1. Vincular auth_id para el admin real
--   2. Setear phone + organization_id para que identifyClient funcione
--   3. Agregar 5 insumos + 2 recetas faltantes de migration 011
--   4. Agregar menú publicado semana Apr 14-18 2026 (semana actual)
-- =====================================================================

BEGIN;

-- =====================================================================
-- PASO 1: Vincular auth_id (debe matchear auth.users.id)
-- El trigger users_prevent_escalation bloquea cambios de org_id/auth_id,
-- así que lo deshabilitamos durante el update de admin.
-- =====================================================================
ALTER TABLE users DISABLE TRIGGER users_prevent_escalation;

UPDATE users
SET
  auth_id         = '07fd7773-fb06-4474-aeb3-b7bde1008053',
  email           = 'garb.sistemas@gmail.com',
  phone           = '+5491124547153',
  organization_id = 'a0000000-0000-0000-0000-000000000001'
WHERE id = '07fd7773-fb06-4474-aeb3-b7bde1008053';

ALTER TABLE users ENABLE TRIGGER users_prevent_escalation;

-- =====================================================================
-- PASO 2: 5 insumos faltantes (migration 011 no fue aplicada al prod)
-- =====================================================================
INSERT INTO inventory_items (id, name, category, unit, current_stock, min_stock, cost_per_unit, is_active)
VALUES
  ('c0000000-0000-0000-0000-000000000016','Pan rallado',  'secos',       'kg', 5,  2, 350, true),
  ('c0000000-0000-0000-0000-000000000017','Sal',          'condimentos', 'kg', 10, 2,  80, true),
  ('c0000000-0000-0000-0000-000000000018','Cebolla',      'verduras',    'kg', 20, 5, 120, true),
  ('c0000000-0000-0000-0000-000000000019','Morrón rojo',  'verduras',    'kg', 10, 3, 650, true),
  ('c0000000-0000-0000-0000-000000000020','Berenjena',    'verduras',    'kg', 15, 4, 450, true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- PASO 3: 2 recetas nuevas + versiones
-- =====================================================================
INSERT INTO recipes (id, name, category, is_active)
VALUES
  ('d0000000-0000-0000-0000-000000000006','Wok de pollo',                   'especial', true),
  ('d0000000-0000-0000-0000-000000000007','Milanesa de berenjena napolitana','veggie',   true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO recipe_versions (id, recipe_id, version, portions_yield, preparation_notes, cost_per_portion, is_current, created_by)
VALUES
  ('e0000000-0000-0000-0000-000000000006',
   'd0000000-0000-0000-0000-000000000006', 1, 10,
   'Saltear pollo en tiras con verduras en wok. Condimentar con salsa de soja.',
   850, true, '07fd7773-fb06-4474-aeb3-b7bde1008053'),
  ('e0000000-0000-0000-0000-000000000007',
   'd0000000-0000-0000-0000-000000000007', 1, 10,
   'Rebozar berenjenas en rodajas, freír, cubrir con salsa fileto y mozzarella.',
   720, true, '07fd7773-fb06-4474-aeb3-b7bde1008053')
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- PASO 4: Menú semana Apr 14-18 2026 (semana actual)
-- =====================================================================
INSERT INTO weekly_menus (id, week_start, week_end, week_number, status)
VALUES ('f0000000-0000-0000-0000-000000000002','2026-04-14','2026-04-18',16,'published')
ON CONFLICT (id) DO NOTHING;

-- Copiar items del menú semana anterior
INSERT INTO menu_items (menu_id, day_of_week, option_code, category, display_name, recipe_version_id, is_available)
SELECT
  'f0000000-0000-0000-0000-000000000002',
  day_of_week, option_code, category, display_name, recipe_version_id, is_available
FROM menu_items
WHERE menu_id = 'f0000000-0000-0000-0000-000000000001'
ON CONFLICT (menu_id, day_of_week, option_code) DO NOTHING;

-- =====================================================================
-- PASO 5: Verificaciones
-- =====================================================================
DO $$
DECLARE
  v_user_row   RECORD;
  v_items      INT;
  v_recipes    INT;
  v_menu2_cnt  INT;
BEGIN
  SELECT id, email, phone, organization_id, auth_id IS NOT NULL AS auth_linked
    INTO v_user_row
    FROM users WHERE id = '07fd7773-fb06-4474-aeb3-b7bde1008053';

  IF NOT v_user_row.auth_linked THEN
    RAISE WARNING 'ATENCIÓN: auth_id sigue NULL para el admin';
  ELSE
    RAISE NOTICE 'OK: auth_id vinculado para %', v_user_row.email;
  END IF;

  IF v_user_row.phone IS NULL THEN
    RAISE WARNING 'ATENCIÓN: phone sigue NULL';
  ELSE
    RAISE NOTICE 'OK: phone = %', v_user_row.phone;
  END IF;

  SELECT COUNT(*) INTO v_items FROM inventory_items WHERE is_active = true;
  RAISE NOTICE 'Insumos activos: %', v_items;

  SELECT COUNT(*) INTO v_recipes FROM recipes WHERE is_active = true;
  RAISE NOTICE 'Recetas activas: %', v_recipes;

  SELECT COUNT(*) INTO v_menu2_cnt FROM menu_items
    WHERE menu_id = 'f0000000-0000-0000-0000-000000000002';
  RAISE NOTICE 'Menu items semana Apr 14-18: %', v_menu2_cnt;
END $$;

COMMIT;
