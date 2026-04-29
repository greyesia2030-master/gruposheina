-- Restored from supabase_migrations.schema_migrations via MCP
-- Filename: 20260428175059_l1_auto_deliver_when_all_tickets_ready
-- Source of truth: live BD (project zenlpuiaavdgeyplfcma)

-- Trigger: cuando TODOS los tickets de un order pasan a 'ready'/'cancelled', el order pasa a 'delivered'.
-- (Esta versión queda obsoleta luego con fix-M; se mantiene para reproducibilidad cronológica.)

CREATE OR REPLACE FUNCTION public.trg_check_all_tickets_ready()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    UPDATE orders SET status = 'delivered' WHERE id = NEW.order_id;

    INSERT INTO order_events (order_id, event_type, actor_role, payload)
    VALUES (
      NEW.order_id, 'delivered', 'system',
      jsonb_build_object(
        'trigger', 'all_tickets_ready',
        'total_tickets', v_total_tickets,
        'ready_or_cancelled', v_ready_or_cancelled
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_tickets_ready_on_update ON production_tickets;

CREATE TRIGGER trg_check_tickets_ready_on_update
AFTER UPDATE OF status ON production_tickets
FOR EACH ROW
EXECUTE FUNCTION trg_check_all_tickets_ready();
