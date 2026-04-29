-- Restored from supabase_migrations.schema_migrations via MCP
-- Filename: 20260426005139_b14_order_code
-- Source of truth: live BD (project zenlpuiaavdgeyplfcma)

-- B.14: order_code humano en orders
-- Formato: <member_id>-<YYYY><Snn>-<seq>  ej: VIA-00002-2026S16-01

ALTER TABLE public.orders ADD COLUMN order_code varchar(40);

CREATE OR REPLACE FUNCTION public.generate_order_code(
  p_organization_id uuid,
  p_week_label text,
  p_created_at timestamptz
) RETURNS text AS $$
DECLARE
  v_member_id text;
  v_org_tz text;
  v_year text;
  v_week_num text;
  v_seq int;
BEGIN
  SELECT member_id, timezone INTO v_member_id, v_org_tz
  FROM public.organizations WHERE id = p_organization_id;

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'organization % no tiene member_id', p_organization_id;
  END IF;

  v_year := to_char(p_created_at AT TIME ZONE v_org_tz, 'YYYY');
  v_week_num := 'S' || lpad(regexp_replace(p_week_label, '[^0-9]', '', 'g'), 2, '0');

  SELECT COALESCE(MAX(CAST(split_part(order_code, '-', 4) AS int)), 0) + 1
  INTO v_seq
  FROM public.orders
  WHERE organization_id = p_organization_id
    AND order_code LIKE v_member_id || '-' || v_year || v_week_num || '-%';

  RETURN v_member_id || '-' || v_year || v_week_num || '-' || lpad(v_seq::text, 2, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.trg_assign_order_code() RETURNS trigger AS $$
BEGIN
  IF NEW.order_code IS NULL THEN
    NEW.order_code := public.generate_order_code(NEW.organization_id, NEW.week_label, NEW.created_at);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_assign_code
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_assign_order_code();

UPDATE public.orders 
SET order_code = public.generate_order_code(organization_id, week_label, created_at)
WHERE order_code IS NULL;

ALTER TABLE public.orders ALTER COLUMN order_code SET NOT NULL;
ALTER TABLE public.orders ADD CONSTRAINT orders_order_code_unique UNIQUE (order_code);
CREATE INDEX idx_orders_order_code ON public.orders(order_code);
