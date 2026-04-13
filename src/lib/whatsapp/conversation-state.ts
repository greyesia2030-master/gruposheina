import { createSupabaseAdmin } from '@/lib/supabase/server';

export type ConvState =
  | 'idle'
  | 'processing'
  | 'awaiting_confirmation'
  | 'confirmed';

export interface ConvStateRecord {
  state: ConvState;
  orderId?: string;
}

export interface ClientContext {
  convState: ConvState;
  pendingOrderId?: string;
  pendingWeekLabel?: string;
  pendingTotalUnits?: number;
}

/**
 * Obtiene el último estado de conversación para un teléfono.
 * Lee el campo conv_state del registro más reciente de conversation_logs.
 */
export async function getLastState(phone: string): Promise<ConvStateRecord> {
  try {
    const supabase = await createSupabaseAdmin();
    const { data } = await supabase
      .from('conversation_logs')
      .select('conv_state, order_id')
      .eq('phone', phone)
      .not('conv_state', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data || !data.conv_state) return { state: 'idle' };
    return {
      state: data.conv_state as ConvState,
      orderId: data.order_id ?? undefined,
    };
  } catch {
    return { state: 'idle' };
  }
}

/**
 * Persiste el nuevo estado de conversación en conversation_logs.
 */
export async function setState(
  phone: string,
  state: ConvState,
  orderId?: string
): Promise<void> {
  try {
    const supabase = await createSupabaseAdmin();
    await supabase.from('conversation_logs').insert({
      phone,
      direction: 'out',
      message_type: '__state__',
      body: null,
      conv_state: state,
      order_id: orderId ?? null,
    });
  } catch (err) {
    console.error('CONV_STATE: failed to persist state', state, err);
  }
}

/**
 * Retorna el contexto de conversación para una organización.
 * Lee el pedido activo más reciente (draft / confirmed / in_production)
 * para determinar qué estado corresponde.
 */
export async function getClientContext(orgId: string): Promise<ClientContext> {
  try {
    const supabase = await createSupabaseAdmin();
    const { data: order } = await supabase
      .from('orders')
      .select('id, week_label, total_units, status')
      .eq('organization_id', orgId)
      .in('status', ['draft', 'confirmed', 'in_production'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!order) return { convState: 'idle' };

    const stateMap: Record<string, ConvState> = {
      draft: 'awaiting_confirmation',
      confirmed: 'confirmed',
      in_production: 'confirmed',
    };

    return {
      convState: stateMap[order.status] ?? 'idle',
      pendingOrderId: order.id,
      pendingWeekLabel: order.week_label,
      pendingTotalUnits: order.total_units,
    };
  } catch {
    return { convState: 'idle' };
  }
}
