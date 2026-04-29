-- Restored from supabase_migrations.schema_migrations via MCP
-- Filename: 20260426145308_c13_push_subscriptions
-- Source of truth: live BD (project zenlpuiaavdgeyplfcma)

-- C.1.3: tabla push_subscriptions para PWA del comensal

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  participant_id uuid REFERENCES public.order_participants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  CONSTRAINT push_subs_owner_required CHECK (participant_id IS NOT NULL OR user_id IS NOT NULL)
);

CREATE INDEX idx_push_subs_participant ON public.push_subscriptions(participant_id) WHERE participant_id IS NOT NULL;
CREATE INDEX idx_push_subs_user ON public.push_subscriptions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_push_subs_endpoint ON public.push_subscriptions(endpoint);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin: acceso total a push_subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

COMMENT ON TABLE public.push_subscriptions IS 'Web Push subscriptions (RFC 8030). v1 sólo participant_id. Service role bypasses RLS para inserts desde server actions.';
