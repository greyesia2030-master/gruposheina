import "server-only";
import { createAdminClient } from "@/lib/supabase/admin-client";

/**
 * Devuelve el link activo del formulario web para una org, o null si no hay
 * token válido o alcanzó el límite de usos.
 */
export async function getActiveFormLink(organizationId: string): Promise<string | null> {
  const supabase = createAdminClient();

  const { data: token } = await supabase
    .from("order_form_tokens")
    .select("token, valid_until, used_count, max_uses")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .gt("valid_until", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!token) return null;

  const usedCount = (token.used_count as number) ?? 0;
  const maxUses = (token.max_uses as number) ?? 0;
  if (maxUses > 0 && usedCount >= maxUses) return null;

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://gruposheina.vercel.app";
  return `${baseUrl}/pedido/${token.token as string}`;
}

/**
 * Construye el mensaje de WhatsApp para orgs que usan el formulario web.
 */
export function buildWebFormResponse(
  orgName: string,
  formLink: string | null
): string {
  if (!formLink) {
    return (
      `Hola 👋 Tu empresa usa el sistema de pedidos web de FoodSync.\n\n` +
      `No hay un pedido activo en este momento. El equipo de Sheina te enviará el link cuando esté disponible.`
    );
  }

  return (
    `Hola 👋 Tu empresa *${orgName}* usa el sistema de pedidos web.\n\n` +
    `📋 *Cargá tu pedido aquí:*\n${formLink}\n\n` +
    `Si tenés alguna consulta, respondé este mensaje.`
  );
}
