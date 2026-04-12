import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

const rawFrom = process.env.TWILIO_WHATSAPP_FROM ?? '+14155238886';
const FROM = rawFrom.startsWith('whatsapp:') ? rawFrom : `whatsapp:${rawFrom}`;

/**
 * Envía un mensaje de texto por WhatsApp vía Twilio.
 */
export async function sendWhatsAppMessage(to: string, body: string): Promise<string> {
  const normalizedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  console.log('TWILIO SEND:', JSON.stringify({
    from: FROM,
    to: normalizedTo,
    envRaw: process.env.TWILIO_WHATSAPP_FROM ?? '(not set, using default)',
    hasSid: !!process.env.TWILIO_ACCOUNT_SID,
    hasToken: !!process.env.TWILIO_AUTH_TOKEN,
    bodyPreview: body.substring(0, 50),
  }));
  const message = await client.messages.create({
    from: FROM,
    to: normalizedTo,
    body,
  });
  console.log('TWILIO SEND OK:', message.sid);
  return message.sid;
}

/**
 * Envía un mensaje largo dividiéndolo en chunks de ≤ 1,500 chars.
 * Divide en límites de \n\n (entre párrafos/días) para mantener coherencia.
 * Retorna un array de SIDs — uno por cada mensaje enviado.
 */
export async function sendLongWhatsAppMessage(to: string, body: string): Promise<string[]> {
  const MAX = 1500;

  if (body.length <= MAX) {
    const sid = await sendWhatsAppMessage(to, body);
    return [sid];
  }

  // Dividir en párrafos (\n\n) y reagrupar en chunks ≤ MAX
  const paragraphs = body.split('\n\n');
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    const candidate = current ? `${current}\n\n${para}` : para;
    if (candidate.length <= MAX) {
      current = candidate;
    } else {
      if (current) chunks.push(current);
      // Si el párrafo solo excede MAX, dividir línea a línea
      if (para.length > MAX) {
        const lines = para.split('\n');
        let lineBuf = '';
        for (const line of lines) {
          const lc = lineBuf ? `${lineBuf}\n${line}` : line;
          if (lc.length <= MAX) {
            lineBuf = lc;
          } else {
            if (lineBuf) chunks.push(lineBuf);
            lineBuf = line;
          }
        }
        current = lineBuf;
      } else {
        current = para;
      }
    }
  }
  if (current) chunks.push(current);

  console.log(`TWILIO SPLIT: message too long (${body.length} chars), sending as ${chunks.length} chunks`);

  const sids: string[] = [];
  for (const chunk of chunks) {
    const sid = await sendWhatsAppMessage(to, chunk);
    sids.push(sid);
  }
  return sids;
}

/**
 * Envía un archivo con mensaje por WhatsApp vía Twilio.
 */
export async function sendWhatsAppFile(
  to: string,
  mediaUrl: string,
  body: string
): Promise<string> {
  const normalizedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const message = await client.messages.create({
    from: FROM,
    to: normalizedTo,
    body,
    mediaUrl: [mediaUrl],
  });
  return message.sid;
}
