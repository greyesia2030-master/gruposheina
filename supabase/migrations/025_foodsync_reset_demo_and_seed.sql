-- FoodSync v2 — Migration 015 (local: 025)
-- Reset demo: borra datos transaccionales, preserva catálogo
-- Seed: asigna business_unit a orgs demo, genera member_id, siembra sitios Sheina

BEGIN;

DELETE FROM production_lot_consumption;
DELETE FROM production_tickets;
DELETE FROM communications;
DELETE FROM communication_threads;
DELETE FROM conversation_logs;
DELETE FROM order_participants;
DELETE FROM order_sections;
DELETE FROM order_form_tokens;
DELETE FROM order_events;
DELETE FROM order_lines;
DELETE FROM orders;
DELETE FROM inventory_movements;
DELETE FROM inventory_lots;

UPDATE public.organizations
SET business_unit_id = (SELECT id FROM business_units WHERE code = 'VIA'),
    prefers_web_form = true
WHERE name IN ('Cliente PYME Demo', 'Pilo Enterprise', 'IBM-TEST');

UPDATE public.organizations
SET member_id = fn_generate_member_id(business_unit_id)
WHERE member_id IS NULL AND business_unit_id IS NOT NULL;

COMMIT;

DO $$
DECLARE
  v_sheina_id UUID;
BEGIN
  SELECT id INTO v_sheina_id
  FROM organizations
  WHERE name ILIKE '%sheina%' OR name = 'Grupo Sheina'
  LIMIT 1;

  IF v_sheina_id IS NULL THEN
    RAISE NOTICE 'No se encontró organización Sheina. Creala manualmente antes de continuar.';
  ELSE
    INSERT INTO sites (organization_id, name, site_type, is_active)
    VALUES
      (v_sheina_id, 'Almacén Central', 'warehouse', true),
      (v_sheina_id, 'Cocina Principal', 'kitchen', true)
    ON CONFLICT (organization_id, name) DO NOTHING;

    INSERT INTO suppliers (organization_id, name, is_active)
    VALUES (v_sheina_id, 'Proveedor Genérico (placeholder)', true)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
