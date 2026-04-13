-- Migration 014: price_per_unit en organizations, delivered_at en orders
-- Applied: 2026-04-12

-- 1. Precio por vianda en cada organización
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS price_per_unit numeric(10, 2) NOT NULL DEFAULT 0.00;

-- Setear un valor inicial razonable si ya hay registros con 0
-- (el admin puede corregir desde la UI)
UPDATE organizations
  SET price_per_unit = 850.00
  WHERE price_per_unit = 0;

-- 2. Fecha de entrega en pedidos
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
