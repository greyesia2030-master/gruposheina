import type { OrderParticipant, OrderLine } from "./database";

export interface OrderParticipantWithLines extends OrderParticipant {
  lines: OrderLine[];
}

export interface ParticipantCartUpdate {
  menuItemId: string;
  dayOfWeek: number;
  quantity: number;
}

export interface RegisterParticipantParams {
  token: string;
  sectionId: string;
  displayName: string;
}
