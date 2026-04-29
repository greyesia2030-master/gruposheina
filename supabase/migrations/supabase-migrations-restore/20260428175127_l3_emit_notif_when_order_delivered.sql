-- Restored from supabase_migrations.schema_migrations via MCP
-- Filename: 20260428175127_l3_emit_notif_when_order_delivered
-- Source of truth: live BD (project zenlpuiaavdgeyplfcma)

-- Trigger: cuando order pasa a 'delivered', notificar al cliente

CREATE OR REPLACE FUNCTION public.trg_notify_order_delivered()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    'Tu pedido está listo',
    'El pedido ' || v_order_code || ' ya está listo para entrega.',
    '/mi-portal/pedidos/' || NEW.id::text,
    'order',
    NEW.id
  );

  INSERT INTO user_notifications (
    recipient_user_id, recipient_organization_id, type, title, body, link_url, reference_type, reference_id
  ) VALUES (
    NULL, NULL,
    'order_delivered_admin',
    'Pedido completado en producción',
    'El pedido ' || v_order_code || ' completó producción y está listo para entrega.',
    '/pedidos/' || NEW.id::text,
    'order',
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_delivered_notify ON orders;

CREATE TRIGGER trg_order_delivered_notify
AFTER UPDATE OF status ON orders
FOR EACH ROW
EXECUTE FUNCTION trg_notify_order_delivered();
