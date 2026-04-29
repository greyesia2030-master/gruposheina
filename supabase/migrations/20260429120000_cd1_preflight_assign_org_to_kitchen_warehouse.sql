-- INICIO ARCHIVO ----------------------------------------------------
-- Migration: CD-1 preflight — RLS fix
-- Setea organization_id = "Grupo Sheina" a los usuarios kitchen y warehouse
-- que aterrizan en /operador (KDS, almacén) y necesitan org_id para que las
-- RLS policies les den acceso a sites/suppliers/inventory_lots de Sheina.
--
-- NO toca admin@sheina.com (superadmin con organization_id NULL intencional,
-- ver Status_Handoff v8 §1.4).
--
-- Targets verificados vía Supabase MCP el 29/04/2026:
--   cocina@sheina.com     → id dbd8e4d9-cdac-401a-9381-daa4cdc98bda  (role=kitchen,   org=NULL)
--   inventario@sheina.com → id 6a7e035d-2cb3-4c87-aad7-bca71ee965ed  (role=warehouse, org=NULL)
-- Org Sheina: 5a130ecc-6016-467e-bcb8-42f0b4b70d22 ("Grupo Sheina")

UPDATE public.users
SET organization_id = '5a130ecc-6016-467e-bcb8-42f0b4b70d22'
WHERE email IN ('cocina@sheina.com', 'inventario@sheina.com')
  AND role IN ('kitchen', 'warehouse')
  AND organization_id IS DISTINCT FROM '5a130ecc-6016-467e-bcb8-42f0b4b70d22';

DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.users
  WHERE email IN ('cocina@sheina.com', 'inventario@sheina.com')
    AND role IN ('kitchen', 'warehouse')
    AND organization_id = '5a130ecc-6016-467e-bcb8-42f0b4b70d22';

  IF v_count <> 2 THEN
    RAISE EXCEPTION
      'CD-1 preflight aborted: expected exactly 2 users (kitchen+warehouse) with org=Sheina, found %',
      v_count;
  END IF;
END $$;
-- FIN ARCHIVO -------------------------------------------------------
