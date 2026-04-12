-- 011: Re-seed inventory items, recipes y recipe_versions
-- =====================================================================
-- PROPÓSITO: Re-insertar datos semilla de forma idempotente.
--   - Usa ON CONFLICT (id) DO NOTHING → safe si los datos ya existen.
--   - Agrega insumos faltantes (pan rallado, sal, cebolla, morrón, berenjena).
--   - Agrega recetas del PDF de Sheina (Wok de pollo, Milanesa de berenjena).
--   - Vincula created_by al usuario real por email.
--
-- NOTA: Esta migración debe correr DESPUÉS de 010_fix_auth_user.sql.
-- =====================================================================

BEGIN;

-- =====================================================================
-- INSUMOS (15 originales + 5 nuevos)
-- =====================================================================
INSERT INTO inventory_items (id, name, category, unit, current_stock, min_stock, cost_per_unit, supplier, is_active) VALUES
  -- Originales de seed 006
  ('c0000000-0000-0000-0000-000000000001', 'Carne vacuna (nalga)',       'carnes',      'kg',  50,   20,  5500.00, 'Frigorífico Sur',       true),
  ('c0000000-0000-0000-0000-000000000002', 'Pollo (pechuga)',            'carnes',      'kg',  40,   15,  3200.00, 'Avícola Central',       true),
  ('c0000000-0000-0000-0000-000000000003', 'Muzzarella',                 'lacteos',     'kg',  25,   10,  4800.00, 'Lácteos del Oeste',     true),
  ('c0000000-0000-0000-0000-000000000004', 'Harina 000',                 'secos',       'kg',  80,   30,   650.00, 'Distribuidora Norte',   true),
  ('c0000000-0000-0000-0000-000000000005', 'Huevos',                     'otros',       'un', 360,  120,   120.00, 'Granja El Sol',         true),
  ('c0000000-0000-0000-0000-000000000006', 'Tomate perita',              'verduras',    'kg',  30,   15,  1200.00, 'Mercado Central',       true),
  ('c0000000-0000-0000-0000-000000000007', 'Lechuga',                    'verduras',    'un',  40,   20,   600.00, 'Mercado Central',       true),
  ('c0000000-0000-0000-0000-000000000008', 'Papa',                       'verduras',    'kg',  60,   25,   800.00, 'Mercado Central',       true),
  ('c0000000-0000-0000-0000-000000000009', 'Batata',                     'verduras',    'kg',  20,   10,   900.00, 'Mercado Central',       true),
  ('c0000000-0000-0000-0000-000000000010', 'Jamón cocido',               'carnes',      'kg',  15,    8,  6500.00, 'Fiambrería Central',    true),
  ('c0000000-0000-0000-0000-000000000011', 'Queso cremoso',              'lacteos',     'kg',  20,   10,  5200.00, 'Lácteos del Oeste',     true),
  ('c0000000-0000-0000-0000-000000000012', 'Arroz largo fino',           'secos',       'kg',  40,   15,   950.00, 'Distribuidora Norte',   true),
  ('c0000000-0000-0000-0000-000000000013', 'Fideos secos (spaghetti)',   'secos',       'kg',  35,   15,   850.00, 'Distribuidora Norte',   true),
  ('c0000000-0000-0000-0000-000000000014', 'Pan de miga',                'secos',       'un',  50,   20,   350.00, 'Panadería Don Luis',    true),
  ('c0000000-0000-0000-0000-000000000015', 'Aceite girasol',             'condimentos', 'lt',  20,    8,  1100.00, 'Distribuidora Norte',   true),
  -- Nuevos insumos
  ('c0000000-0000-0000-0000-000000000016', 'Pan rallado',                'secos',       'kg',  20,   10,   700.00, 'Distribuidora Norte',   true),
  ('c0000000-0000-0000-0000-000000000017', 'Sal',                        'condimentos', 'kg',  10,    5,   180.00, 'Distribuidora Norte',   true),
  ('c0000000-0000-0000-0000-000000000018', 'Cebolla',                    'verduras',    'kg',  30,   15,   450.00, 'Mercado Central',       true),
  ('c0000000-0000-0000-0000-000000000019', 'Morrón rojo',                'verduras',    'kg',  15,    8,  1500.00, 'Mercado Central',       true),
  ('c0000000-0000-0000-0000-000000000020', 'Berenjena',                  'verduras',    'kg',  20,   10,   800.00, 'Mercado Central',       true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- RECETAS
-- =====================================================================
INSERT INTO recipes (id, name, category, is_active) VALUES
  -- Originales de seed 006
  ('d0000000-0000-0000-0000-000000000001', 'Milanesa de carne con ensalada',    'principal', true),
  ('d0000000-0000-0000-0000-000000000002', 'Ravioles con salsa fileto',          'principal', true),
  ('d0000000-0000-0000-0000-000000000003', 'Tarta de jamón y queso',             'tarta',     true),
  ('d0000000-0000-0000-0000-000000000004', 'Ensalada Caesar',                    'ensalada',  true),
  ('d0000000-0000-0000-0000-000000000005', 'Ñoquis con bolognesa',               'principal', true),
  -- Nuevas recetas del PDF de Sheina
  ('d0000000-0000-0000-0000-000000000006', 'Wok de pollo',                       'especial',  true),
  ('d0000000-0000-0000-0000-000000000007', 'Milanesa de berenjena napolitana',   'veggie',    true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- VERSIONES DE RECETA (is_current = true)
-- created_by: se vincula al usuario real por email (NULL si no existe aún)
-- =====================================================================
INSERT INTO recipe_versions (id, recipe_id, version, portions_yield, preparation_notes, cost_per_portion, is_current, created_by) VALUES
  -- Originales
  ('e0000000-0000-0000-0000-000000000001',
   'd0000000-0000-0000-0000-000000000001', 1, 10,
   'Cortar nalga en fetas finas. Pasar por huevo y pan rallado. Freír en aceite hasta dorar. Servir con ensalada de lechuga y tomate.',
   0, true, NULL),
  ('e0000000-0000-0000-0000-000000000002',
   'd0000000-0000-0000-0000-000000000002', 1, 10,
   'Preparar masa con harina y huevos. Rellenar con muzzarella. Salsa fileto: tomate, ajo, albahaca.',
   0, true, NULL),
  ('e0000000-0000-0000-0000-000000000003',
   'd0000000-0000-0000-0000-000000000003', 1, 8,
   'Masa: harina, huevos, manteca. Relleno: jamón cocido, queso cremoso, huevos batidos. Hornear 30 min a 180°C.',
   0, true, NULL),
  ('e0000000-0000-0000-0000-000000000004',
   'd0000000-0000-0000-0000-000000000004', 1, 10,
   'Lechuga romana troceada, pechuga de pollo grillada, queso parmesano. Aderezo Caesar aparte. 400g por porción.',
   0, true, NULL),
  ('e0000000-0000-0000-0000-000000000005',
   'd0000000-0000-0000-0000-000000000005', 1, 10,
   'Ñoquis: papa hervida, harina, huevo. Bolognesa: carne picada, tomate, cebolla, zanahoria. Cocción lenta 45 min. 535g por porción.',
   0, true, NULL),
  -- Nuevas recetas del PDF
  ('e0000000-0000-0000-0000-000000000006',
   'd0000000-0000-0000-0000-000000000006', 1, 10,
   'Saltear pollo en cubos con morrón y cebolla en aceite bien caliente. Agregar arroz cocido. Condimentar con sal y especias. 485g por porción.',
   0, true, NULL),
  ('e0000000-0000-0000-0000-000000000007',
   'd0000000-0000-0000-0000-000000000007', 1, 10,
   'Cortar berenjena en rodajas, pasar por huevo y pan rallado, freír. Cubrir con tomate y muzzarella, gratinar. 580g por porción.',
   0, true, NULL)
ON CONFLICT (id) DO NOTHING;

-- Vincular created_by al usuario real por email (idempotente)
UPDATE recipe_versions rv
  SET created_by = u.id
  FROM users u
  WHERE u.email = 'garb.sistemas@gmail.com'
    AND rv.created_by IS NULL;

-- =====================================================================
-- INGREDIENTES DE RECETA (INSERT si no existe la combinación)
-- =====================================================================

-- Receta 1: Milanesa de carne con ensalada
INSERT INTO recipe_ingredients (recipe_version_id, inventory_item_id, quantity, unit)
SELECT v, i, q, u FROM (VALUES
  ('e0000000-0000-0000-0000-000000000001'::uuid, 'c0000000-0000-0000-0000-000000000001'::uuid, 2.0::numeric, 'kg'),  -- Carne
  ('e0000000-0000-0000-0000-000000000001'::uuid, 'c0000000-0000-0000-0000-000000000016'::uuid, 0.5::numeric, 'kg'),  -- Pan rallado
  ('e0000000-0000-0000-0000-000000000001'::uuid, 'c0000000-0000-0000-0000-000000000005'::uuid, 6.0::numeric, 'un'),  -- Huevos
  ('e0000000-0000-0000-0000-000000000001'::uuid, 'c0000000-0000-0000-0000-000000000007'::uuid, 3.0::numeric, 'un'),  -- Lechuga
  ('e0000000-0000-0000-0000-000000000001'::uuid, 'c0000000-0000-0000-0000-000000000006'::uuid, 1.0::numeric, 'kg'),  -- Tomate
  ('e0000000-0000-0000-0000-000000000001'::uuid, 'c0000000-0000-0000-0000-000000000015'::uuid, 1.0::numeric, 'lt'),  -- Aceite
  ('e0000000-0000-0000-0000-000000000001'::uuid, 'c0000000-0000-0000-0000-000000000017'::uuid, 0.03::numeric,'kg')   -- Sal
) AS t(v, i, q, u)
WHERE NOT EXISTS (
  SELECT 1 FROM recipe_ingredients ri
  WHERE ri.recipe_version_id = t.v AND ri.inventory_item_id = t.i
);

-- Receta 2: Ravioles con salsa fileto
INSERT INTO recipe_ingredients (recipe_version_id, inventory_item_id, quantity, unit)
SELECT v, i, q, u FROM (VALUES
  ('e0000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000004'::uuid, 1.5::numeric, 'kg'),  -- Harina
  ('e0000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000005'::uuid, 8.0::numeric, 'un'),  -- Huevos
  ('e0000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000006'::uuid, 2.0::numeric, 'kg'),  -- Tomate
  ('e0000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000003'::uuid, 1.0::numeric, 'kg'),  -- Muzzarella
  ('e0000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000017'::uuid, 0.03::numeric,'kg')   -- Sal
) AS t(v, i, q, u)
WHERE NOT EXISTS (
  SELECT 1 FROM recipe_ingredients ri
  WHERE ri.recipe_version_id = t.v AND ri.inventory_item_id = t.i
);

-- Receta 3: Tarta de jamón y queso
INSERT INTO recipe_ingredients (recipe_version_id, inventory_item_id, quantity, unit)
SELECT v, i, q, u FROM (VALUES
  ('e0000000-0000-0000-0000-000000000003'::uuid, 'c0000000-0000-0000-0000-000000000004'::uuid, 0.8::numeric, 'kg'),  -- Harina
  ('e0000000-0000-0000-0000-000000000003'::uuid, 'c0000000-0000-0000-0000-000000000010'::uuid, 1.0::numeric, 'kg'),  -- Jamón
  ('e0000000-0000-0000-0000-000000000003'::uuid, 'c0000000-0000-0000-0000-000000000011'::uuid, 0.8::numeric, 'kg'),  -- Queso cremoso
  ('e0000000-0000-0000-0000-000000000003'::uuid, 'c0000000-0000-0000-0000-000000000005'::uuid, 4.0::numeric, 'un'),  -- Huevos
  ('e0000000-0000-0000-0000-000000000003'::uuid, 'c0000000-0000-0000-0000-000000000017'::uuid, 0.02::numeric,'kg')   -- Sal
) AS t(v, i, q, u)
WHERE NOT EXISTS (
  SELECT 1 FROM recipe_ingredients ri
  WHERE ri.recipe_version_id = t.v AND ri.inventory_item_id = t.i
);

-- Receta 4: Ensalada Caesar
INSERT INTO recipe_ingredients (recipe_version_id, inventory_item_id, quantity, unit)
SELECT v, i, q, u FROM (VALUES
  ('e0000000-0000-0000-0000-000000000004'::uuid, 'c0000000-0000-0000-0000-000000000007'::uuid, 5.0::numeric, 'un'),  -- Lechuga
  ('e0000000-0000-0000-0000-000000000004'::uuid, 'c0000000-0000-0000-0000-000000000002'::uuid, 1.5::numeric, 'kg'),  -- Pollo
  ('e0000000-0000-0000-0000-000000000004'::uuid, 'c0000000-0000-0000-0000-000000000003'::uuid, 0.3::numeric, 'kg'),  -- Muzzarella (parmesano)
  ('e0000000-0000-0000-0000-000000000004'::uuid, 'c0000000-0000-0000-0000-000000000017'::uuid, 0.02::numeric,'kg')   -- Sal
) AS t(v, i, q, u)
WHERE NOT EXISTS (
  SELECT 1 FROM recipe_ingredients ri
  WHERE ri.recipe_version_id = t.v AND ri.inventory_item_id = t.i
);

-- Receta 5: Ñoquis con bolognesa
INSERT INTO recipe_ingredients (recipe_version_id, inventory_item_id, quantity, unit)
SELECT v, i, q, u FROM (VALUES
  ('e0000000-0000-0000-0000-000000000005'::uuid, 'c0000000-0000-0000-0000-000000000008'::uuid, 3.0::numeric, 'kg'),  -- Papa
  ('e0000000-0000-0000-0000-000000000005'::uuid, 'c0000000-0000-0000-0000-000000000004'::uuid, 1.0::numeric, 'kg'),  -- Harina
  ('e0000000-0000-0000-0000-000000000005'::uuid, 'c0000000-0000-0000-0000-000000000001'::uuid, 1.5::numeric, 'kg'),  -- Carne
  ('e0000000-0000-0000-0000-000000000005'::uuid, 'c0000000-0000-0000-0000-000000000006'::uuid, 1.5::numeric, 'kg'),  -- Tomate
  ('e0000000-0000-0000-0000-000000000005'::uuid, 'c0000000-0000-0000-0000-000000000005'::uuid, 2.0::numeric, 'un'),  -- Huevos
  ('e0000000-0000-0000-0000-000000000005'::uuid, 'c0000000-0000-0000-0000-000000000018'::uuid, 0.5::numeric, 'kg'),  -- Cebolla
  ('e0000000-0000-0000-0000-000000000005'::uuid, 'c0000000-0000-0000-0000-000000000017'::uuid, 0.03::numeric,'kg')   -- Sal
) AS t(v, i, q, u)
WHERE NOT EXISTS (
  SELECT 1 FROM recipe_ingredients ri
  WHERE ri.recipe_version_id = t.v AND ri.inventory_item_id = t.i
);

-- Receta 6: Wok de pollo (nueva — 485g/porción)
INSERT INTO recipe_ingredients (recipe_version_id, inventory_item_id, quantity, unit)
SELECT v, i, q, u FROM (VALUES
  ('e0000000-0000-0000-0000-000000000006'::uuid, 'c0000000-0000-0000-0000-000000000002'::uuid, 1.5::numeric, 'kg'),  -- Pollo
  ('e0000000-0000-0000-0000-000000000006'::uuid, 'c0000000-0000-0000-0000-000000000019'::uuid, 0.5::numeric, 'kg'),  -- Morrón
  ('e0000000-0000-0000-0000-000000000006'::uuid, 'c0000000-0000-0000-0000-000000000018'::uuid, 0.5::numeric, 'kg'),  -- Cebolla
  ('e0000000-0000-0000-0000-000000000006'::uuid, 'c0000000-0000-0000-0000-000000000012'::uuid, 1.5::numeric, 'kg'),  -- Arroz
  ('e0000000-0000-0000-0000-000000000006'::uuid, 'c0000000-0000-0000-0000-000000000015'::uuid, 0.2::numeric, 'lt'),  -- Aceite
  ('e0000000-0000-0000-0000-000000000006'::uuid, 'c0000000-0000-0000-0000-000000000017'::uuid, 0.03::numeric,'kg')   -- Sal
) AS t(v, i, q, u)
WHERE NOT EXISTS (
  SELECT 1 FROM recipe_ingredients ri
  WHERE ri.recipe_version_id = t.v AND ri.inventory_item_id = t.i
);

-- Receta 7: Milanesa de berenjena napolitana (nueva — 580g/porción)
INSERT INTO recipe_ingredients (recipe_version_id, inventory_item_id, quantity, unit)
SELECT v, i, q, u FROM (VALUES
  ('e0000000-0000-0000-0000-000000000007'::uuid, 'c0000000-0000-0000-0000-000000000020'::uuid, 2.5::numeric, 'kg'),  -- Berenjena
  ('e0000000-0000-0000-0000-000000000007'::uuid, 'c0000000-0000-0000-0000-000000000016'::uuid, 0.4::numeric, 'kg'),  -- Pan rallado
  ('e0000000-0000-0000-0000-000000000007'::uuid, 'c0000000-0000-0000-0000-000000000005'::uuid, 6.0::numeric, 'un'),  -- Huevos
  ('e0000000-0000-0000-0000-000000000007'::uuid, 'c0000000-0000-0000-0000-000000000003'::uuid, 0.8::numeric, 'kg'),  -- Muzzarella
  ('e0000000-0000-0000-0000-000000000007'::uuid, 'c0000000-0000-0000-0000-000000000006'::uuid, 1.0::numeric, 'kg'),  -- Tomate
  ('e0000000-0000-0000-0000-000000000007'::uuid, 'c0000000-0000-0000-0000-000000000015'::uuid, 0.5::numeric, 'lt'),  -- Aceite
  ('e0000000-0000-0000-0000-000000000007'::uuid, 'c0000000-0000-0000-0000-000000000017'::uuid, 0.03::numeric,'kg')   -- Sal
) AS t(v, i, q, u)
WHERE NOT EXISTS (
  SELECT 1 FROM recipe_ingredients ri
  WHERE ri.recipe_version_id = t.v AND ri.inventory_item_id = t.i
);

-- =====================================================================
-- MENÚ SEMANAL (semana del 6 al 10 de abril 2026) — re-seed seguro
-- =====================================================================
INSERT INTO weekly_menus (id, week_start, week_end, week_number, status)
VALUES ('f0000000-0000-0000-0000-000000000001', '2026-04-06', '2026-04-10', 15, 'published')
ON CONFLICT (id) DO NOTHING;

-- Menu items (35 opciones: 7 por día × 5 días)
INSERT INTO menu_items (menu_id, day_of_week, option_code, recipe_version_id, category, display_name) VALUES
  -- Lunes
  ('f0000000-0000-0000-0000-000000000001', 1, 'A', 'e0000000-0000-0000-0000-000000000005', 'principal',   'Ñoquis con bolognesa'),
  ('f0000000-0000-0000-0000-000000000001', 1, 'B', 'e0000000-0000-0000-0000-000000000001', 'alternativa', 'Milanesa de carne con ensalada'),
  ('f0000000-0000-0000-0000-000000000001', 1, 'C', NULL,                                   'sandwich',    'Sándwich de jamón y queso'),
  ('f0000000-0000-0000-0000-000000000001', 1, 'D', 'e0000000-0000-0000-0000-000000000003', 'tarta',       'Tarta de jamón y queso'),
  ('f0000000-0000-0000-0000-000000000001', 1, 'E', 'e0000000-0000-0000-0000-000000000004', 'ensalada',    'Ensalada Caesar'),
  ('f0000000-0000-0000-0000-000000000001', 1, 'F', NULL,                                   'veggie',      'Tarta de verduras'),
  ('f0000000-0000-0000-0000-000000000001', 1, 'G', 'e0000000-0000-0000-0000-000000000006', 'especial',    'Wok de pollo'),
  -- Martes
  ('f0000000-0000-0000-0000-000000000001', 2, 'H', 'e0000000-0000-0000-0000-000000000002', 'principal',   'Ravioles con salsa fileto'),
  ('f0000000-0000-0000-0000-000000000001', 2, 'I', 'e0000000-0000-0000-0000-000000000001', 'alternativa', 'Milanesa napolitana'),
  ('f0000000-0000-0000-0000-000000000001', 2, 'J', NULL,                                   'sandwich',    'Sándwich de atún'),
  ('f0000000-0000-0000-0000-000000000001', 2, 'K', 'e0000000-0000-0000-0000-000000000003', 'tarta',       'Tarta de choclo'),
  ('f0000000-0000-0000-0000-000000000001', 2, 'L', 'e0000000-0000-0000-0000-000000000004', 'ensalada',    'Ensalada de pollo grillado'),
  ('f0000000-0000-0000-0000-000000000001', 2, 'M', 'e0000000-0000-0000-0000-000000000007', 'veggie',      'Milanesa de berenjena napolitana'),
  ('f0000000-0000-0000-0000-000000000001', 2, 'N', NULL,                                   'especial',    'Arroz con pollo'),
  -- Miércoles
  ('f0000000-0000-0000-0000-000000000001', 3, 'O', NULL,                                   'principal',   'Pastel de papa'),
  ('f0000000-0000-0000-0000-000000000001', 3, 'P', 'e0000000-0000-0000-0000-000000000002', 'alternativa', 'Fideos con pesto'),
  ('f0000000-0000-0000-0000-000000000001', 3, 'Q', NULL,                                   'sandwich',    'Sándwich de milanesa'),
  ('f0000000-0000-0000-0000-000000000001', 3, 'R', NULL,                                   'tarta',       'Tarta caprese'),
  ('f0000000-0000-0000-0000-000000000001', 3, 'S', 'e0000000-0000-0000-0000-000000000004', 'ensalada',    'Ensalada rusa'),
  ('f0000000-0000-0000-0000-000000000001', 3, 'T', 'e0000000-0000-0000-0000-000000000007', 'veggie',      'Milanesa de berenjena con ensalada'),
  ('f0000000-0000-0000-0000-000000000001', 3, 'U', NULL,                                   'especial',    'Suprema de pollo'),
  -- Jueves
  ('f0000000-0000-0000-0000-000000000001', 4, 'V',  'e0000000-0000-0000-0000-000000000001', 'principal',   'Milanesa con puré'),
  ('f0000000-0000-0000-0000-000000000001', 4, 'W',  'e0000000-0000-0000-0000-000000000005', 'alternativa', 'Ñoquis con tuco'),
  ('f0000000-0000-0000-0000-000000000001', 4, 'X',  NULL,                                   'sandwich',    'Sándwich triple'),
  ('f0000000-0000-0000-0000-000000000001', 4, 'Y',  'e0000000-0000-0000-0000-000000000003', 'tarta',       'Tarta de atún'),
  ('f0000000-0000-0000-0000-000000000001', 4, 'Z',  'e0000000-0000-0000-0000-000000000004', 'ensalada',    'Ensalada de lentejas'),
  ('f0000000-0000-0000-0000-000000000001', 4, 'AA', 'e0000000-0000-0000-0000-000000000007', 'veggie',      'Berenjena napolitana'),
  ('f0000000-0000-0000-0000-000000000001', 4, 'BB', NULL,                                   'especial',    'Estofado de carne'),
  -- Viernes
  ('f0000000-0000-0000-0000-000000000001', 5, 'CC', 'e0000000-0000-0000-0000-000000000002', 'principal',   'Sorrentinos con salsa rosa'),
  ('f0000000-0000-0000-0000-000000000001', 5, 'DD', 'e0000000-0000-0000-0000-000000000006', 'alternativa', 'Wok de pollo con arroz'),
  ('f0000000-0000-0000-0000-000000000001', 5, 'EE', NULL,                                   'sandwich',    'Sándwich club'),
  ('f0000000-0000-0000-0000-000000000001', 5, 'FF', NULL,                                   'tarta',       'Empanadas de carne'),
  ('f0000000-0000-0000-0000-000000000001', 5, 'GG', 'e0000000-0000-0000-0000-000000000004', 'ensalada',    'Ensalada waldorf'),
  ('f0000000-0000-0000-0000-000000000001', 5, 'HH', 'e0000000-0000-0000-0000-000000000007', 'veggie',      'Milanesa de berenjena'),
  ('f0000000-0000-0000-0000-000000000001', 5, 'II', NULL,                                   'especial',    'Bife a la criolla')
ON CONFLICT (menu_id, day_of_week, option_code) DO NOTHING;

-- =====================================================================
-- Verificación final
-- =====================================================================
DO $$
DECLARE
  v_items INTEGER;
  v_recipes INTEGER;
  v_rv INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_items FROM inventory_items WHERE is_active = true;
  SELECT COUNT(*) INTO v_recipes FROM recipes WHERE is_active = true;
  SELECT COUNT(*) INTO v_rv FROM recipe_versions WHERE is_current = true;
  RAISE NOTICE 'Re-seed completado: % insumos activos, % recetas activas, % versiones actuales', v_items, v_recipes, v_rv;
END $$;

COMMIT;
