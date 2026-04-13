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

/**
 * Obtiene el último estado de conversación para un teléfono.
 * Lee el campo conv_state del registro más reciente de conversation_logs.
 * Si no hay registros, retorna 'idle'.
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
 * Persiste el nuevo estado de conversación escribiendo un registro
 * en conversation_logs con conv_state = state.
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
    // No bloquear el flujo principal si falla el estado
    console.error('CONV_STATE: failed to persist state', state, err);
  }
}
