-- Restored from supabase_migrations.schema_migrations via MCP
-- Filename: 20260428175114_l2_create_notifications_table
-- Source of truth: live BD (project zenlpuiaavdgeyplfcma)

-- Tabla user_notifications + RLS

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  recipient_organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  type varchar(50) NOT NULL,
  title text NOT NULL,
  body text,
  link_url text,
  reference_type varchar(50),
  reference_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_recipient_user
  ON user_notifications(recipient_user_id, is_read, created_at DESC)
  WHERE recipient_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_notifications_recipient_org
  ON user_notifications(recipient_organization_id, is_read, created_at DESC)
  WHERE recipient_organization_id IS NOT NULL;

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario lee sus propias notificaciones"
ON public.user_notifications
FOR SELECT
USING (
  recipient_user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  OR recipient_organization_id = (SELECT organization_id FROM users WHERE auth_id = auth.uid())
  OR (
    recipient_user_id IS NULL AND recipient_organization_id IS NULL
    AND EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('superadmin','admin'))
  )
);

CREATE POLICY "Usuario actualiza sus propias notificaciones"
ON public.user_notifications
FOR UPDATE
USING (
  recipient_user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  OR recipient_organization_id = (SELECT organization_id FROM users WHERE auth_id = auth.uid())
);

CREATE POLICY "Admin Sheina ve todas las notificaciones"
ON public.user_notifications
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('superadmin','admin'))
);
