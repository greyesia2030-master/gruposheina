-- 006: Datos semilla
-- Sistema de Gestión de Viandas — Grupo Sheina

-- ===== 1. ORGANIZACIÓN DEMO =====
INSERT INTO organizations (id, name, cuit, contact_phone, email, cutoff_time, cutoff_days_before, departments, status)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Cliente PYME Demo',
  '30-71234567-8',
  '+5491112345678',
  'pedidos@pymedemo.com.ar',
  '18:00',
  1,
  '["adm","vtas","diet","log","otros"]'::jsonb,
  'active'
);

-- ===== 2. USUARIO ADMIN =====
-- Nota: el auth_id se debe vincular manualmente después de crear el usuario en Supabase Auth
INSERT INTO users (id, organization_id, role, full_name, phone, email)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  NULL, -- Superadmin no pertenece a una organización específica
  'superadmin',
  'Administrador Sheina',
  '+5491198765432',
  'admin@sheina.com'
);

-- Usuario cliente de la PYME demo
INSERT INTO users (id, organization_id, role, full_name, phone, email)
VALUES (
  'b0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'client_admin',
  'Responsable PYME Demo',
  '+5491112345678',
  'pedidos@pymedemo.com.ar'
);

-- ===== 3. INSUMOS BÁSICOS (15) =====
INSERT INTO inventory_items (id, name, category, unit, current_stock, min_stock, cost_per_unit, supplier) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'Carne vacuna (nalga)',  'carnes',     'kg',  50,  20, 5500.00, 'Frigorífico Sur'),
  ('c0000000-0000-0000-0000-000000000002', 'Pollo (pechuga)',       'carnes',     'kg',  40,  15, 3200.00, 'Avícola Central'),
  ('c0000000-0000-0000-0000-000000000003', 'Muzzarella',            'lacteos',    'kg',  25,  10, 4800.00, 'Lácteos del Oeste'),
  ('c0000000-0000-0000-0000-000000000004', 'Harina 000',            'secos',      'kg',  80,  30, 650.00,  'Distribuidora Norte'),
  ('c0000000-0000-0000-0000-000000000005', 'Huevos',                'otros',      'un',  360, 120, 120.00, 'Granja El Sol'),
  ('c0000000-0000-0000-0000-000000000006', 'Tomate perita',         'verduras',   'kg',  30,  15, 1200.00, 'Mercado Central'),
  ('c0000000-0000-0000-0000-000000000007', 'Lechuga',               'verduras',   'un',  40,  20, 600.00,  'Mercado Central'),
  ('c0000000-0000-0000-0000-000000000008', 'Papa',                  'verduras',   'kg',  60,  25, 800.00,  'Mercado Central'),
  ('c0000000-0000-0000-0000-000000000009', 'Batata',                'verduras',   'kg',  20,  10, 900.00,  'Mercado Central'),
  ('c0000000-0000-0000-0000-000000000010', 'Jamón cocido',          'carnes',     'kg',  15,  8,  6500.00, 'Fiambrería Central'),
  ('c0000000-0000-0000-0000-000000000011', 'Queso cremoso',         'lacteos',    'kg',  20,  10, 5200.00, 'Lácteos del Oeste'),
  ('c0000000-0000-0000-0000-000000000012', 'Arroz largo fino',      'secos',      'kg',  40,  15, 950.00,  'Distribuidora Norte'),
  ('c0000000-0000-0000-0000-000000000013', 'Fideos secos (spaguetti)', 'secos',   'kg',  35,  15, 850.00,  'Distribuidora Norte'),
  ('c0000000-0000-0000-0000-000000000014', 'Pan de miga',           'secos',      'un',  50,  20, 350.00,  'Panadería Don Luis'),
  ('c0000000-0000-0000-0000-000000000015', 'Aceite girasol',        'condimentos','lt',  20,  8,  1100.00, 'Distribuidora Norte');

-- ===== 4. RECETAS CON FICHAS TÉCNICAS (5) =====

-- Receta 1: Milanesa de carne con ensalada
INSERT INTO recipes (id, name, category, is_active)
VALUES ('d0000000-0000-0000-0000-000000000001', 'Milanesa de carne con ensalada', 'principal', true);

INSERT INTO recipe_versions (id, recipe_id, version, portions_yield, preparation_notes, cost_per_portion, is_current, created_by)
VALUES ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 1, 10,
  'Cortar nalga en fetas finas. Pasar por huevo y pan rallado (harina). Freír en aceite hasta dorar. Servir con ensalada de lechuga y tomate.',
  0, true, 'b0000000-0000-0000-0000-000000000001');

INSERT INTO recipe_ingredients (recipe_version_id, inventory_item_id, quantity, unit) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 2.0, 'kg'),   -- Carne
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 0.5, 'kg'),   -- Harina
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000005', 6,   'un'),   -- Huevos
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000007', 3,   'un'),   -- Lechuga
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000006', 1.0, 'kg'),   -- Tomate
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000015', 1.0, 'lt');   -- Aceite

-- Receta 2: Ravioles con salsa fileto
INSERT INTO recipes (id, name, category, is_active)
VALUES ('d0000000-0000-0000-0000-000000000002', 'Ravioles con salsa fileto', 'principal', true);

INSERT INTO recipe_versions (id, recipe_id, version, portions_yield, preparation_notes, cost_per_portion, is_current, created_by)
VALUES ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 1, 10,
  'Preparar masa con harina y huevos. Rellenar con muzzarella. Salsa fileto: tomate, ajo, albahaca.',
  0, true, 'b0000000-0000-0000-0000-000000000001');

INSERT INTO recipe_ingredients (recipe_version_id, inventory_item_id, quantity, unit) VALUES
  ('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000004', 1.5, 'kg'),  -- Harina
  ('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000005', 8,   'un'),  -- Huevos
  ('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000006', 2.0, 'kg'),  -- Tomate
  ('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 1.0, 'kg');  -- Muzzarella

-- Receta 3: Tarta de jamón y queso
INSERT INTO recipes (id, name, category, is_active)
VALUES ('d0000000-0000-0000-0000-000000000003', 'Tarta de jamón y queso', 'tarta', true);

INSERT INTO recipe_versions (id, recipe_id, version, portions_yield, preparation_notes, cost_per_portion, is_current, created_by)
VALUES ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 1, 8,
  'Masa: harina, huevos, manteca. Relleno: jamón cocido, queso cremoso, huevos batidos. Hornear 30 min a 180°C.',
  0, true, 'b0000000-0000-0000-0000-000000000001');

INSERT INTO recipe_ingredients (recipe_version_id, inventory_item_id, quantity, unit) VALUES
  ('e0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000004', 0.8, 'kg'),  -- Harina
  ('e0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000010', 1.0, 'kg'),  -- Jamón
  ('e0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000011', 0.8, 'kg'),  -- Queso cremoso
  ('e0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000005', 4,   'un');  -- Huevos

-- Receta 4: Ensalada Caesar
INSERT INTO recipes (id, name, category, is_active)
VALUES ('d0000000-0000-0000-0000-000000000004', 'Ensalada Caesar', 'ensalada', true);

INSERT INTO recipe_versions (id, recipe_id, version, portions_yield, preparation_notes, cost_per_portion, is_current, created_by)
VALUES ('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000004', 1, 10,
  'Lechuga romana troceada, pechuga de pollo grillada, queso parmesano. Aderezo Caesar aparte.',
  0, true, 'b0000000-0000-0000-0000-000000000001');

INSERT INTO recipe_ingredients (recipe_version_id, inventory_item_id, quantity, unit) VALUES
  ('e0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000007', 5,   'un'),  -- Lechuga
  ('e0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 1.5, 'kg'),  -- Pollo
  ('e0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000003', 0.3, 'kg');  -- Queso (parmesano → muzzarella en seed)

-- Receta 5: Ñoquis con bolognesa
INSERT INTO recipes (id, name, category, is_active)
VALUES ('d0000000-0000-0000-0000-000000000005', 'Ñoquis con bolognesa', 'principal', true);

INSERT INTO recipe_versions (id, recipe_id, version, portions_yield, preparation_notes, cost_per_portion, is_current, created_by)
VALUES ('e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000005', 1, 10,
  'Ñoquis: papa hervida, harina, huevo. Bolognesa: carne picada, tomate, cebolla, zanahoria. Cocción lenta 45 min.',
  0, true, 'b0000000-0000-0000-0000-000000000001');

INSERT INTO recipe_ingredients (recipe_version_id, inventory_item_id, quantity, unit) VALUES
  ('e0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000008', 3.0, 'kg'),  -- Papa
  ('e0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000004', 1.0, 'kg'),  -- Harina
  ('e0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001', 1.5, 'kg'),  -- Carne
  ('e0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000006', 1.5, 'kg'),  -- Tomate
  ('e0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000005', 2,   'un');  -- Huevos

-- ===== 5. MENÚ SEMANAL (semana del 6 al 10 de abril 2026) =====
INSERT INTO weekly_menus (id, week_start, week_end, week_number, status)
VALUES ('f0000000-0000-0000-0000-000000000001', '2026-04-06', '2026-04-10', 15, 'published');

-- Lunes (day_of_week = 1) — 7 opciones
INSERT INTO menu_items (menu_id, day_of_week, option_code, recipe_version_id, category, display_name) VALUES
  ('f0000000-0000-0000-0000-000000000001', 1, 'A', 'e0000000-0000-0000-0000-000000000005', 'principal',    'Ñoquis con bolognesa'),
  ('f0000000-0000-0000-0000-000000000001', 1, 'B', 'e0000000-0000-0000-0000-000000000001', 'alternativa',  'Milanesa de carne con ensalada'),
  ('f0000000-0000-0000-0000-000000000001', 1, 'C', NULL, 'sandwich',    'Sándwich de jamón y queso'),
  ('f0000000-0000-0000-0000-000000000001', 1, 'D', 'e0000000-0000-0000-0000-000000000003', 'tarta',       'Tarta de jamón y queso'),
  ('f0000000-0000-0000-0000-000000000001', 1, 'E', 'e0000000-0000-0000-0000-000000000004', 'ensalada',    'Ensalada Caesar'),
  ('f0000000-0000-0000-0000-000000000001', 1, 'F', NULL, 'veggie',      'Tarta de verduras'),
  ('f0000000-0000-0000-0000-000000000001', 1, 'G', NULL, 'especial',    'Pollo al horno con papas');

-- Martes (day_of_week = 2)
INSERT INTO menu_items (menu_id, day_of_week, option_code, recipe_version_id, category, display_name) VALUES
  ('f0000000-0000-0000-0000-000000000001', 2, 'H', 'e0000000-0000-0000-0000-000000000002', 'principal',    'Ravioles con salsa fileto'),
  ('f0000000-0000-0000-0000-000000000001', 2, 'I', 'e0000000-0000-0000-0000-000000000001', 'alternativa',  'Milanesa napolitana'),
  ('f0000000-0000-0000-0000-000000000001', 2, 'J', NULL, 'sandwich',    'Sándwich de atún'),
  ('f0000000-0000-0000-0000-000000000001', 2, 'K', 'e0000000-0000-0000-0000-000000000003', 'tarta',       'Tarta de choclo'),
  ('f0000000-0000-0000-0000-000000000001', 2, 'L', 'e0000000-0000-0000-0000-000000000004', 'ensalada',    'Ensalada de pollo grillado'),
  ('f0000000-0000-0000-0000-000000000001', 2, 'M', NULL, 'veggie',      'Omelette de espinaca'),
  ('f0000000-0000-0000-0000-000000000001', 2, 'N', NULL, 'especial',    'Arroz con pollo');

-- Miércoles (day_of_week = 3)
INSERT INTO menu_items (menu_id, day_of_week, option_code, recipe_version_id, category, display_name) VALUES
  ('f0000000-0000-0000-0000-000000000001', 3, 'O', NULL, 'principal',    'Pastel de papa'),
  ('f0000000-0000-0000-0000-000000000001', 3, 'P', 'e0000000-0000-0000-0000-000000000002', 'alternativa', 'Fideos con pesto'),
  ('f0000000-0000-0000-0000-000000000001', 3, 'Q', NULL, 'sandwich',    'Sándwich de milanesa'),
  ('f0000000-0000-0000-0000-000000000001', 3, 'R', NULL, 'tarta',       'Tarta caprese'),
  ('f0000000-0000-0000-0000-000000000001', 3, 'S', 'e0000000-0000-0000-0000-000000000004', 'ensalada',    'Ensalada rusa'),
  ('f0000000-0000-0000-0000-000000000001', 3, 'T', NULL, 'veggie',      'Canelones de ricota'),
  ('f0000000-0000-0000-0000-000000000001', 3, 'U', NULL, 'especial',    'Suprema de pollo');

-- Jueves (day_of_week = 4)
INSERT INTO menu_items (menu_id, day_of_week, option_code, recipe_version_id, category, display_name) VALUES
  ('f0000000-0000-0000-0000-000000000001', 4, 'V',  'e0000000-0000-0000-0000-000000000001', 'principal',   'Milanesa con puré'),
  ('f0000000-0000-0000-0000-000000000001', 4, 'W',  'e0000000-0000-0000-0000-000000000005', 'alternativa', 'Ñoquis con tuco'),
  ('f0000000-0000-0000-0000-000000000001', 4, 'X',  NULL, 'sandwich',    'Sándwich triple'),
  ('f0000000-0000-0000-0000-000000000001', 4, 'Y',  'e0000000-0000-0000-0000-000000000003', 'tarta',      'Tarta de atún'),
  ('f0000000-0000-0000-0000-000000000001', 4, 'Z',  NULL, 'ensalada',    'Ensalada de lentejas'),
  ('f0000000-0000-0000-0000-000000000001', 4, 'AA', NULL, 'veggie',      'Tortilla de papa'),
  ('f0000000-0000-0000-0000-000000000001', 4, 'BB', NULL, 'especial',    'Estofado de carne');

-- Viernes (day_of_week = 5)
INSERT INTO menu_items (menu_id, day_of_week, option_code, recipe_version_id, category, display_name) VALUES
  ('f0000000-0000-0000-0000-000000000001', 5, 'CC', 'e0000000-0000-0000-0000-000000000002', 'principal',   'Sorrentinos con salsa rosa'),
  ('f0000000-0000-0000-0000-000000000001', 5, 'DD', NULL, 'alternativa',  'Pollo grillado con arroz'),
  ('f0000000-0000-0000-0000-000000000001', 5, 'EE', NULL, 'sandwich',    'Sándwich club'),
  ('f0000000-0000-0000-0000-000000000001', 5, 'FF', NULL, 'tarta',       'Empanadas de carne'),
  ('f0000000-0000-0000-0000-000000000001', 5, 'GG', 'e0000000-0000-0000-0000-000000000004', 'ensalada',   'Ensalada waldorf'),
  ('f0000000-0000-0000-0000-000000000001', 5, 'HH', NULL, 'veggie',      'Wok de verduras con arroz'),
  ('f0000000-0000-0000-0000-000000000001', 5, 'II', NULL, 'especial',    'Bife a la criolla');
