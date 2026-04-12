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
