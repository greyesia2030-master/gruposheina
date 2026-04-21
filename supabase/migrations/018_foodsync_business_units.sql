-- FoodSync v2 — Migration 008 (local: 018)
-- Business units, member_id, trigger auto-generación

CREATE TABLE IF NOT EXISTS public.business_units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(80) NOT NULL,
  description TEXT,
  next_correlative INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.business_units (code, name, description) VALUES
  ('VIA', 'Viandas', 'Servicio tradicional de viandas corporativas'),
  ('COM', 'Comedor', 'Servicio de comedor institucional'),
  ('CON', 'Congelados', 'Línea de productos congelados'),
  ('EVE', 'Eventos', 'Catering para eventos puntuales')
ON CONFLICT (code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.fn_generate_member_id(p_business_unit_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  v_code VARCHAR;
  v_next INTEGER;
BEGIN
  IF p_business_unit_id IS NULL THEN RETURN NULL; END IF;

  UPDATE public.business_units
  SET next_correlative = next_correlative + 1, updated_at = NOW()
  WHERE id = p_business_unit_id AND is_active = true
  RETURNING code, next_correlative - 1 INTO v_code, v_next;

  IF v_code IS NULL THEN
    RAISE EXCEPTION 'Business unit inactiva o inexistente: %', p_business_unit_id;
  END IF;

  RETURN v_code || '-' || LPAD(v_next::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS business_unit_id UUID REFERENCES business_units(id),
  ADD COLUMN IF NOT EXISTS member_id VARCHAR(20) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_orgs_business_unit ON organizations(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_orgs_member_id ON organizations(member_id);

CREATE OR REPLACE FUNCTION public.fn_autogen_member_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.member_id IS NULL AND NEW.business_unit_id IS NOT NULL THEN
    NEW.member_id := public.fn_generate_member_id(NEW.business_unit_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_organizations_member_id ON organizations;
CREATE TRIGGER trg_organizations_member_id
BEFORE INSERT ON organizations
FOR EACH ROW EXECUTE FUNCTION public.fn_autogen_member_id();
