-- Restored from supabase_migrations.schema_migrations via MCP
-- Filename: 20260426233250_b15_1_update_participant_totals
-- Source of truth: live BD (project zenlpuiaavdgeyplfcma)

-- B.15.1: extender fn_update_order_totals para mantener participant.total_quantity

CREATE OR REPLACE FUNCTION public.fn_update_order_totals()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_order_id UUID;
  v_participant_id UUID;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);
  v_participant_id := COALESCE(NEW.participant_id, OLD.participant_id);
  
  UPDATE orders
  SET 
    total_units = COALESCE((SELECT SUM(quantity) FROM order_lines WHERE order_id = v_order_id), 0),
    total_amount = COALESCE((SELECT SUM(quantity * unit_price) FROM order_lines WHERE order_id = v_order_id), 0),
    updated_at = NOW()
  WHERE id = v_order_id;
  
  IF v_participant_id IS NOT NULL THEN
    UPDATE order_participants
    SET total_quantity = COALESCE(
      (SELECT SUM(quantity) FROM order_lines WHERE participant_id = v_participant_id), 0
    )
    WHERE id = v_participant_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

UPDATE order_participants op
SET total_quantity = sub.calc
FROM (
  SELECT participant_id, SUM(quantity)::int AS calc
  FROM order_lines
  WHERE participant_id IS NOT NULL
  GROUP BY participant_id
) sub
WHERE op.id = sub.participant_id
  AND op.total_quantity IS DISTINCT FROM sub.calc;
