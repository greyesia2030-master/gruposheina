-- FoodSync v2 — Migration 010 (local: 020)
-- order_form_tokens, order_sections, order_participants
-- FIX: menus → weekly_menus

CREATE TABLE IF NOT EXISTS public.order_form_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  menu_id UUID REFERENCES weekly_menus(id),
  token UUID NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ NOT NULL,
  max_uses INTEGER DEFAULT 50,
  used_count INTEGER DEFAULT 0,
  created_by UUID NOT NULL REFERENCES users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_form_tokens_token ON order_form_tokens(token);
CREATE INDEX IF NOT EXISTS idx_form_tokens_org ON order_form_tokens(organization_id);
CREATE INDEX IF NOT EXISTS idx_form_tokens_valid ON order_form_tokens(is_active, valid_until);

CREATE TABLE IF NOT EXISTS public.order_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  display_order INTEGER DEFAULT 0,
  closed_at TIMESTAMPTZ,
  closed_by_participant_id UUID,
  total_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id, name)
);
CREATE INDEX IF NOT EXISTS idx_sections_order ON order_sections(order_id);

CREATE TABLE IF NOT EXISTS public.order_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  section_id UUID REFERENCES order_sections(id),
  display_name VARCHAR(100) NOT NULL,
  access_token UUID NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
  form_token_id UUID REFERENCES order_form_tokens(id),
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  total_quantity INTEGER DEFAULT 0,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_participants_order ON order_participants(order_id);
CREATE INDEX IF NOT EXISTS idx_participants_section ON order_participants(section_id);
CREATE INDEX IF NOT EXISTS idx_participants_token ON order_participants(access_token);

ALTER TABLE public.order_sections
  DROP CONSTRAINT IF EXISTS fk_section_closed_by;
ALTER TABLE public.order_sections
  ADD CONSTRAINT fk_section_closed_by
  FOREIGN KEY (closed_by_participant_id) REFERENCES order_participants(id);
