-- FoodSync v2 — Migration 012 (local: 022)
-- Columnas nuevas en tablas existentes

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS prefers_web_form BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS primary_contact_email VARCHAR(150),
  ADD COLUMN IF NOT EXISTS secondary_emails TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
    "pedidos_por_whatsapp": true,
    "pedidos_por_email": true,
    "facturacion_por_email": true,
    "soporte_por_whatsapp": true,
    "recordatorios_por_whatsapp": true
  }';

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS requires_lot_tracking BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_site_id UUID REFERENCES sites(id),
  ADD COLUMN IF NOT EXISTS default_unit VARCHAR(10) DEFAULT 'g'
    CHECK (default_unit IN ('g','kg','ml','l','un')),
  ADD COLUMN IF NOT EXISTS min_stock_alert DECIMAL(12,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS lot_id UUID REFERENCES inventory_lots(id),
  ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES sites(id),
  ADD COLUMN IF NOT EXISTS unit VARCHAR(10);

CREATE INDEX IF NOT EXISTS idx_movements_lot ON inventory_movements(lot_id);
CREATE INDEX IF NOT EXISTS idx_movements_site ON inventory_movements(site_id);

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS calories_kcal INTEGER,
  ADD COLUMN IF NOT EXISTS weight_grams INTEGER,
  ADD COLUMN IF NOT EXISTS allergens JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS is_published_to_form BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS creation_mode VARCHAR(30) DEFAULT 'whatsapp_excel',
  ADD COLUMN IF NOT EXISTS form_token_id UUID REFERENCES order_form_tokens(id);

CREATE INDEX IF NOT EXISTS idx_orders_creation_mode ON orders(creation_mode);
CREATE INDEX IF NOT EXISTS idx_orders_form_token ON orders(form_token_id);

ALTER TABLE public.order_lines
  ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES order_sections(id),
  ADD COLUMN IF NOT EXISTS participant_id UUID REFERENCES order_participants(id);

CREATE INDEX IF NOT EXISTS idx_order_lines_section ON order_lines(section_id);
CREATE INDEX IF NOT EXISTS idx_order_lines_participant ON order_lines(participant_id);
