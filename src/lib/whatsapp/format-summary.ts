import type { ValidatedOrderData } from '@/lib/excel/types';

const DAY_LABELS: Record<number, string> = {
  1: 'LUNES',
  2: 'MARTES',
  3: 'MIÉRCOLES',
  4: 'JUEVES',
  5: 'VIERNES',
};

const DAY_SHORT: Record<number, string> = {
  1: 'Lun',
  2: 'Mar',
  3: 'Mié',
  4: 'Jue',
  5: 'Vie',
};

function shortName(name: string, maxLen = 24): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen - 3) + '...';
}

/**
 * Genera el resumen COMPACTO del pedido para WhatsApp.
 *
 * Formato:
 *   📋 Pedido de *Pilo Enterprise* — SEMANA 4
 *   Lun: 17 vnd | Mar: 43 vnd | Mié: 51 vnd
 *   Jue: ⛱️ Feriado | Vie: 56 vnd
 *   Total: 167 viandas
 *
 *   ⚠️ 2 días tienen totales que no cuadran
 *
 *   Respondé *confirmo* o *cancelar*
 */
export function formatCompactSummary(orderData: ValidatedOrderData, orgName?: string): string {
  const parts: string[] = [];

  const orgPart = orgName ? `de *${orgName}* — ` : '— ';
  parts.push(`📋 Pedido ${orgPart}${orderData.weekLabel}`);

  // Build one token per day
  const dayTokens: string[] = [];
  for (const day of orderData.days) {
    const short = DAY_SHORT[day.dayOfWeek] ?? String(day.dayOfWeek);

    if (day.totalUnits === 0) {
      // Detect holiday from anomalies
      const dayFull = DAY_LABELS[day.dayOfWeek] ?? '';
      const isFeriado = orderData.anomalies.some((a) => {
        const up = a.toUpperCase();
        return (up.includes(dayFull) || up.includes(short.toUpperCase())) &&
          /FERIADO|[^A-Z]F[^A-Z]?E[^A-Z]?R[^A-Z]?I[^A-Z]?A[^A-Z]?D[^A-Z]?O/i.test(a);
      });
      dayTokens.push(isFeriado ? `${short}: ⛱️ Feriado` : `${short}: —`);
    } else {
      dayTokens.push(`${short}: ${day.totalUnits}`);
    }
  }

  // Layout: 3 days on first line, remaining on second
  if (dayTokens.length <= 3) {
    parts.push(dayTokens.join(' | '));
  } else {
    parts.push(dayTokens.slice(0, 3).join(' | '));
    parts.push(dayTokens.slice(3).join(' | '));
  }

  parts.push(`*Total: ${orderData.totalUnits} viandas*`);

  parts.push('');
  parts.push('Respondé *confirmo* o *cancelar*');

  return parts.join('\n');
}

/**
 * Genera un resumen DETALLADO con desglose por departamento.
 * Para la consulta "detalle" o el admin panel.
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
      lines.push(`  ${opt.code}. ${shortName(opt.displayName)}: ${opt.mainQuantity}${deptsStr}`);
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

// Backward-compat alias (older code imported this name)
export const formatOrderSummary = formatCompactSummary;

/**
 * Resumen compacto cuando se crean múltiples pedidos de un Excel multi-semana.
 *
 * Formato:
 *   📋 3 pedidos creados para *IBM-TEST*:
 *   — *13.05 AL 20.05*: 210 vnd
 *   — *23.05 AL 25.05*: 85 vnd
 *   — *30.05 AL 03.06*: 168 vnd
 *   *Total: 463 viandas*
 *
 *   Respondé *confirmo* para confirmar todos o *cancelar*
 */
export function formatCreatedMultiSummary(
  orders: Array<{ weekLabel: string; totalUnits: number }>,
  orgName?: string
): string {
  const parts: string[] = [];
  const n = orders.length;
  const orgPart = orgName ? ` para *${orgName}*` : '';
  parts.push(`📋 ${n} pedido${n > 1 ? 's' : ''} creado${n > 1 ? 's' : ''}${orgPart}:`);

  let grandTotal = 0;
  for (const order of orders) {
    parts.push(`— *${order.weekLabel}*: ${order.totalUnits} vnd`);
    grandTotal += order.totalUnits;
  }

  parts.push('');
  parts.push(`*Total: ${grandTotal} viandas*`);
  parts.push('');
  parts.push('Respondé *confirmo* para confirmar todos o *cancelar*');

  return parts.join('\n');
}

/**
 * Genera el resumen combinado cuando el Excel tiene múltiples semanas.
 *
 * Formato:
 *   📋 Pedido de *Org* — 2 semanas
 *
 *   SEMANA 4: Lun: 70 | Mar: 70 | Mié: 70
 *   Jue: ⛱️ Feriado | Vie: ⛱️ Feriado — Total: 210 viandas
 *
 *   SEMANA 5: Lun: 50 | Mar: 60 | Mié: 55 | Jue: 58 | Vie: 57 — Total: 280 viandas
 *
 *   *Total general: 490 viandas*
 *   Respondé *confirmo* o *cancelar*
 */
export function formatMultiWeekSummary(
  weeks: Array<{ weekLabel: string; data: Parameters<typeof formatCompactSummary>[0] }>,
  orgName?: string
): string {
  const parts: string[] = [];
  const orgPart = orgName ? `de *${orgName}* — ` : '— ';
  parts.push(`📋 Pedido ${orgPart}${weeks.length} semana${weeks.length > 1 ? 's' : ''}`);

  let grandTotal = 0;

  for (const week of weeks) {
    const { data } = week;
    parts.push('');

    const dayTokens: string[] = [];
    for (const day of data.days) {
      const short = DAY_SHORT[day.dayOfWeek] ?? String(day.dayOfWeek);
      if (day.totalUnits === 0) {
        const dayFull = DAY_LABELS[day.dayOfWeek] ?? '';
        const isFeriado = data.anomalies.some((a) => {
          const up = a.toUpperCase();
          return (up.includes(dayFull) || up.includes(short.toUpperCase())) && up.includes('FERIADO');
        });
        dayTokens.push(isFeriado ? `${short}: ⛱️ Feriado` : `${short}: —`);
      } else {
        dayTokens.push(`${short}: ${day.totalUnits}`);
      }
    }

    const weekLine = dayTokens.join(' | ');
    parts.push(`*${data.weekLabel}:* ${weekLine} — Total: ${data.totalUnits} viandas`);
    grandTotal += data.totalUnits;
  }

  parts.push('');
  parts.push(`*Total general: ${grandTotal} viandas*`);
  parts.push('');
  parts.push('Respondé *confirmo* o *cancelar*');

  return parts.join('\n');
}
