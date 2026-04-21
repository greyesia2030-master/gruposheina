-- FoodSync v2 — Migration 011 (local: 021)
-- communication_templates, communication_threads, communications, trigger

CREATE TABLE IF NOT EXISTS public.communication_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  channel communication_channel NOT NULL,
  category communication_category NOT NULL,
  subject VARCHAR(200),
  body TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  business_unit_id UUID REFERENCES business_units(id),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, channel)
);
CREATE INDEX IF NOT EXISTS idx_templates_channel_cat ON communication_templates(channel, category);
CREATE INDEX IF NOT EXISTS idx_templates_business_unit ON communication_templates(business_unit_id);

CREATE TABLE IF NOT EXISTS public.communication_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id),
  subject VARCHAR(200),
  category communication_category DEFAULT 'otro',
  order_id UUID REFERENCES orders(id),
  status thread_status DEFAULT 'open',
  assigned_to UUID REFERENCES users(id),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_threads_org ON communication_threads(organization_id);
CREATE INDEX IF NOT EXISTS idx_threads_status ON communication_threads(status);
CREATE INDEX IF NOT EXISTS idx_threads_assigned ON communication_threads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_threads_last_msg ON communication_threads(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_order ON communication_threads(order_id);

CREATE TABLE IF NOT EXISTS public.communications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id),
  thread_id UUID REFERENCES communication_threads(id),
  order_id UUID REFERENCES orders(id),
  template_id UUID REFERENCES communication_templates(id),
  channel communication_channel NOT NULL,
  direction communication_direction NOT NULL,
  category communication_category DEFAULT 'otro',
  external_message_id VARCHAR(200),
  external_thread_id VARCHAR(200),
  subject VARCHAR(200),
  body TEXT NOT NULL,
  body_html TEXT,
  sender_identifier VARCHAR(200),
  recipient_identifier VARCHAR(200),
  sent_by_user_id UUID REFERENCES users(id),
  status communication_status DEFAULT 'pending',
  status_detail TEXT,
  attachments JSONB DEFAULT '[]',
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  ai_generated BOOLEAN DEFAULT false,
  ai_confidence DECIMAL(3,2),
  ai_review_status VARCHAR(30),
  ai_model_used VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comms_org ON communications(organization_id);
CREATE INDEX IF NOT EXISTS idx_comms_thread ON communications(thread_id);
CREATE INDEX IF NOT EXISTS idx_comms_channel_dir ON communications(channel, direction);
CREATE INDEX IF NOT EXISTS idx_comms_recipient ON communications(recipient_identifier);
CREATE INDEX IF NOT EXISTS idx_comms_sender ON communications(sender_identifier);
CREATE INDEX IF NOT EXISTS idx_comms_order ON communications(order_id);
CREATE INDEX IF NOT EXISTS idx_comms_created ON communications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comms_pending ON communications(status) WHERE status IN ('pending', 'sending');
CREATE INDEX IF NOT EXISTS idx_comms_external ON communications(external_message_id);

CREATE OR REPLACE FUNCTION public.fn_update_thread_on_message()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.thread_id IS NOT NULL THEN
    UPDATE communication_threads
    SET last_message_at = NEW.created_at,
        unread_count = CASE
          WHEN NEW.direction = 'inbound' THEN unread_count + 1
          ELSE unread_count
        END,
        updated_at = NOW()
    WHERE id = NEW.thread_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_comms_update_thread ON communications;
CREATE TRIGGER trg_comms_update_thread
AFTER INSERT ON communications
FOR EACH ROW EXECUTE FUNCTION public.fn_update_thread_on_message();
