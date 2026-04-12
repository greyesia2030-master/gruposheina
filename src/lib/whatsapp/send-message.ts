import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

const FROM = process.env.TWILIO_WHATSAPP_FROM ?? 'whatsapp:+14155238886';

/**
 * Envía un mensaje de texto por WhatsApp vía Twilio.
 */
export async function sendWhatsAppMessage(to: string, body: string): Promise<string> {
  const normalizedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const message = await client.messages.create({
    from: FROM,
    to: normalizedTo,
    body,
  });
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
