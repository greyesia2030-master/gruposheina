import type { OrderStatus } from "@/lib/types/database";

export type InvariantResult = { ok: true } | { ok: false; reason: string };

const STATUSES_OPEN_FOR_LOAD: OrderStatus[] = ["draft", "partially_filled"];
const STATUSES_TERMINAL: OrderStatus[] = ["delivered", "cancelled"];

/** ¿Permite agregar/cambiar líneas? (form público + cargar mi pedido) */
export function canAcceptLoads(status: OrderStatus): InvariantResult {
  if (STATUSES_OPEN_FOR_LOAD.includes(status)) return { ok: true };
  return {
    ok: false,
    reason: `El pedido está en estado "${status}" y no acepta cargas. Contactá al administrador del cliente o a Sheina.`,
  };
}

/** ¿Permite que admin Sheina haga overrides de líneas? */
export function canBeOverriddenByAdmin(status: OrderStatus): InvariantResult {
  if (STATUSES_OPEN_FOR_LOAD.includes(status) || status === "awaiting_confirmation") {
    return { ok: true };
  }
  return { ok: false, reason: `No se puede modificar un pedido en estado "${status}".` };
}

/** ¿client_admin puede "Cerrar y enviar a Sheina"? */
export function canBeClosedByClient(status: OrderStatus): InvariantResult {
  if (STATUSES_OPEN_FOR_LOAD.includes(status)) return { ok: true };
  return {
    ok: false,
    reason: `El pedido ya está en estado "${status}" — no se puede volver a cerrar.`,
  };
}

/** ¿Sheina puede aprobar? */
export function canBeApprovedBySheina(status: OrderStatus): InvariantResult {
  if (status === "awaiting_confirmation") return { ok: true };
  return {
    ok: false,
    reason: `Solo se aprueba un pedido en "awaiting_confirmation". Estado actual: "${status}".`,
  };
}

/** ¿Sheina puede devolver? */
export function canBeReturnedBySheina(status: OrderStatus): InvariantResult {
  if (status === "awaiting_confirmation") return { ok: true };
  return {
    ok: false,
    reason: `Solo se devuelve desde "awaiting_confirmation". Estado actual: "${status}".`,
  };
}

/** ¿Sheina puede mandar a producción? */
export function canBeSentToProduction(status: OrderStatus): InvariantResult {
  if (status === "confirmed") return { ok: true };
  return {
    ok: false,
    reason: `Solo se envía a producción un pedido en "confirmed". Estado actual: "${status}".`,
  };
}

/** ¿el form_token debe estar activo? */
export function shouldTokenBeActive(status: OrderStatus): boolean {
  return STATUSES_OPEN_FOR_LOAD.includes(status);
}

export function isTerminal(status: OrderStatus): boolean {
  return STATUSES_TERMINAL.includes(status);
}
