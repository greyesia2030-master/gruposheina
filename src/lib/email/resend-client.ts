import "server-only";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "Grupo Sheina <no-reply@gruposheina.com>";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

type EmailResult = { ok: true; data: { id: string } } | { ok: false; error: string };

export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  try {
    const base = {
      from: options.from ?? FROM_EMAIL,
      to: options.to,
      subject: options.subject,
      ...(options.replyTo ? { reply_to: options.replyTo } : {}),
      ...(options.headers ? { headers: options.headers } : {}),
    };

    // Resend v6 requires exactly one of: html, text, or template
    const sendOptions = options.html
      ? { ...base, html: options.html, ...(options.text ? { text: options.text } : {}) }
      : { ...base, text: options.text ?? "" };

    const { data, error } = await resend.emails.send(sendOptions as Parameters<typeof resend.emails.send>[0]);
    if (error) return { ok: false, error: error.message };
    if (!data?.id) return { ok: false, error: "No message ID returned" };
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
