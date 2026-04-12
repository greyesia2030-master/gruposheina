-- Migration 013: conversation_logs, order_tokens, authorized_phones
-- Applied: 2026-04-12

-- 1. Tabla conversation_logs — historial de mensajes WhatsApp
CREATE TABLE IF NOT EXISTS conversation_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           text NOT NULL,
  direction       text NOT NULL CHECK (direction IN ('in', 'out')),
  message_type    text,          -- EXCEL_FILE, CONFIRM, CANCEL, HELP, STATUS, etc.
  body            text,
  media_url       text,
  order_id        uuid REFERENCES orders(id) ON DELETE SET NULL,
  conv_state      text,          -- estado de conversación después de este mensaje
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conv_logs_phone ON conversation_logs(phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_logs_order ON conversation_logs(order_id);

-- 2. Columna authorized_phones en organizations (teléfonos autorizados para enviar pedidos)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS authorized_phones text[] NOT NULL DEFAULT '{}';

-- 3. Tabla order_tokens — links de acceso a pedidos sin login
CREATE TABLE IF NOT EXISTS order_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  token       uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_tokens_token ON order_tokens(token);

-- 4. Unicidad de phone en users (si no existe)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_phone_unique' AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_phone_unique UNIQUE (phone);
  END IF;
END $$;

-- 5. RLS — conversation_logs (solo service_role puede leer/escribir desde la app)
ALTER TABLE conversation_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'conversation_logs' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY "service_role_all" ON conversation_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Permitir que admins autenticados lean el historial de su organización
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'conversation_logs' AND policyname = 'admin_read'
  ) THEN
    CREATE POLICY "admin_read" ON conversation_logs
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users u
          WHERE u.auth_id = auth.uid()
            AND u.role IN ('superadmin', 'admin', 'operator')
            AND u.is_active = true
        )
      );
  END IF;
END $$;

-- 6. RLS — order_tokens
ALTER TABLE order_tokens ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'order_tokens' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY "service_role_all" ON order_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
