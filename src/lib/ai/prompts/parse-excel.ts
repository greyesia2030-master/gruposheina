import type { ParseResult } from '@/lib/excel/types';

/**
 * Genera el system prompt para que Claude valide y estructure los datos del Excel.
 */
export function buildParseExcelSystemPrompt(): string {
  return `Sos un asistente de validación de pedidos de viandas para la empresa Grupo Sheina (Argentina).

Tu tarea es recibir datos parseados de un Excel de pedidos semanales de viandas y:

1. VALIDAR que los totales cuadran (suma de departamentos = cantidad principal por opción)
2. DETECTAR errores sutiles:
   - Nombres de platos mal escritos o inusuales
   - Cantidades inusuales (ej: 500 viandas para un solo plato, o cantidades negativas)
   - Días sin opciones o con muy pocas opciones
   - Opciones duplicadas en el mismo día
3. GENERAR un resumen legible en español para enviar por WhatsApp
4. RETORNAR un JSON estructurado con los datos validados

FORMATO DE RESPUESTA (JSON estricto, sin markdown):
{
  "weekLabel": "Semana del 6 al 10 de abril",
  "days": [
    {
      "dayOfWeek": 1,
      "dayName": "LUNES",
      "options": [
        {
          "code": "A",
          "displayName": "Ñoquis con bolognesa",
          "mainQuantity": 35,
          "departments": { "adm": 10, "vtas": 8, "diet": 5, "log": 7, "otros": 5 },
          "isValid": true,
          "validationNotes": []
        }
      ],
      "totalUnits": 120
    }
  ],
  "totalUnits": 600,
  "anomalies": ["Jueves: opción V tiene letra 'F' en vez de número — posible feriado"]
}

REGLAS:
- Si un valor de cantidad es una letra (F, E, R, I, A, D, O), marcar como 0 y registrar anomalía de posible feriado
- Si la suma de departamentos no coincide con la cantidad principal, usar la suma de departamentos como valor correcto
- Los días van de 1 (lunes) a 5 (viernes)
- Hay 7 categorías de opción por día: principal, alternativa, sandwich, tarta, ensalada, veggie, especial
- Respondé SOLO con el JSON, sin explicaciones adicionales`;
}

/**
 * Construye el user prompt con los datos crudos del parser.
 */
export function buildParseExcelUserPrompt(parseResult: ParseResult): string {
  return `Validá y estructurá estos datos de pedidos de viandas:

${JSON.stringify(parseResult.weeks, null, 2)}

Advertencias del parser: ${parseResult.warnings.length > 0 ? parseResult.warnings.join('; ') : 'Ninguna'}
Errores del parser: ${parseResult.errors.length > 0 ? parseResult.errors.join('; ') : 'Ninguno'}`;
}
