import { createSupabaseAdmin } from '@/lib/supabase/server';
import { identifyClient } from '@/lib/whatsapp/receive-message';
import type { User } from '@/lib/types/database';

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

export interface UserValidationResult extends ValidationResult {
  user?: User & { organization: unknown };
}

export interface DraftValidationResult extends ValidationResult {
  orderId?: string;
  weekLabel?: string;
  totalUnits?: number;
}

/**
 * Verifica que el teléfono esté en la lista authorized_phones de la organización.
 * Si la lista está vacía, cualquier teléfono vinculado al cliente pasa.
 */
export async function validateAuthorizedPhone(
  phone: string,
  orgId: string
): Promise<ValidationResult> {
  try {
    const supabase = await createSupabaseAdmin();
    const { data: org } = await supabase
      .from('organizations')
      .select('authorized_phones')
      .eq('id', orgId)
      .single();

    if (!org) return { ok: false, error: 'Organización no encontrada.' };

    const list: string[] = org.authorized_phones ?? [];
    if (list.length === 0) return { ok: true }; // sin restricción

    // Normalizar comparación (ignorar variante +549/+54)
    const normalized = phone.replace(/^whatsapp:/i, '').replace(/^\+549/, '+54');
    const match = list.some((p) => {
      const n = p.replace(/^\+549/, '+54');
      return n === normalized;
    });

    if (!match) {
      return { ok: false, error: 'Este número no está autorizado para enviar pedidos.' };
    }
    return { ok: true };
  } catch {
    return { ok: true }; // en caso de error, no bloquear
  }
}

/**
 * Verifica que no haya un pedido en estado 'draft' para la organización.
 * Retorna el orderId si hay un draft existente.
 */
export async function validateNoDraftPending(
  orgId: string
): Promise<DraftValidationResult> {
  try {
    const supabase = await createSupabaseAdmin();
    const { data: order } = await supabase
      .from('orders')
      .select('id, week_label, total_units')
      .eq('organization_id', orgId)
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (order) {
      return {
        ok: false,
        error: `Ya tenés un pedido borrador para *${order.week_label}* (${order.total_units} viandas). Respondé *confirmo* para confirmarlo o *reemplazar* para enviar uno nuevo.`,
        orderId: order.id,
        weekLabel: order.week_label,
        totalUnits: order.total_units,
      };
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

/**
 * Verifica que el tipo de archivo adjunto sea un Excel válido.
 */
export function validateExcelFile(
  contentType: string,
  numMedia: number
): ValidationResult {
  if (numMedia === 0) {
    return { ok: false, error: 'No se adjuntó ningún archivo.' };
  }
  const lower = contentType.toLowerCase();
  const valid = ['spreadsheet', 'excel', 'octet-stream', 'xlsx', 'xls'].some(
    (t) => lower.includes(t)
  );
  if (!valid) {
    return {
      ok: false,
      error: `El archivo adjunto (${contentType}) no es un Excel. Enviame el archivo .xlsx de pedidos.`,
    };
  }
  return { ok: true };
}

/**
 * Verifica que el teléfono esté registrado como usuario activo en el sistema.
 * Usa el fallback de variante argentina (+549 ↔ +54).
 */
export async function validateRegisteredUser(
  phone: string
): Promise<UserValidationResult> {
  const user = await identifyClient(phone);
  if (!user) {
    return {
      ok: false,
      error: `Tu número *${phone}* no está registrado en el sistema de Grupo Sheina. Contactá a Sheina para que te den de alta.`,
    };
  }
  return { ok: true, user: user as User & { organization: unknown } };
}
