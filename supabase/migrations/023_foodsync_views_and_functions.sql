-- FoodSync v2 — Migration 013 (local: 023)
-- Vista v_item_stock_by_site, fn_consume_from_lots, fn_close_order_section,
-- fn_check_order_sections_closed + trigger

CREATE OR REPLACE VIEW public.v_item_stock_by_site AS
SELECT
  ii.id AS item_id,
  ii.name AS item_name,
  ii.requires_lot_tracking,
  ii.default_unit,
  s.id AS site_id,
  s.name AS site_name,
  CASE
    WHEN ii.requires_lot_tracking THEN
      COALESCE((
        SELECT SUM(il.quantity_remaining)
        FROM inventory_lots il
        WHERE il.item_id = ii.id
          AND il.site_id = s.id
          AND il.quantity_remaining > 0
      ), 0)
    ELSE
      COALESCE((
        SELECT SUM(CASE
          WHEN im.movement_type IN (
            'purchase', 'adjustment_pos', 'transfer_in', 'return'
          ) THEN im.quantity
          WHEN im.movement_type IN (
            'production_consumption', 'cook_consumption',
            'waste_approved', 'adjustment_neg', 'transfer_out'
          ) THEN -im.quantity
          ELSE 0
        END)
        FROM inventory_movements im
        WHERE im.item_id = ii.id AND im.site_id = s.id
      ), 0)
  END AS current_stock
FROM inventory_items ii
CROSS JOIN sites s
WHERE ii.is_active AND s.is_active;

COMMENT ON VIEW public.v_item_stock_by_site IS
'Stock real por item y sitio. Híbrido: suma lotes si requires_lot_tracking, si no suma movimientos';

CREATE OR REPLACE FUNCTION public.fn_consume_from_lots(
  p_item_id UUID,
  p_site_id UUID,
  p_quantity DECIMAL,
  p_unit VARCHAR,
  p_ticket_id UUID,
  p_recorded_by UUID
) RETURNS JSONB AS $$
DECLARE
  v_remaining DECIMAL := p_quantity;
  v_lot RECORD;
  v_to_consume DECIMAL;
  v_lots_used JSONB := '[]'::jsonb;
BEGIN
  FOR v_lot IN
    SELECT id, quantity_remaining
    FROM inventory_lots
    WHERE item_id = p_item_id
      AND site_id = p_site_id
      AND quantity_remaining > 0
      AND unit = p_unit
    ORDER BY received_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_to_consume := LEAST(v_lot.quantity_remaining, v_remaining);

    UPDATE inventory_lots
    SET quantity_remaining = quantity_remaining - v_to_consume,
        updated_at = NOW()
    WHERE id = v_lot.id;

    INSERT INTO production_lot_consumption
      (ticket_id, lot_id, quantity_consumed, unit, recorded_by)
    VALUES
      (p_ticket_id, v_lot.id, v_to_consume, p_unit, p_recorded_by);

    v_lots_used := v_lots_used || jsonb_build_object(
      'lot_id', v_lot.id,
      'consumed', v_to_consume
    );
    v_remaining := v_remaining - v_to_consume;
  END LOOP;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Stock insuficiente: faltan % % del item %', v_remaining, p_unit, p_item_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'lots_used', v_lots_used);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.fn_close_order_section(
  p_section_id UUID,
  p_participant_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_total INTEGER;
BEGIN
  SELECT COALESCE(SUM(quantity), 0) INTO v_total
  FROM order_lines WHERE section_id = p_section_id;

  UPDATE order_sections
  SET closed_at = NOW(),
      closed_by_participant_id = p_participant_id,
      total_quantity = v_total
  WHERE id = p_section_id AND closed_at IS NULL;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.fn_check_order_sections_closed()
RETURNS TRIGGER AS $$
DECLARE
  v_total INTEGER;
  v_closed INTEGER;
  v_order_id UUID;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);

  SELECT COUNT(*), COUNT(*) FILTER (WHERE closed_at IS NOT NULL)
  INTO v_total, v_closed
  FROM order_sections WHERE order_id = v_order_id;

  IF v_total > 0 AND v_total = v_closed THEN
    UPDATE orders
    SET status = 'awaiting_confirmation',
        updated_at = NOW()
    WHERE id = v_order_id AND status IN ('draft', 'partially_filled');
  ELSIF v_closed > 0 AND v_total > v_closed THEN
    UPDATE orders
    SET status = 'partially_filled',
        updated_at = NOW()
    WHERE id = v_order_id AND status = 'draft';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_sections_closed ON order_sections;
CREATE TRIGGER trg_check_sections_closed
AFTER UPDATE OF closed_at ON order_sections
FOR EACH ROW EXECUTE FUNCTION public.fn_check_order_sections_closed();
