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
  { from: 'draft', to: 'confirmed' },
  { from: 'confirmed', to: 'in_production', requiredRoles: ['superadmin', 'admin', 'operator'] },
  { from: 'in_production', to: 'delivered', requiredRoles: ['superadmin', 'admin', 'operator'] },
  { from: 'draft', to: 'cancelled' },
  { from: 'confirmed', to: 'cancelled', requiresCutoff: true },
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
