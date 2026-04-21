-- FoodSync v2 — Migration 009 (local: 019)
-- Sites, suppliers, inventory_lots, production_tickets, production_lot_consumption

CREATE TABLE IF NOT EXISTS public.sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(100) NOT NULL,
  site_type site_type NOT NULL DEFAULT 'warehouse',
  address TEXT,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  contact_phone VARCHAR(30),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, name)
);
CREATE INDEX IF NOT EXISTS idx_sites_org ON sites(organization_id);
CREATE INDEX IF NOT EXISTS idx_sites_type ON sites(site_type);

CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(150) NOT NULL,
  cuit VARCHAR(20),
  contact_name VARCHAR(100),
  contact_phone VARCHAR(30),
  contact_email VARCHAR(100),
  payment_terms VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_org ON suppliers(organization_id);

CREATE TABLE IF NOT EXISTS public.inventory_lots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES inventory_items(id),
  site_id UUID NOT NULL REFERENCES sites(id),
  supplier_id UUID REFERENCES suppliers(id),
  lot_code VARCHAR(100) NOT NULL,
  quantity_initial DECIMAL(12,3) NOT NULL CHECK (quantity_initial > 0),
  quantity_remaining DECIMAL(12,3) NOT NULL CHECK (quantity_remaining >= 0),
  unit VARCHAR(10) NOT NULL CHECK (unit IN ('g','kg','ml','l','un')),
  cost_per_unit DECIMAL(10,4),
  received_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at DATE,
  received_by UUID REFERENCES users(id),
  received_photo_url TEXT,
  notes TEXT,
  is_depleted BOOLEAN GENERATED ALWAYS AS (quantity_remaining = 0) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(item_id, lot_code, received_at)
);
CREATE INDEX IF NOT EXISTS idx_lots_item_site ON inventory_lots(item_id, site_id);
CREATE INDEX IF NOT EXISTS idx_lots_expires ON inventory_lots(expires_at) WHERE NOT is_depleted;
CREATE INDEX IF NOT EXISTS idx_lots_supplier ON inventory_lots(supplier_id);

CREATE TABLE IF NOT EXISTS public.production_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id),
  recipe_version_id UUID REFERENCES recipe_versions(id),
  cook_site_id UUID REFERENCES sites(id),
  production_date DATE NOT NULL,
  quantity_target INTEGER NOT NULL CHECK (quantity_target > 0),
  quantity_produced INTEGER DEFAULT 0,
  quantity_wasted INTEGER DEFAULT 0,
  status production_ticket_status DEFAULT 'pending',
  blocked_reason TEXT,
  assigned_cook_id UUID REFERENCES users(id),
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  started_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tickets_order ON production_tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON production_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_date ON production_tickets(production_date);
CREATE INDEX IF NOT EXISTS idx_tickets_cook ON production_tickets(assigned_cook_id);

CREATE TABLE IF NOT EXISTS public.production_lot_consumption (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES production_tickets(id),
  lot_id UUID NOT NULL REFERENCES inventory_lots(id),
  quantity_consumed DECIMAL(12,3) NOT NULL,
  unit VARCHAR(10) NOT NULL,
  consumed_at TIMESTAMPTZ DEFAULT NOW(),
  recorded_by UUID REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_plc_ticket ON production_lot_consumption(ticket_id);
CREATE INDEX IF NOT EXISTS idx_plc_lot ON production_lot_consumption(lot_id);
