import { createSupabaseAdmin } from '@/lib/supabase/server';

export type MessageAction = 'PROCESS_EXCEL' | 'CONFIRM_ORDER' | 'CANCEL_ORDER' | 'HELP';

export interface TwilioWebhookBody {
  From: string;
  Body: string;
  NumMedia: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
}

export interface IncomingMessageResult {
  action: MessageAction;
  phone: string;
  text: string;
  mediaUrl?: string;
  mediaContentType?: string;
}

const CONFIRM_PATTERNS = /^(confirmo|ok|dale|listo|sí|si|confirmado|confirmar)$/i;
const CANCEL_PATTERNS = /^(cancelar|anular|no|cancelo)$/i;

/**
 * Procesa un mensaje entrante de WhatsApp y determina la acción a tomar.
 */
export function processIncomingMessage(body: TwilioWebhookBody): IncomingMessageResult {
  const phone = body.From.replace('whatsapp:', '');
  const text = body.Body?.trim() ?? '';
  const numMedia = parseInt(body.NumMedia ?? '0', 10);

  // Tiene archivo adjunto Excel
  if (numMedia > 0 && body.MediaUrl0) {
    const contentType = body.MediaContentType0 ?? '';
    const isExcel = contentType.includes('spreadsheet') ||
                    contentType.includes('excel') ||
                    contentType.includes('octet-stream');

    if (isExcel) {
      return {
        action: 'PROCESS_EXCEL',
        phone,
        text,
        mediaUrl: body.MediaUrl0,
        mediaContentType: contentType,
      };
    }
  }

  // Confirmación
  if (CONFIRM_PATTERNS.test(text)) {
    return { action: 'CONFIRM_ORDER', phone, text };
  }

  // Cancelación
  if (CANCEL_PATTERNS.test(text)) {
    return { action: 'CANCEL_ORDER', phone, text };
  }

  // Cualquier otra cosa
  return { action: 'HELP', phone, text };
}

/**
 * Identifica al cliente por su número de teléfono.
 */
export async function identifyClient(phone: string) {
  const supabase = await createSupabaseAdmin();

  // Buscar usuario por teléfono (normalizar formato)
  const cleanPhone = phone.replace(/\D/g, '');
  const { data: user } = await supabase
    .from('users')
    .select('*, organization:organizations(*)')
    .or(`phone.eq.${phone},phone.eq.+${cleanPhone},phone.ilike.%${cleanPhone.slice(-10)}`)
    .eq('is_active', true)
    .limit(1)
    .single();

  return user;
}
