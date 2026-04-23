"use server";

import { createAdminClient } from "@/lib/supabase/admin-client";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { OrderFormToken } from "@/lib/types/database";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function createOrderFormToken(opts: {
  organizationId: string;
  menuId: string | null;
  orderId: string | null;
  validUntil: Date;
  maxUses?: number;
  sectionNames?: string[];
}): Promise<ActionResult<OrderFormToken>> {
  const serverClient = await createSupabaseServer();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const supabase = createAdminClient();
  const token = crypto.randomUUID();

  const { data: formToken, error: tokenError } = await supabase
    .from("order_form_tokens")
    .insert({
      organization_id: opts.organizationId,
      menu_id: opts.menuId,
      order_id: opts.orderId,
      token,
      valid_from: new Date().toISOString(),
      valid_until: opts.validUntil.toISOString(),
      max_uses: opts.maxUses ?? 100,
      used_count: 0,
      created_by: user.id,
      is_active: true,
    })
    .select()
    .single();

  if (tokenError || !formToken) {
    return { ok: false, error: tokenError?.message ?? "Failed to create token" };
  }

  // Create sections linked to the order
  if (opts.orderId && opts.sectionNames?.length) {
    const inserts = opts.sectionNames.map((name, i) => ({
      order_id: opts.orderId!,
      name,
      display_order: i,
      total_quantity: 0,
    }));

    const { error: sectionsError } = await supabase
      .from("order_sections")
      .insert(inserts);

    if (sectionsError) {
      await supabase
        .from("order_form_tokens")
        .delete()
        .eq("id", (formToken as unknown as OrderFormToken).id);
      return { ok: false, error: sectionsError.message };
    }
  }

  return { ok: true, data: formToken as unknown as OrderFormToken };
}

export async function deactivateOrderFormToken(
  tokenId: string
): Promise<ActionResult<void>> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("order_form_tokens")
    .update({ is_active: false })
    .eq("id", tokenId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

export async function getOrderFormTokens(
  organizationId: string
): Promise<ActionResult<OrderFormToken[]>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("order_form_tokens")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []) as unknown as OrderFormToken[] };
}

export async function validateOrderFormToken(
  _token: string
): Promise<ActionResult<OrderFormToken>> {
  throw new Error("Not implemented — use resolveFormToken in shared-form-public instead");
}
