import Anthropic from '@anthropic-ai/sdk';
import { buildParseExcelSystemPrompt, buildParseExcelUserPrompt } from './prompts/parse-excel';
import type { ParseResult, ParsedWeek, ValidatedOrderData, ValidatedDay } from '@/lib/excel/types';

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
 * Convierte ParsedWeek → ValidatedOrderData sin IA.
 * Usado como fallback si Claude falla o devuelve estructura incorrecta.
 */
function convertWeekToValidated(week: ParsedWeek): ValidatedOrderData {
  const days: ValidatedDay[] = week.days.map((day) => ({
    dayOfWeek: day.dayOfWeek,
    dayName: day.dayName,
    options: day.options.map((opt) => ({
      code: opt.code,
      displayName: opt.displayName,
      mainQuantity: opt.quantities.main,
      departments: opt.quantities.departments,
      isValid: opt.anomalies.length === 0,
      validationNotes: opt.anomalies,
    })),
    totalUnits: day.totalUnits,
  }));

  return {
    weekLabel: week.weekLabel,
    days,
    totalUnits: days.reduce((sum, d) => sum + d.totalUnits, 0),
    anomalies: week.days.flatMap((d) => d.options.flatMap((o) => o.anomalies)),
  };
}

/**
 * Normaliza la respuesta de Claude al formato ValidatedOrderData.
 * Maneja dos casos:
 *   1. Claude devolvió el formato correcto (weekLabel, days, totalUnits, anomalies)
 *   2. Claude echó de vuelta el formato de entrada ({ weeks: [...] })
 */
function normalizeClaudeResponse(raw: unknown, fallbackWeek: ParsedWeek): ValidatedOrderData {
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;

    // Caso 1: formato correcto
    if ('weekLabel' in obj && 'days' in obj && Array.isArray(obj.days)) {
      return obj as unknown as ValidatedOrderData;
    }

    // Caso 2: Claude devolvió { weeks: [...] } (input echoed back)
    if ('weeks' in obj && Array.isArray(obj.weeks) && obj.weeks.length > 0) {
      return convertWeekToValidated(obj.weeks[0] as ParsedWeek);
    }
  }

  return convertWeekToValidated(fallbackWeek);
}

/**
 * Envía datos parseados del Excel a Claude para validación y estructuración.
 */
export async function parseExcelWithAI(rawData: ParseResult): Promise<ValidatedOrderData> {
  const firstWeek = rawData.weeks[0];
  if (!firstWeek) {
    throw new Error('No hay datos de semana en el Excel');
  }

  // Si el parser ya detectó errores graves, no llamar a Claude
  if (rawData.errors.length > 0) {
    throw new Error(`Errores en el Excel: ${rawData.errors.join('; ')}`);
  }

  let claudeRaw: unknown = null;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
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
      claudeRaw = JSON.parse(cleanJsonResponse(textBlock.text));
    } catch {
      console.error('EXCEL: Claude JSON parse failed, using direct conversion. Raw:', textBlock.text.slice(0, 200));
      return convertWeekToValidated(firstWeek);
    }
  } catch (apiErr) {
    const msg = apiErr instanceof Error ? apiErr.message : String(apiErr);
    // Si es un error de estructura/parse ya manejado arriba, re-lanzar
    if (msg.startsWith('No hay datos') || msg.startsWith('Errores en el Excel')) throw apiErr;
    // Si falla la API de Claude, usar conversión directa
    console.error('EXCEL: Claude API call failed, using direct conversion:', msg);
    return convertWeekToValidated(firstWeek);
  }

  return normalizeClaudeResponse(claudeRaw, firstWeek);
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
