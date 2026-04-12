import Anthropic from '@anthropic-ai/sdk';
import { buildParseExcelSystemPrompt, buildParseExcelUserPrompt } from './prompts/parse-excel';
import type { ParseResult, ValidatedOrderData } from '@/lib/excel/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

/**
 * Envía datos parseados del Excel a Claude para validación y estructuración.
 */
export async function parseExcelWithAI(rawData: ParseResult): Promise<ValidatedOrderData> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: buildParseExcelSystemPrompt(),
    messages: [
      { role: 'user', content: buildParseExcelUserPrompt(rawData) },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Respuesta inesperada de Claude: sin contenido de texto');
  }

  try {
    const parsed = JSON.parse(cleanJsonResponse(textBlock.text)) as ValidatedOrderData;
    return parsed;
  } catch {
    throw new Error(`Error al parsear JSON de Claude: ${textBlock.text.slice(0, 200)}`);
  }
}

/**
 * Genera un resumen legible del pedido para enviar por WhatsApp.
 */
export async function generateOrderSummary(orderData: ValidatedOrderData): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: `Sos un asistente de Grupo Sheina. Generá un resumen de pedido para WhatsApp.
Formato esperado:
📋 *Resumen de pedido — [semana]*
[Para cada día:]
*[DÍA]*
[lista de opciones con cantidades]
Total del día: X

*Total semanal: X viandas*
[anomalías si hay]

Respondé *confirmo* para confirmar o *cancelar* para anular.`,
    messages: [
      { role: 'user', content: JSON.stringify(orderData) },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Respuesta inesperada de Claude al generar resumen');
  }

  return textBlock.text;
}
