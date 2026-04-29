-- CD-1.B Preflight: normalizar unit 'lt'→'l' y activar requires_lot_tracking
-- en items que ya tienen lotes registrados en inventory_lots.
-- Seguro para re-run (DO block valida antes de modificar).

-- 1. Normalizar unidad 'lt' → 'l' (litros) para consistencia de unidades.
UPDATE inventory_items
SET unit = 'l'
WHERE unit = 'lt';

-- 2. Activar requires_lot_tracking en items que ya tienen filas en inventory_lots.
UPDATE inventory_items ii
SET requires_lot_tracking = true
WHERE requires_lot_tracking = false
  AND EXISTS (
    SELECT 1 FROM inventory_lots il WHERE il.item_id = ii.id
  );

-- 3. Validación inline: confirmar que no quedan registros con unit='lt'.
DO $$
DECLARE
  remaining_lt INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_lt
  FROM inventory_items
  WHERE unit = 'lt';

  IF remaining_lt > 0 THEN
    RAISE EXCEPTION 'Preflight CD-1.B: quedan % item(s) con unit=''lt'' sin normalizar', remaining_lt;
  END IF;
END;
$$;
