-- Restored from supabase_migrations.schema_migrations via MCP
-- Filename: 20260425193110_f1_fix_form_tokens_orders_fk
-- Source of truth: live BD (project zenlpuiaavdgeyplfcma)

-- F.1: FK explícita order_form_tokens.order_id → orders.id

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'order_form_tokens_order_id_fkey'
      AND table_name = 'order_form_tokens'
  ) THEN
    ALTER TABLE order_form_tokens
      ADD CONSTRAINT order_form_tokens_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
