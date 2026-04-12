import { createSupabaseAdmin } from '@/lib/supabase/server';
import type { Database } from '@/lib/types/database';

type EventType = Database['public']['Tables']['order_events']['Insert']['event_type'];
type ActorRole = Database['public']['Tables']['order_events']['Insert']['actor_role'];

interface CreateEventInput {
  orderId: string;
  eventType: EventType;
  actorId: string | null;
  actorRole: ActorRole;
  payload?: Record<string, unknown>;
  isPostCutoff?: boolean;
}

/**
 * Crea un evento de auditoría para un pedido (append-only).
 */
export async function createOrderEvent(input: CreateEventInput) {
  const supabase = await createSupabaseAdmin();

  const { data, error } = await supabase
    .from('order_events')
    .insert({
      order_id: input.orderId,
      event_type: input.eventType,
      actor_id: input.actorId,
      actor_role: input.actorRole,
      payload: input.payload ?? {},
      is_post_cutoff: input.isPostCutoff ?? false,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creando evento de pedido:', error);
    throw new Error(`No se pudo registrar el evento: ${error.message}`);
  }

  return data;
}
