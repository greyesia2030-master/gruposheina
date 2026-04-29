-- Restored from supabase_migrations.schema_migrations via MCP
-- Filename: 20260425160852_b8_add_require_contact_to_form_tokens
-- Source of truth: live BD (project zenlpuiaavdgeyplfcma)

-- B.8.1: Flag para exigir contacto en formulario público
ALTER TABLE order_form_tokens 
  ADD COLUMN IF NOT EXISTS require_contact BOOLEAN DEFAULT true;

COMMENT ON COLUMN order_form_tokens.require_contact IS 'Si TRUE, el participante debe ingresar email o teléfono al unirse';
