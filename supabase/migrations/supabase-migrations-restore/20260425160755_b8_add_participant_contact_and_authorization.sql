-- Restored from supabase_migrations.schema_migrations via MCP
-- Filename: 20260425160755_b8_add_participant_contact_and_authorization
-- Source of truth: live BD (project zenlpuiaavdgeyplfcma)

-- B.8: Agregar campos de contacto + autorización a order_participants
-- Patrón: contacto opcional (email o teléfono) para auditoría, validado contra org

ALTER TABLE order_participants
  ADD COLUMN IF NOT EXISTS member_contact VARCHAR(200),
  ADD COLUMN IF NOT EXISTS contact_type VARCHAR(20) CHECK (contact_type IN ('email', 'phone', 'none')) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS is_authorized BOOLEAN DEFAULT NULL;

COMMENT ON COLUMN order_participants.member_contact IS 'Contacto opcional (email o teléfono) para auditoría';
COMMENT ON COLUMN order_participants.contact_type IS 'Tipo de contacto: email, phone o none';
COMMENT ON COLUMN order_participants.is_authorized IS 'NULL=sin contacto, TRUE=matchea whitelist org, FALSE=no matchea';

CREATE INDEX IF NOT EXISTS idx_order_participants_authorization 
  ON order_participants(order_id, is_authorized);
