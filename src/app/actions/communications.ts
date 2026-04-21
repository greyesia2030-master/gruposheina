"use server";

import type { Communication, CommunicationThread, CommunicationChannel, CommunicationCategory } from "@/lib/types/database";
import type { CommFilters } from "@/lib/types/communication";
import type { InboxFilters } from "@/lib/types/communication-thread";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function sendCommunication(
  _organizationId: string,
  _channel: CommunicationChannel,
  _category: CommunicationCategory,
  _recipientIdentifier: string,
  _body: string,
  _options?: {
    subject?: string;
    threadId?: string;
    orderId?: string;
    templateId?: string;
  }
): Promise<ActionResult<Communication>> {
  throw new Error("Not implemented");
}

export async function getCommunications(
  _filters: CommFilters
): Promise<ActionResult<Communication[]>> {
  throw new Error("Not implemented");
}

export async function getThreads(
  _filters: InboxFilters
): Promise<ActionResult<CommunicationThread[]>> {
  throw new Error("Not implemented");
}

export async function updateThreadStatus(
  _threadId: string,
  _status: CommunicationThread["status"],
  _assignedTo?: string
): Promise<ActionResult<void>> {
  throw new Error("Not implemented");
}

export async function markThreadRead(
  _threadId: string
): Promise<ActionResult<void>> {
  throw new Error("Not implemented");
}
