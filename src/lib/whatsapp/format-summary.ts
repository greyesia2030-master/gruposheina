import type { ValidatedOrderData } from '@/lib/excel/types';

const DAY_LABELS: Record<number, string> = {
  1: 'LUNES',
  2: 'MARTES',
  3: 'MIÉRCOLES',
  4: 'JUEVES',
  5: 'VIERNES',
};

/**
 * Genera un mensaje de WhatsApp legible con el resumen del pedido.
 */
export function formatOrderSummary(orderData: ValidatedOrderData): string {
  const lines: string[] = [];

  lines.push(`📋 *Resumen de pedido — ${orderData.weekLabel}*`);
  lines.push('');

  let weekTotal = 0;

  for (const day of orderData.days) {
    const dayLabel = DAY_LABELS[day.dayOfWeek] ?? day.dayName;
    lines.push(`*${dayLabel}*`);

    for (const opt of day.options) {
      if (opt.mainQuantity > 0) {
        lines.push(`  ${opt.code}. ${opt.displayName}: ${opt.mainQuantity}`);
      }
    }

    lines.push(`  _Total del día: ${day.totalUnits}_`);
    lines.push('');
    weekTotal += day.totalUnits;
  }

  lines.push(`*Total semanal: ${weekTotal} viandas*`);

  // Agregar anomalías si hay
  if (orderData.anomalies.length > 0) {
    lines.push('');
    lines.push('⚠️ *Observaciones:*');
    for (const anomaly of orderData.anomalies) {
      lines.push(`  • ${anomaly}`);
    }
  }

  lines.push('');
  lines.push('Respondé *confirmo* para confirmar o *cancelar* para anular.');

  return lines.join('\n');
}
