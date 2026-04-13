/**
 * Plantillas centralizadas de respuestas WhatsApp para Grupo Sheina.
 * Todas las funciones retornan strings listos para enviar vía Twilio.
 */

import type { OrderStatus } from '@/lib/types/database';

const STATUS_LABELS: Record<OrderStatus, string> = {
  draft:         'Borrador ⏳',
  confirmed:     'Confirmado ✅',
  in_production: 'En producción 🍳',
  delivered:     'Entregado 📦',
  cancelled:     'Cancelado ❌',
};

export const R = {
  /** Saludo inicial o respuesta a texto libre */
  greeting: (name?: string | null) =>
    `👋 ¡Hola${name ? `, ${name.split(' ')[0]}` : ''}! Soy el asistente de *Grupo Sheina*.\n\nPodés:\n📎 *Enviar tu Excel* de pedidos y lo proceso automáticamente\n✅ Responder *confirmo* para confirmar un pedido\n❌ Responder *cancelar* para anular un pedido\n📊 Escribir *estado* para ver tu pedido actual\n\n¿En qué te puedo ayudar?`,

  /** Saludo cuando hay un pedido pendiente */
  welcomeWithPending: (name: string | null, week: string, units: number) =>
    `👋 ¡Hola${name ? `, ${name.split(' ')[0]}` : ''}! Tenés un pedido borrador para *${week}* (${units} viandas).\n\nRespondé *confirmo* para confirmarlo, *cancelar* para anularlo, o enviá un nuevo Excel para reemplazarlo.`,

  /** Teléfono no registrado */
  notRegistered: (phone: string) =>
    `⚠️ Tu número *${phone}* no está registrado en el sistema de Grupo Sheina.\n\nContactá a Sheina para que te den de alta.`,

  /** Organización suspendida o inactiva */
  orgInactive: (reason = 'inactiva') =>
    `⚠️ La cuenta de tu empresa está *${reason}*. Contactá a Sheina para más información.`,

  /** ACK inmediato al recibir Excel (sin draft previo) */
  processing: () =>
    `📥 Recibí tu archivo. Estoy procesándolo... te mando el resumen en un momento.`,

  /** ACK al reemplazar un draft previo con nuevo Excel */
  replacedByNew: () =>
    `🔄 Tu pedido anterior fue cancelado. Procesando el nuevo Excel...`,

  /** Error al parsear el Excel */
  parseError: (errors: string[]) =>
    `❌ No pude leer el Excel:\n${errors.map((e) => `• ${e}`).join('\n')}\n\nVerificá el archivo y envialo de nuevo.`,

  /** Pedido creado — se pasa el resumen formateado (compact) */
  orderSummaryCompact: (summary: string) => summary,

  /** Pedido creado — alias genérico */
  orderCreated: (summary: string) => summary,

  /** Pedido confirmado exitosamente */
  confirmSuccess: (units: number, week: string) =>
    `✅ ¡Pedido confirmado!\nTotal: *${units} viandas* — ${week}\n\nSi necesitás hacer cambios antes del corte, enviá un nuevo Excel.`,

  /** Sin pedido borrador para confirmar */
  noOrderToConfirm: () =>
    `No encontré un pedido pendiente de confirmación.\n\nEnviame tu Excel para comenzar.`,

  /** Pedido cancelado exitosamente */
  cancelSuccess: (week: string) =>
    `🚫 Pedido cancelado — ${week}\n\nSi querés hacer un nuevo pedido, enviame el Excel.`,

  /** Sin pedido activo para cancelar */
  noOrderToCancel: () =>
    `No encontré un pedido activo para cancelar.`,

  /** Intento de cancelar después del corte */
  postCutoff: () =>
    `⚠️ Ya pasó el horario de corte. No podés cancelar el pedido por este medio.\n\nContactá a Sheina directamente para modificarlo.`,

  /** Ya existe un borrador — pedirle que confirme o reemplace */
  draftExists: (week: string, units: number) =>
    `📋 Ya tenés un pedido borrador para *${week}* (${units} viandas).\n\nRespondé *confirmo* para confirmarlo, o *reemplazar* para enviarlo nuevamente con un nuevo Excel.`,

  /** Archivo adjunto que no es Excel */
  invalidFile: (contentType: string) =>
    `⚠️ El archivo adjunto (*${contentType}*) no es un Excel (.xlsx).\n\nEnviame el archivo de pedidos en formato Excel.`,

  /** Estado del pedido activo */
  orderStatus: (weekLabel: string, status: OrderStatus, units: number) =>
    `📋 *Tu pedido — ${weekLabel}*\nEstado: ${STATUS_LABELS[status] ?? status}\nViandas: ${units}`,

  /** Sin pedido activo esta semana */
  noActiveOrder: () =>
    `No tenés un pedido activo para esta semana.\n\nEnviame tu Excel para hacer uno.`,

  /** Error interno al procesar Excel */
  processingError: (msg: string) =>
    `❌ Hubo un error al procesar tu Excel: ${msg.substring(0, 200)}\n\nIntentá de nuevo o contactá a Sheina.`,

  /** Advertencia de horario de corte */
  cutoffWarning: (time: string) =>
    `⏰ Recordá que el corte de pedidos es a las *${time}*. Luego no podrás modificarlo.`,

  /** Menú de la semana no disponible */
  menuNotAvailable: () =>
    `No hay menú publicado para esta semana todavía. Consultá más tarde.`,

  /** Error del sistema (fallback genérico) */
  systemError: () =>
    `⚠️ Hubo un error interno. Intentá de nuevo en unos minutos o contactá a Sheina.`,

  /** Mensaje no reconocido */
  unknown: () =>
    `No entendí tu mensaje. Escribí *ayuda* para ver las opciones disponibles.`,
};

// Named export alias — import { responses } from '@/lib/whatsapp/responses'
export const responses = R;
