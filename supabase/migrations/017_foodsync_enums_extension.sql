-- FoodSync v2 — Migration 007 (local: 017)
-- Extiende enums existentes y crea nuevos tipos

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'kitchen';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'warehouse';

ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'transfer_out';
ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'transfer_in';
ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'cook_consumption';
ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'waste_pending';
ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'waste_approved';

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'partially_filled';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'awaiting_confirmation';

ALTER TYPE order_source ADD VALUE IF NOT EXISTS 'web_form_shared';

DO $$ BEGIN
  CREATE TYPE site_type AS ENUM (
    'warehouse', 'kitchen', 'delivery_point', 'distribution_hub'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE production_ticket_status AS ENUM (
    'pending', 'in_progress', 'paused', 'ready', 'blocked', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE communication_channel AS ENUM (
    'whatsapp', 'email', 'sms', 'web_note', 'phone_call_note'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE communication_direction AS ENUM ('inbound', 'outbound');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE communication_status AS ENUM (
    'pending', 'sending', 'sent', 'delivered', 'read', 'failed',
    'ai_suggested', 'ai_sent', 'human_approved'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE communication_category AS ENUM (
    'pedido_confirmacion', 'pedido_modificacion', 'facturacion',
    'soporte', 'recordatorio_pago', 'entrega_notificacion', 'otro'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE thread_status AS ENUM (
    'open', 'waiting_client', 'waiting_admin', 'resolved', 'archived'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;
