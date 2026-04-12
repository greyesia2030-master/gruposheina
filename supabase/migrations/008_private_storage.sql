-- FIX 8: Make order-files bucket private and restrict access to service role.
-- Previously the bucket was public, exposing uploaded Excel orders via guessable URLs.
-- All reads now go through signed URLs generated server-side.

UPDATE storage.buckets
SET public = false
WHERE id = 'order-files';

INSERT INTO storage.buckets (id, name, public)
VALUES ('order-files', 'order-files', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Drop any permissive public policies that may have been created implicitly.
DROP POLICY IF EXISTS "Public read access order-files" ON storage.objects;
DROP POLICY IF EXISTS "Public access" ON storage.objects;

-- Only the service role (webhook + server actions) may read/write this bucket.
-- Clients must request a signed URL through the application.
DROP POLICY IF EXISTS "order_files_service_only_select" ON storage.objects;
CREATE POLICY "order_files_service_only_select" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'order-files' AND auth.role() = 'service_role');

DROP POLICY IF EXISTS "order_files_service_only_insert" ON storage.objects;
CREATE POLICY "order_files_service_only_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'order-files' AND auth.role() = 'service_role');

DROP POLICY IF EXISTS "order_files_service_only_update" ON storage.objects;
CREATE POLICY "order_files_service_only_update" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'order-files' AND auth.role() = 'service_role');
