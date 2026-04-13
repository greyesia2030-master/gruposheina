-- Migration 015: email and delivery_address on organizations
-- Applied: 2026-04-12

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS delivery_address text;
