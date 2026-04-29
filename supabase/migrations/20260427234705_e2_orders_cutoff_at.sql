-- Restored from supabase_migrations.schema_migrations via MCP
-- Filename: 20260427234705_e2_orders_cutoff_at
-- Source of truth: live BD (project zenlpuiaavdgeyplfcma)

-- E.2: cutoff por pedido específico (override del default de la org)

ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS cutoff_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_orders_cutoff_at 
  ON public.orders(cutoff_at) 
  WHERE cutoff_at IS NOT NULL;

COMMENT ON COLUMN public.orders.cutoff_at IS 
  'Cutoff específico del pedido. NULL = usar default org. Si seteado, este valor manda. Editable por admin Sheina.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('menu-photos', 'menu-photos', true, 5242880, ARRAY['image/jpeg','image/png','image/webp']) 
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read menu photos" ON storage.objects;
CREATE POLICY "Public read menu photos" 
  ON storage.objects FOR SELECT 
  USING (bucket_id = 'menu-photos');

DROP POLICY IF EXISTS "Admin upload menu photos" ON storage.objects;
CREATE POLICY "Admin upload menu photos" 
  ON storage.objects FOR INSERT 
  WITH CHECK (
    bucket_id = 'menu-photos' AND 
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role IN ('superadmin','admin'))
  );

DROP POLICY IF EXISTS "Admin delete menu photos" ON storage.objects;
CREATE POLICY "Admin delete menu photos" 
  ON storage.objects FOR DELETE 
  USING (
    bucket_id = 'menu-photos' AND 
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role IN ('superadmin','admin'))
  );

DROP POLICY IF EXISTS "Admin update menu photos" ON storage.objects;
CREATE POLICY "Admin update menu photos" 
  ON storage.objects FOR UPDATE 
  USING (
    bucket_id = 'menu-photos' AND 
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role IN ('superadmin','admin'))
  );
