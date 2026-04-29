-- Restored from supabase_migrations.schema_migrations via MCP
-- Filename: 20260428212247_fix_m_trigger_promote_to_ready_for_delivery
-- Source of truth: live BD (project zenlpuiaavdgeyplfcma)

-- FIX-M: cuando todos los tickets están ready, el order pasa a 'ready_for_delivery'.
-- Las transiciones a 'out_for_delivery' y 'delivered' las dispara logística manualmente.

CREATE OR REPLACE FUNCTION public.trg_check_all_tickets_ready()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_status order_status;
  v_total_tickets int;
  v_ready_or_cancelled int;
BEGIN
  IF NEW.status NOT IN ('ready', 'cancelled') THEN
    RETURN NEW;
  END IF;

  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT status INTO v_order_status FROM orders WHERE id = NEW.order_id;
  IF v_order_status != 'in_production' THEN
    RETURN NEW;
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('ready','cancelled'))
  INTO v_total_tickets, v_ready_or_cancelled
  FROM production_tickets
  WHERE order_id = NEW.order_id;

  IF v_total_tickets > 0 AND v_total_tickets = v_ready_or_cancelled THEN
    UPDATE orders SET status = 'ready_for_delivery' WHERE id = NEW.order_id;

    INSERT INTO order_events (order_id, event_type, actor_role, payload)
    VALUES (
      NEW.order_id,
      'ready_for_delivery',
      'system',
      jsonb_build_object(
        'trigger', 'all_tickets_ready',
        'total_tickets', v_total_tickets,
        'ready_or_cancelled', v_ready_or_cancelled
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;
