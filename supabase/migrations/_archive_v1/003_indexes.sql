-- 003: Índices para consultas frecuentes
-- Sistema de Gestión de Viandas — Grupo Sheina

-- Organizaciones
CREATE INDEX idx_organizations_status ON organizations(status);

-- Usuarios
CREATE INDEX idx_users_auth_id ON users(auth_id);
CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_email ON users(email);

-- Menús semanales
CREATE INDEX idx_weekly_menus_week_start ON weekly_menus(week_start);
CREATE INDEX idx_weekly_menus_status ON weekly_menus(status);
CREATE INDEX idx_weekly_menus_week_number ON weekly_menus(week_number);

-- Opciones de menú
CREATE INDEX idx_menu_items_menu_id ON menu_items(menu_id);
CREATE INDEX idx_menu_items_day_of_week ON menu_items(menu_id, day_of_week);
CREATE INDEX idx_menu_items_recipe_version_id ON menu_items(recipe_version_id);

-- Recetas
CREATE INDEX idx_recipes_category ON recipes(category);
CREATE INDEX idx_recipes_is_active ON recipes(is_active);

-- Versiones de receta
CREATE INDEX idx_recipe_versions_recipe_id ON recipe_versions(recipe_id);
CREATE INDEX idx_recipe_versions_is_current ON recipe_versions(recipe_id, is_current);

-- Ingredientes de receta
CREATE INDEX idx_recipe_ingredients_version_id ON recipe_ingredients(recipe_version_id);
CREATE INDEX idx_recipe_ingredients_item_id ON recipe_ingredients(inventory_item_id);

-- Pedidos
CREATE INDEX idx_orders_organization_id ON orders(organization_id);
CREATE INDEX idx_orders_menu_id ON orders(menu_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_org_status ON orders(organization_id, status);

-- Líneas de pedido
CREATE INDEX idx_order_lines_order_id ON order_lines(order_id);
CREATE INDEX idx_order_lines_menu_item_id ON order_lines(menu_item_id);
CREATE INDEX idx_order_lines_day_of_week ON order_lines(order_id, day_of_week);

-- Eventos de auditoría
CREATE INDEX idx_order_events_order_id ON order_events(order_id);
CREATE INDEX idx_order_events_created_at ON order_events(order_id, created_at DESC);
CREATE INDEX idx_order_events_event_type ON order_events(event_type);

-- Inventario
CREATE INDEX idx_inventory_items_category ON inventory_items(category);
CREATE INDEX idx_inventory_items_is_active ON inventory_items(is_active);
CREATE INDEX idx_inventory_items_low_stock ON inventory_items(current_stock, min_stock) WHERE is_active = true;

-- Movimientos de inventario
CREATE INDEX idx_inventory_movements_item_id ON inventory_movements(item_id);
CREATE INDEX idx_inventory_movements_created_at ON inventory_movements(item_id, created_at DESC);
CREATE INDEX idx_inventory_movements_type ON inventory_movements(movement_type);
