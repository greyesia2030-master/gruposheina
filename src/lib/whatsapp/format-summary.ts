import type { ValidatedOrderData } from '@/lib/excel/types';

const DAY_LABELS: Record<number, string> = {
  1: 'LUNES',
  2: 'MARTES',
  3: 'MIÉRCOLES',
  4: 'JUEVES',
  5: 'VIERNES',
};

function shortName(name: string, maxLen = 28): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen - 3) + '...';
}

/**
 * Genera un resumen compacto del pedido para WhatsApp.
 * Diseñado para mantenerse ~900 chars en pedidos típicos.
 * Para pedidos grandes se usa sendLongWhatsAppMessage que hace splitting.
 */
export function formatOrderSummary(orderData: ValidatedOrderData): string {
  const lines: string[] = [];

  lines.push(`📋 *Resumen — ${orderData.weekLabel}*`);

  let weekTotal = 0;

  for (const day of orderData.days) {
    const activeOptions = day.options.filter((o) => o.mainQuantity > 0);
    const dayLabel = DAY_LABELS[day.dayOfWeek] ?? day.dayName;

    lines.push('');

    if (day.totalUnits === 0 || activeOptions.length === 0) {
      lines.push(`*${dayLabel}* — sin pedido`);
      continue;
    }

    // Cabecera de día con total inline (ahorra una línea por día)
    lines.push(`*${dayLabel}* — ${day.totalUnits} vnd`);

    for (const opt of activeOptions) {
      lines.push(`  ${opt.code}. ${shortName(opt.displayName)}: ${opt.mainQuantity}`);
    }

    weekTotal += day.totalUnits;
  }

  lines.push('');
  lines.push(`*Total semanal: ${weekTotal} viandas*`);

  // Anomalías: max 3, truncadas a 80 chars
  if (orderData.anomalies.length > 0) {
    lines.push('');
    lines.push('⚠️ *Observaciones:*');
    const shown = orderData.anomalies.slice(0, 3);
    for (const anomaly of shown) {
      lines.push(`  • ${anomaly.slice(0, 80)}`);
    }
    if (orderData.anomalies.length > 3) {
      lines.push(`  • ...y ${orderData.anomalies.length - 3} más`);
    }
  }

  lines.push('');
  lines.push('Respondé *confirmo* o *cancelar*');

  return lines.join('\n');
}

/**
 * Genera un resumen detallado del pedido con desglose por departamento.
 * Diseñado para la consulta de "detalle" o para el admin panel.
 * Más largo que formatOrderSummary — usar sendLongWhatsAppMessage.
 */
export function formatOrderSummaryDetailed(orderData: ValidatedOrderData): string {
  const lines: string[] = [];

  lines.push(`📋 *Detalle — ${orderData.weekLabel}*`);

  let weekTotal = 0;

  for (const day of orderData.days) {
    const activeOptions = day.options.filter((o) => o.mainQuantity > 0);
    const dayLabel = DAY_LABELS[day.dayOfWeek] ?? day.dayName;

    lines.push('');

    if (day.totalUnits === 0 || activeOptions.length === 0) {
      lines.push(`*${dayLabel}* — sin pedido`);
      continue;
    }

    lines.push(`*${dayLabel}* — ${day.totalUnits} vnd`);

    for (const opt of activeOptions) {
      const depts = Object.entries(opt.departments)
        .filter(([, qty]) => qty > 0)
        .map(([dept, qty]) => `${dept}:${qty}`)
        .join(' ');
      const deptsStr = depts ? ` _(${depts})_` : '';
      lines.push(`  ${opt.code}. ${shortName(opt.displayName, 24)}: ${opt.mainQuantity}${deptsStr}`);
    }

    weekTotal += day.totalUnits;
  }

  lines.push('');
  lines.push(`*Total semanal: ${weekTotal} viandas*`);

  if (orderData.anomalies.length > 0) {
    lines.push('');
    lines.push('⚠️ *Observaciones:*');
    for (const anomaly of orderData.anomalies.slice(0, 5)) {
      lines.push(`  • ${anomaly.slice(0, 100)}`);
    }
  }

  return lines.join('\n');
}
