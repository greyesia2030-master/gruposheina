"use server";

import type { OrderParticipant } from "@/lib/types/database";
import type { RegisterParticipantParams, ParticipantCartUpdate } from "@/lib/types/order-participant";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function registerParticipant(
  _params: RegisterParticipantParams
): Promise<ActionResult<OrderParticipant>> {
  throw new Error("Not implemented");
}

export async function updateParticipantCart(
  _participantId: string,
  _updates: ParticipantCartUpdate[]
): Promise<ActionResult<void>> {
  throw new Error("Not implemented");
}

export async function submitParticipantOrder(
  _participantId: string
): Promise<ActionResult<void>> {
  throw new Error("Not implemented");
}

export async function getParticipantsByOrder(
  _orderId: string
): Promise<ActionResult<OrderParticipant[]>> {
  throw new Error("Not implemented");
}
