-- Restored from supabase_migrations.schema_migrations via MCP
-- Filename: 20260425164348_b9_trigger_update_order_totals
-- Source of truth: live BD (project zenlpuiaavdgeyplfcma)

-- B.9: Trigger para actualizar total_units y total_amount de orders cuando cambian order_lines

CREATE OR REPLACE FUNCTION fn_update_order_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id UUID;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);
  
  UPDATE orders
  SET 
    total_units = COALESCE((SELECT SUM(quantity) FROM order_lines WHERE order_id = v_order_id), 0),
    total_amount = COALESCE((SELECT SUM(quantity * unit_price) FROM order_lines WHERE order_id = v_order_id), 0),
    updated_at = NOW()
  WHERE id = v_order_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_order_totals ON order_lines;
CREATE TRIGGER trg_update_order_totals
AFTER INSERT OR UPDATE OR DELETE ON order_lines
FOR EACH ROW
EXECUTE FUNCTION fn_update_order_totals();

UPDATE orders o
SET 
  total_units = COALESCE((SELECT SUM(ol.quantity) FROM order_lines ol WHERE ol.order_id = o.id), 0),
  total_amount = COALESCE((SELECT SUM(ol.quantity * ol.unit_price) FROM order_lines ol WHERE ol.order_id = o.id), 0);
