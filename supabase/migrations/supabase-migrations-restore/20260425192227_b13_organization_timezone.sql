-- Restored from supabase_migrations.schema_migrations via MCP
-- Filename: 20260425192227_b13_organization_timezone
-- Source of truth: live BD (project zenlpuiaavdgeyplfcma)

-- B.13: Timezone configurable por organización

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) NOT NULL DEFAULT 'America/Argentina/Buenos_Aires';

COMMENT ON COLUMN organizations.timezone IS 'Zona horaria del cliente para display y cálculo de cutoffs (IANA tz database)';

CREATE OR REPLACE FUNCTION fn_org_now(p_org_id UUID)
RETURNS TIMESTAMPTZ AS $$
DECLARE v_tz VARCHAR(50);
BEGIN
  SELECT timezone INTO v_tz FROM organizations WHERE id = p_org_id;
  IF v_tz IS NULL THEN v_tz := 'America/Argentina/Buenos_Aires'; END IF;
  RETURN NOW() AT TIME ZONE v_tz;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION fn_is_past_cutoff(p_org_id UUID, p_target_date DATE)
RETURNS BOOLEAN AS $$
DECLARE
  v_org RECORD;
  v_cutoff_datetime TIMESTAMPTZ;
BEGIN
  SELECT timezone, cutoff_time, cutoff_days_before INTO v_org FROM organizations WHERE id = p_org_id;
  IF NOT FOUND THEN RETURN false; END IF;
  v_cutoff_datetime := (
    (p_target_date - COALESCE(v_org.cutoff_days_before, 1)) || ' ' || 
    COALESCE(v_org.cutoff_time, '18:00:00')::text
  )::timestamp AT TIME ZONE v_org.timezone;
  RETURN NOW() > v_cutoff_datetime;
END;
$$ LANGUAGE plpgsql STABLE;

UPDATE organizations 
SET timezone = 'America/Argentina/Buenos_Aires' 
WHERE timezone IS NULL OR timezone = '';
