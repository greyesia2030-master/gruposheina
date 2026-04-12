-- 002: Tablas principales
-- Sistema de Gestión de Viandas — Grupo Sheina

-- ===== 1. ORGANIZACIONES (clientes PYME) =====
CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  cuit        TEXT UNIQUE,
  contact_phone TEXT,
  email       TEXT,
  cutoff_time TIME NOT NULL DEFAULT '18:00',
  cutoff_days_before INTEGER NOT NULL DEFAULT 1 CHECK (cutoff_days_before >= 0),
  departments JSONB NOT NULL DEFAULT '["adm","vtas","diet","log","otros"]'::jsonb,
  status      org_status NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 2. USUARIOS =====
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id         UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  role            user_role NOT NULL DEFAULT 'client_user',
  full_name       TEXT NOT NULL,
  phone           TEXT,
  email           TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 3. MENÚS SEMANALES =====
CREATE TABLE weekly_menus (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_start  DATE NOT NULL,
  week_end    DATE NOT NULL,
  week_number INTEGER NOT NULL CHECK (week_number BETWEEN 1 AND 53),
  status      menu_status NOT NULL DEFAULT 'draft',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_week_range CHECK (week_end > week_start)
);

-- ===== 4. OPCIONES DE MENÚ POR DÍA =====
CREATE TABLE menu_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_id           UUID NOT NULL REFERENCES weekly_menus(id) ON DELETE CASCADE,
  day_of_week       INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
  option_code       TEXT NOT NULL,
  recipe_version_id UUID, -- FK se agrega después de crear recipe_versions
  category          menu_category NOT NULL,
  display_name      TEXT NOT NULL,
  is_available      BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_menu_day_option UNIQUE (menu_id, day_of_week, option_code)
);

-- ===== 5. RECETAS (entidad lógica) =====
CREATE TABLE recipes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  category    menu_category NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 6. VERSIONES DE RECETA (inmutables) =====
CREATE TABLE recipe_versions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id           UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  version             INTEGER NOT NULL CHECK (version >= 1),
  portions_yield      INTEGER NOT NULL CHECK (portions_yield > 0),
  preparation_notes   TEXT,
  cost_per_portion    NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_current          BOOLEAN NOT NULL DEFAULT true,
  created_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_recipe_version UNIQUE (recipe_id, version)
);

-- Agregar FK de menu_items a recipe_versions
ALTER TABLE menu_items
  ADD CONSTRAINT fk_menu_item_recipe_version
  FOREIGN KEY (recipe_version_id) REFERENCES recipe_versions(id) ON DELETE SET NULL;

-- ===== 7. INGREDIENTES DE RECETA =====
-- Se crea después de inventory_items (FK circular)

-- ===== 8. PEDIDOS =====
CREATE TABLE orders (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL REFERENCES organizations(id),
  menu_id           UUID REFERENCES weekly_menus(id),
  week_label        TEXT NOT NULL,
  status            order_status NOT NULL DEFAULT 'draft',
  source            order_source NOT NULL DEFAULT 'web_form',
  total_units       INTEGER NOT NULL DEFAULT 0 CHECK (total_units >= 0),
  total_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_status    payment_status NOT NULL DEFAULT 'pending',
  confirmed_at      TIMESTAMPTZ,
  confirmed_by      UUID REFERENCES users(id),
  original_file_url TEXT,
  ai_parsing_log    JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 9. LÍNEAS DE PEDIDO =====
CREATE TABLE order_lines (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id      UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  day_of_week       INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
  department        TEXT NOT NULL,
  quantity          INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit_price        NUMERIC(10,2) NOT NULL DEFAULT 0,
  recipe_version_id UUID REFERENCES recipe_versions(id),
  option_code       TEXT NOT NULL,
  display_name      TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 10. EVENTOS DE AUDITORÍA (append-only) =====
CREATE TABLE order_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type      event_type NOT NULL,
  actor_id        UUID REFERENCES users(id),
  actor_role      actor_role NOT NULL DEFAULT 'system',
  payload         JSONB DEFAULT '{}'::jsonb,
  is_post_cutoff  BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 11. INSUMOS DE INVENTARIO =====
CREATE TABLE inventory_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  category      inv_category NOT NULL,
  unit          TEXT NOT NULL,
  current_stock NUMERIC(10,3) NOT NULL DEFAULT 0,
  min_stock     NUMERIC(10,3) NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  cost_per_unit NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (cost_per_unit >= 0),
  supplier      TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 7. INGREDIENTES DE RECETA (creada aquí por dependencia de inventory_items) =====
CREATE TABLE recipe_ingredients (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_version_id UUID NOT NULL REFERENCES recipe_versions(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
  quantity          NUMERIC(10,3) NOT NULL CHECK (quantity > 0),
  unit              TEXT NOT NULL,
  substitute_item_id UUID REFERENCES inventory_items(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== 12. MOVIMIENTOS DE INVENTARIO (append-only) =====
CREATE TABLE inventory_movements (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id         UUID NOT NULL REFERENCES inventory_items(id),
  movement_type   movement_type NOT NULL,
  quantity         NUMERIC(10,3) NOT NULL,
  unit_cost        NUMERIC(10,2),
  reference_type   TEXT,
  reference_id     UUID,
  reason           TEXT,
  actor_id         UUID REFERENCES users(id),
  stock_after      NUMERIC(10,3) NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== TRIGGERS DE updated_at =====
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_weekly_menus_updated_at BEFORE UPDATE ON weekly_menus FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_recipes_updated_at BEFORE UPDATE ON recipes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_order_lines_updated_at BEFORE UPDATE ON order_lines FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_inventory_items_updated_at BEFORE UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
