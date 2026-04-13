import { createSupabaseAdmin } from '@/lib/supabase/server';
import type { MessageType } from '@/lib/whatsapp/classify-message';

/**
 * Registra un mensaje ENTRANTE de WhatsApp en conversation_logs.
 * No lanza excepción — los errores de logging no deben interrumpir el flujo.
 */
export async function logIn(
  phone: string,
  type: MessageType,
  body: string,
  mediaUrl?: string,
  orderId?: string,
  messageSid?: string
): Promise<void> {
  try {
    const supabase = await createSupabaseAdmin();
    await supabase.from('conversation_logs').insert({
      phone,
      direction: 'in',
      message_type: type,
      body: body.substring(0, 2000), // limitar longitud
      media_url: mediaUrl ?? null,
      order_id: orderId ?? null,
      conv_state: null,
      message_sid: messageSid ?? null,
    });
  } catch (err) {
    console.error('AUDIT_LOG: failed to log incoming message', err);
  }
}

/**
 * Registra un mensaje SALIENTE de WhatsApp en conversation_logs.
 * No lanza excepción.
 */
export async function logOut(
  phone: string,
  body: string,
  orderId?: string,
  convState?: string
): Promise<void> {
  try {
    const supabase = await createSupabaseAdmin();
    await supabase.from('conversation_logs').insert({
      phone,
      direction: 'out',
      message_type: null,
      body: body.substring(0, 2000),
      media_url: null,
      order_id: orderId ?? null,
      conv_state: convState ?? null,
    });
  } catch (err) {
    console.error('AUDIT_LOG: failed to log outgoing message', err);
  }
}

/**
 * Función unificada — import { logConversation } from '@/lib/whatsapp/audit-log'
 */
export async function logConversation(
  direction: 'in' | 'out',
  phone: string,
  options: {
    type?: MessageType | string;
    body?: string;
    mediaUrl?: string;
    orderId?: string;
    convState?: string;
    messageSid?: string;
  } = {}
): Promise<void> {
  if (direction === 'in') {
    await logIn(phone, (options.type ?? 'HELP') as MessageType, options.body ?? '', options.mediaUrl, options.orderId, options.messageSid);
  } else {
    await logOut(phone, options.body ?? '', options.orderId, options.convState);
  }
}
