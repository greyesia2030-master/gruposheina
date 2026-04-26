-- Migration 027: Web Push Subscriptions
-- Adds push_subscription column to order_participants for server-sent push notifications

ALTER TABLE public.order_participants
  ADD COLUMN IF NOT EXISTS push_subscription JSONB DEFAULT NULL;

COMMENT ON COLUMN public.order_participants.push_subscription IS
  'Browser PushSubscription JSON (endpoint, keys.p256dh, keys.auth). Stored per participant.';
