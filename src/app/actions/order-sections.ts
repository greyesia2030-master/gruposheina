"use server";

import type { OrderSection } from "@/lib/types/database";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function createOrderSection(
  _orderId: string,
  _name: string,
  _displayOrder?: number
): Promise<ActionResult<OrderSection>> {
  throw new Error("Not implemented");
}

export async function closeOrderSection(
  _sectionId: string,
  _closedByParticipantId: string
): Promise<ActionResult<void>> {
  throw new Error("Not implemented");
}

export async function getOrderSections(
  _orderId: string
): Promise<ActionResult<OrderSection[]>> {
  throw new Error("Not implemented");
}

export async function deleteOrderSection(
  _sectionId: string
): Promise<ActionResult<void>> {
  throw new Error("Not implemented");
}
