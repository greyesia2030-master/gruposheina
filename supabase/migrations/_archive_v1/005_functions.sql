-- 005: Funciones y triggers de negocio
-- Sistema de Gestión de Viandas — Grupo Sheina

-- ===== fn_update_stock: Registra movimiento y actualiza stock atómicamente =====
CREATE OR REPLACE FUNCTION fn_update_stock(
  p_item_id UUID,
  p_qty NUMERIC,
  p_movement_type movement_type,
  p_reason TEXT DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL,
  p_unit_cost NUMERIC DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS inventory_movements AS $$
DECLARE
  v_new_stock NUMERIC;
  v_movement inventory_movements;
BEGIN
  -- Calcular nuevo stock según tipo de movimiento
  SELECT current_stock INTO v_new_stock FROM inventory_items WHERE id = p_item_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insumo con ID % no encontrado', p_item_id;
  END IF;

  -- Determinar si suma o resta
  IF p_movement_type IN ('purchase', 'adjustment_pos', 'return') THEN
    v_new_stock := v_new_stock + ABS(p_qty);
  ELSIF p_movement_type IN ('production_consumption', 'waste', 'adjustment_neg') THEN
    v_new_stock := v_new_stock - ABS(p_qty);
  END IF;

  -- Validar que no quede stock negativo (excepto ajustes negativos forzados)
  IF v_new_stock < 0 AND p_movement_type != 'adjustment_neg' THEN
    RAISE EXCEPTION 'Stock insuficiente para %. Stock actual: %, intento de consumo: %',
      (SELECT name FROM inventory_items WHERE id = p_item_id),
      (SELECT current_stock FROM inventory_items WHERE id = p_item_id),
      ABS(p_qty);
  END IF;

  -- Actualizar stock
  UPDATE inventory_items
  SET current_stock = v_new_stock, updated_at = now()
  WHERE id = p_item_id;

  -- Registrar movimiento
  INSERT INTO inventory_movements (
    item_id, movement_type, quantity, unit_cost,
    reference_type, reference_id, reason, actor_id, stock_after
  ) VALUES (
    p_item_id, p_movement_type, p_qty, COALESCE(p_unit_cost, (SELECT cost_per_unit FROM inventory_items WHERE id = p_item_id)),
    p_reference_type, p_reference_id, p_reason, p_actor_id, v_new_stock
  )
  RETURNING * INTO v_movement;

  RETURN v_movement;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===== fn_calculate_recipe_cost: Recalcula costo por porción =====
CREATE OR REPLACE FUNCTION fn_calculate_recipe_cost(p_recipe_version_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_total_cost NUMERIC := 0;
  v_portions INTEGER;
  v_cost_per_portion NUMERIC;
BEGIN
  -- Obtener rendimiento en porciones
  SELECT portions_yield INTO v_portions
  FROM recipe_versions WHERE id = p_recipe_version_id;

  IF NOT FOUND OR v_portions IS NULL OR v_portions = 0 THEN
    RETURN 0;
  END IF;

  -- Sumar costo de todos los ingredientes
  SELECT COALESCE(SUM(ri.quantity * ii.cost_per_unit), 0) INTO v_total_cost
  FROM recipe_ingredients ri
  JOIN inventory_items ii ON ii.id = ri.inventory_item_id
  WHERE ri.recipe_version_id = p_recipe_version_id;

  v_cost_per_portion := ROUND(v_total_cost / v_portions, 2);

  -- Actualizar el costo en la versión
  UPDATE recipe_versions
  SET cost_per_portion = v_cost_per_portion
  WHERE id = p_recipe_version_id;

  RETURN v_cost_per_portion;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===== fn_check_cutoff: Verifica si un pedido está dentro de la ventana de corte =====
CREATE OR REPLACE FUNCTION fn_check_cutoff(p_order_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_order RECORD;
  v_org RECORD;
  v_menu RECORD;
  v_cutoff_datetime TIMESTAMPTZ;
BEGIN
  -- Obtener datos del pedido
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido con ID % no encontrado', p_order_id;
  END IF;

  -- Obtener datos de la organización
  SELECT * INTO v_org FROM organizations WHERE id = v_order.organization_id;

  -- Obtener fecha de entrega (primer día del menú)
  SELECT * INTO v_menu FROM weekly_menus WHERE id = v_order.menu_id;
  IF NOT FOUND THEN
    -- Si no hay menú vinculado, considerar dentro de corte
    RETURN true;
  END IF;

  -- Calcular datetime de corte: fecha_inicio_menu - cutoff_days_before, a las cutoff_time
  v_cutoff_datetime := (v_menu.week_start - v_org.cutoff_days_before * INTERVAL '1 day')
                       + v_org.cutoff_time;

  -- Si ahora es antes del corte → dentro de ventana (true)
  RETURN now() < v_cutoff_datetime;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ===== Trigger: recalcular costo de receta al modificar ingredientes =====
CREATE OR REPLACE FUNCTION trg_recalculate_recipe_cost()
RETURNS TRIGGER AS $$
DECLARE
  v_version_id UUID;
BEGIN
  -- Determinar qué version_id usar
  IF TG_OP = 'DELETE' THEN
    v_version_id := OLD.recipe_version_id;
  ELSE
    v_version_id := NEW.recipe_version_id;
  END IF;

  PERFORM fn_calculate_recipe_cost(v_version_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recipe_ingredients_cost
  AFTER INSERT OR UPDATE OR DELETE ON recipe_ingredients
  FOR EACH ROW EXECUTE FUNCTION trg_recalculate_recipe_cost();
