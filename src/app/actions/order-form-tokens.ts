"use server";

import type { OrderFormToken } from "@/lib/types/database";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function createOrderFormToken(
  _organizationId: string,
  _menuId: string,
  _orderId: string | null,
  _validUntil: string,
  _maxUses?: number
): Promise<ActionResult<OrderFormToken>> {
  throw new Error("Not implemented");
}

export async function deactivateOrderFormToken(
  _tokenId: string
): Promise<ActionResult<void>> {
  throw new Error("Not implemented");
}

export async function getOrderFormTokens(
  _organizationId: string
): Promise<ActionResult<OrderFormToken[]>> {
  throw new Error("Not implemented");
}

export async function validateOrderFormToken(
  _token: string
): Promise<ActionResult<OrderFormToken>> {
  throw new Error("Not implemented");
}
