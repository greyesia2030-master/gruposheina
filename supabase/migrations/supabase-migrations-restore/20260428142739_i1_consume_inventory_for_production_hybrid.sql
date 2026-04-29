-- Restored from supabase_migrations.schema_migrations via MCP
-- Filename: 20260428142739_i1_consume_inventory_for_production_hybrid
-- Source of truth: live BD (project zenlpuiaavdgeyplfcma)

-- Función RPC: consume_inventory_for_production (versión inicial)
-- Descuenta qty_needed del inventory_item siguiendo lógica híbrida (FIFO + fallback)

CREATE OR REPLACE FUNCTION public.consume_inventory_for_production(
  p_item_id uuid,
  p_qty_needed numeric,
  p_ticket_id uuid,
  p_actor_id uuid,
  p_unit text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining numeric := p_qty_needed;
  v_lot RECORD;
  v_take numeric;
  v_consumed_lots jsonb := '[]'::jsonb;
  v_used_fallback boolean := false;
  v_item_unit text;
  v_total_cost numeric := 0;
BEGIN
  IF p_qty_needed IS NULL OR p_qty_needed <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'consumed', '[]'::jsonb, 'fallback', false);
  END IF;

  SELECT unit INTO v_item_unit FROM inventory_items WHERE id = p_item_id;
  IF v_item_unit IS NULL THEN
    RAISE EXCEPTION 'inventory_item % no existe', p_item_id;
  END IF;

  FOR v_lot IN
    SELECT id, quantity_remaining, received_at, cost_per_unit, lot_code
    FROM inventory_lots
    WHERE item_id = p_item_id AND NOT is_depleted AND quantity_remaining > 0
    ORDER BY received_at ASC, id ASC
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_take := LEAST(v_lot.quantity_remaining, v_remaining);

    UPDATE inventory_lots
    SET quantity_remaining = quantity_remaining - v_take,
        is_depleted = (quantity_remaining - v_take) <= 0,
        updated_at = now()
    WHERE id = v_lot.id;

    INSERT INTO production_lot_consumption (ticket_id, lot_id, quantity_consumed, unit, recorded_by)
    VALUES (p_ticket_id, v_lot.id, v_take, COALESCE(p_unit, v_item_unit), p_actor_id);

    v_consumed_lots := v_consumed_lots || jsonb_build_object(
      'lot_id', v_lot.id,
      'lot_code', v_lot.lot_code,
      'quantity_consumed', v_take,
      'cost', COALESCE(v_lot.cost_per_unit, 0) * v_take
    );
    v_total_cost := v_total_cost + COALESCE(v_lot.cost_per_unit, 0) * v_take;
    v_remaining := v_remaining - v_take;
  END LOOP;

  IF v_remaining > 0 THEN
    v_used_fallback := true;
    UPDATE inventory_items
    SET current_stock = GREATEST(0, current_stock - v_remaining), updated_at = now()
    WHERE id = p_item_id;
    v_remaining := 0;
  END IF;

  INSERT INTO inventory_movements (
    item_id, movement_type, quantity, unit_cost, reference_type, reference_id, reason, actor_id, unit
  ) VALUES (
    p_item_id, 'consumption', p_qty_needed,
    CASE WHEN p_qty_needed > 0 THEN v_total_cost / p_qty_needed ELSE NULL END,
    'production_ticket', p_ticket_id,
    CASE WHEN v_used_fallback THEN 'Producción (FIFO + fallback)' ELSE 'Producción (FIFO)' END,
    p_actor_id, COALESCE(p_unit, v_item_unit)
  );

  RETURN jsonb_build_object('ok', true, 'consumed', v_consumed_lots, 'fallback', v_used_fallback, 'total_cost', v_total_cost);
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_inventory_for_production TO authenticated;

COMMENT ON FUNCTION public.consume_inventory_for_production IS
'Descuenta inventario para un production_ticket usando FIFO sobre lots; si no hay lots, fallback a inventory_items.current_stock.';
