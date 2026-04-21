"use server";

// WARN: uses service_role — all calls must validate token ownership before mutating

import type { OrderFormToken, OrderSection, OrderParticipant, MenuItem } from "@/lib/types/database";
import type { OrderParticipantWithLines } from "@/lib/types/order-participant";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function resolveFormToken(
  _token: string
): Promise<ActionResult<{ formToken: OrderFormToken; sections: OrderSection[] }>> {
  throw new Error("Not implemented");
}

export async function joinSection(
  _token: string,
  _sectionId: string,
  _displayName: string
): Promise<ActionResult<OrderParticipant>> {
  throw new Error("Not implemented");
}

export async function getMenuItemsForToken(
  _token: string
): Promise<ActionResult<MenuItem[]>> {
  throw new Error("Not implemented");
}

export async function getParticipantCart(
  _accessToken: string
): Promise<ActionResult<OrderParticipantWithLines>> {
  throw new Error("Not implemented");
}

export async function upsertCartLine(
  _accessToken: string,
  _menuItemId: string,
  _dayOfWeek: number,
  _quantity: number
): Promise<ActionResult<void>> {
  throw new Error("Not implemented");
}

export async function submitCart(
  _accessToken: string
): Promise<ActionResult<void>> {
  throw new Error("Not implemented");
}
