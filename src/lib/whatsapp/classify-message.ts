/**
 * Clasificador de mensajes entrantes de WhatsApp.
 * Extiende la lógica básica de receive-message.ts con tipos más granulares.
 */

export type MessageType =
  | 'EXCEL_FILE'    // adjunto Excel (.xlsx / .xls)
  | 'INVALID_FILE'  // adjunto que NO es Excel
  | 'CONFIRM'       // "confirmo", "ok", "dale", "listo", "sí"
  | 'CANCEL'        // "cancelar", "anular", "cancelo"
  | 'REPLACE'       // quiere enviar un nuevo Excel reemplazando el borrador
  | 'STATUS'        // consulta estado de su pedido
  | 'MENU'          // consulta el menú de la semana
  | 'DETAIL'        // pide desglose detallado del pedido
  | 'HELP';         // cualquier otra cosa → saludo / ayuda

export interface TwilioWebhookBody {
  From: string;
  Body: string;
  NumMedia: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
}

export interface ClassifiedMessage {
  type: MessageType;
  /** Número en E.164 (sin prefijo "whatsapp:") */
  phone: string;
  text: string;
  mediaUrl?: string;
  mediaContentType?: string;
}

// --- Patrones de texto ---
const CONFIRM_RE  = /^(confirmo|ok|dale|listo|sí|si|confirmado|confirmar)$/i;
const CANCEL_RE   = /^(cancelar|anular|cancelo)$/i;
const REPLACE_RE  = /reemplaz|nuevo\s+pedido|actualiz/i;
const STATUS_RE   = /\b(estado|mi\s+pedido|cu[aá]ndo|status)\b/i;
const MENU_RE     = /\b(men[uú]|carta|opciones\s+del\s+d[íi]a|qu[eé]\s+hay)\b/i;
const DETAIL_RE   = /\b(detalle|desglose|cu[aá]ntas|viandas\s+por)\b/i;

// MIME types considerados Excel
const EXCEL_MIME  = ['spreadsheet', 'excel', 'octet-stream', 'xlsx', 'xls'];

function isExcelMime(contentType: string): boolean {
  const lower = contentType.toLowerCase();
  return EXCEL_MIME.some((t) => lower.includes(t));
}

function normalizePhone(raw: string): string {
  return raw.replace(/^whatsapp:/i, '').trim();
}

/**
 * Clasifica un mensaje entrante de Twilio WebHook.
 */
export function classifyMessage(body: TwilioWebhookBody): ClassifiedMessage {
  const phone = normalizePhone(body.From);
  const text  = (body.Body ?? '').trim();
  const numMedia = parseInt(body.NumMedia ?? '0', 10);

  // Adjunto
  if (numMedia > 0 && body.MediaUrl0) {
    const contentType = body.MediaContentType0 ?? '';
    if (isExcelMime(contentType)) {
      return { type: 'EXCEL_FILE', phone, text, mediaUrl: body.MediaUrl0, mediaContentType: contentType };
    }
    return { type: 'INVALID_FILE', phone, text, mediaUrl: body.MediaUrl0, mediaContentType: contentType };
  }

  // Texto — orden de prioridad: replace antes que confirm
  if (REPLACE_RE.test(text))  return { type: 'REPLACE', phone, text };
  if (CONFIRM_RE.test(text))  return { type: 'CONFIRM', phone, text };
  if (CANCEL_RE.test(text))   return { type: 'CANCEL',  phone, text };
  if (STATUS_RE.test(text))   return { type: 'STATUS',  phone, text };
  if (MENU_RE.test(text))     return { type: 'MENU',    phone, text };
  if (DETAIL_RE.test(text))   return { type: 'DETAIL',  phone, text };

  return { type: 'HELP', phone, text };
}
