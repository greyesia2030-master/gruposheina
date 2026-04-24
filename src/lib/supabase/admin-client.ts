// WARN: service_role credential — never import this from client components or expose to browser
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("[AdminClient] NEXT_PUBLIC_SUPABASE_URL no está configurada");
  }
  if (!key) {
    throw new Error(
      "[AdminClient] SUPABASE_SERVICE_ROLE_KEY no está configurada. Agregarla en Vercel → Settings → Environment Variables"
    );
  }

  return createClient(url, key, { auth: { persistSession: false } });
}
