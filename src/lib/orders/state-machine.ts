import { createSupabaseAdmin } from '@/lib/supabase/server';
import { createOrderEvent } from './events';
import type { Database } from '@/lib/types/database';

type OrderStatus = Database['public']['Enums']['order_status'];
type UserRole = Database['public']['Enums']['user_role'];
type ActorRole = Database['public']['Enums']['actor_role'];

interface Transition {
  from: OrderStatus;
  to: OrderStatus;
  requiredRoles?: UserRole[];
  requiresCutoff?: boolean; // true = solo permitido si está dentro de corte (o es admin)
}

const TRANSITIONS: Transition[] = [
  { from: 'draft',                  to: 'confirmed' },
  { from: 'awaiting_confirmation',  to: 'confirmed' },
  { from: 'partially_filled',       to: 'confirmed' },
  { from: 'confirmed',              to: 'in_production', requiredRoles: ['superadmin', 'admin', 'operator'] },
  { from: 'in_production',          to: 'delivered',     requiredRoles: ['superadmin', 'admin', 'operator'] },
  { from: 'draft',                  to: 'cancelled' },
  { from: 'awaiting_confirmation',  to: 'cancelled' },
  { from: 'partially_filled',       to: 'cancelled' },
  { from: 'confirmed',              to: 'cancelled', requiresCutoff: true },
  { from: 'in_production',          to: 'cancelled', requiredRoles: ['superadmin', 'admin'] },
  { from: 'awaiting_confirmation',  to: 'draft',    requiredRoles: ['superadmin', 'admin'] },
];

/**
 * Obtiene las transiciones permitidas para un pedido dado su estado actual.
 */
export function getAvailableTransitions(
  currentStatus: OrderStatus,
  userRole: UserRole,
  isWithinCutoff: boolean
): OrderStatus[] {
  const isAdmin = ['superadmin', 'admin', 'operator'].includes(userRole);

  return TRANSITIONS
    .filter((t) => {
      if (t.from !== currentStatus) return false;
      if (t.requiredRoles && !t.requiredRoles.includes(userRole)) return false;
      // Si requiere corte y está fuera de corte, solo admin puede
      if (t.requiresCutoff && !isWithinCutoff && !isAdmin) return false;
      return true;
    })
    .map((t) => t.to);
}

/**
 * Ejecuta una transición de estado si es válida.
 */
export async function transitionOrder(
  orderId: string,
  newStatus: OrderStatus,
  actorId: string,
  actorRole: ActorRole,
  reason?: string
) {
  const supabase = await createSupabaseAdmin();

  // Obtener estado actual
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('status')
    .eq('id', orderId)
    .single();

  if (fetchError || !order) {
    throw new Error('Pedido no encontrado');
  }

  // Verificar transición válida
  const validTransition = TRANSITIONS.find(
    (t) => t.from === order.status && t.to === newStatus
  );

  if (!validTransition) {
    throw new Error(`Transición no permitida: ${order.status} → ${newStatus}`);
  }

  // Actualizar estado
  const updateData: Record<string, unknown> = { status: newStatus };
  if (newStatus === 'confirmed') {
    updateData.confirmed_at = new Date().toISOString();
    updateData.confirmed_by = actorId;

    // Calcular total_amount = total_units * price_per_unit de la organización
    try {
      const { data: orderFull } = await supabase
        .from('orders')
        .select('total_units, organization:organizations(price_per_unit)')
        .eq('id', orderId)
        .single();
      if (orderFull) {
        const org = orderFull.organization as unknown as { price_per_unit: number } | null;
        const pricePerUnit = org?.price_per_unit ?? 0;
        if (pricePerUnit > 0) {
          updateData.total_amount = orderFull.total_units * pricePerUnit;
        }
      }
    } catch { /* no bloquear la transición si falla el cálculo */ }
  }
  if (newStatus === 'delivered') {
    updateData.delivered_at = new Date().toISOString();
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', orderId);

  if (updateError) {
    throw new Error(`Error al actualizar pedido: ${updateError.message}`);
  }

  // Determinar tipo de evento según la transición
  const eventTypeMap: Record<string, Database['public']['Enums']['event_type']> = {
    'confirmed':     'confirmed',
    'cancelled':     'cancelled',
    'delivered':     'delivered',
    'in_production': 'confirmed', // el enum no tiene un valor dedicado para "a producción"
  };

  await createOrderEvent({
    orderId,
    eventType: eventTypeMap[newStatus] ?? 'confirmed',
    actorId,
    actorRole,
    payload: reason ? { reason, newStatus } : { newStatus },
  });

  return { orderId, previousStatus: order.status, newStatus };
}
