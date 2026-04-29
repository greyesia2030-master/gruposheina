-- Restored from supabase_migrations.schema_migrations via MCP
-- Filename: 20260428212350_fix_m_realign_notification_triggers
-- Source of truth: live BD (project zenlpuiaavdgeyplfcma)

-- Realinear: notificación 'Tu pedido está listo' corresponde a ready_for_delivery (no delivered)

CREATE OR REPLACE FUNCTION public.trg_notify_order_ready_for_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_code text;
BEGIN
  IF NEW.status != 'ready_for_delivery' OR OLD.status = 'ready_for_delivery' THEN
    RETURN NEW;
  END IF;

  v_order_code := NEW.order_code;

  INSERT INTO user_notifications (
    recipient_organization_id, type, title, body, link_url, reference_type, reference_id
  ) VALUES (
    NEW.organization_id,
    'order_ready_for_delivery',
    'Tu pedido está listo',
    'El pedido ' || v_order_code || ' está listo. Coordinando entrega.',
    '/mi-portal/pedidos/' || NEW.id::text,
    'order',
    NEW.id
  );

  INSERT INTO user_notifications (
    recipient_user_id, recipient_organization_id, type, title, body, link_url, reference_type, reference_id
  ) VALUES (
    NULL, NULL,
    'order_ready_admin',
    'Pedido listo para despachar',
    'El pedido ' || v_order_code || ' completó producción y espera despacho.',
    '/pedidos/' || NEW.id::text,
    'order',
    NEW.id
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_notify_order_delivered()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_code text;
BEGIN
  IF NEW.status != 'delivered' OR OLD.status = 'delivered' THEN
    RETURN NEW;
  END IF;

  v_order_code := NEW.order_code;

  INSERT INTO user_notifications (
    recipient_organization_id, type, title, body, link_url, reference_type, reference_id
  ) VALUES (
    NEW.organization_id,
    'order_delivered',
    'Pedido entregado',
    'Tu pedido ' || v_order_code || ' fue entregado. ¡Gracias!',
    '/mi-portal/pedidos/' || NEW.id::text,
    'order',
    NEW.id
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_order_ready_for_delivery_notify ON orders;
CREATE TRIGGER trg_order_ready_for_delivery_notify
AFTER UPDATE OF status ON orders
FOR EACH ROW
EXECUTE FUNCTION trg_notify_order_ready_for_delivery();
