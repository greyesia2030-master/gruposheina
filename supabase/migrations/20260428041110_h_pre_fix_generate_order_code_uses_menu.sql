-- Restored from supabase_migrations.schema_migrations via MCP
-- Filename: 20260428041110_h_pre_fix_generate_order_code_uses_menu
-- Source of truth: live BD (project zenlpuiaavdgeyplfcma)

-- FIX: order_code se generaba con S00 cuando week_label no tenía dígitos
-- Solución: derivar week_number de weekly_menus.week_number

CREATE OR REPLACE FUNCTION public.generate_order_code(
  p_organization_id uuid,
  p_week_label text,
  p_created_at timestamp with time zone,
  p_menu_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
  v_member_id text;
  v_org_tz text;
  v_year text;
  v_week_num_int int;
  v_week_num_str text;
  v_label_digits text;
  v_seq int;
BEGIN
  SELECT member_id, timezone INTO v_member_id, v_org_tz
  FROM public.organizations WHERE id = p_organization_id;

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'organization % no tiene member_id', p_organization_id;
  END IF;

  v_year := to_char(p_created_at AT TIME ZONE v_org_tz, 'YYYY');
  v_week_num_int := NULL;

  IF p_menu_id IS NOT NULL THEN
    SELECT week_number INTO v_week_num_int
    FROM public.weekly_menus
    WHERE id = p_menu_id;
  END IF;

  IF v_week_num_int IS NULL THEN
    v_label_digits := regexp_replace(COALESCE(p_week_label, ''), '[^0-9]', '', 'g');
    IF v_label_digits <> '' THEN
      v_week_num_int := v_label_digits::int;
      IF v_week_num_int < 1 OR v_week_num_int > 53 THEN
        v_week_num_int := NULL;
      END IF;
    END IF;
  END IF;

  IF v_week_num_int IS NULL THEN
    v_week_num_int := to_char(p_created_at AT TIME ZONE v_org_tz, 'IW')::int;
  END IF;

  v_week_num_str := 'S' || lpad(v_week_num_int::text, 2, '0');

  SELECT COALESCE(MAX(CAST(split_part(order_code, '-', 4) AS int)), 0) + 1
  INTO v_seq
  FROM public.orders
  WHERE organization_id = p_organization_id
    AND order_code LIKE v_member_id || '-' || v_year || v_week_num_str || '-%';

  RETURN v_member_id || '-' || v_year || v_week_num_str || '-' || lpad(v_seq::text, 2, '0');
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_assign_order_code()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.order_code IS NULL THEN
    NEW.order_code := public.generate_order_code(
      NEW.organization_id, NEW.week_label, NEW.created_at, NEW.menu_id
    );
  END IF;
  RETURN NEW;
END;
$function$;
