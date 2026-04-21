import type { OrderFormToken } from "./database";

export interface OrderFormTokenWithStats extends OrderFormToken {
  section_count: number;
  participant_count: number;
  submitted_count: number;
}

export interface TokenValidationResult {
  isValid: boolean;
  errorReason?: "expired" | "revoked" | "max_uses_reached" | "not_found";
  token?: OrderFormToken;
}

export interface CreateOrderFormTokenParams {
  organizationId: string;
  menuId: string;
  validUntil: Date;
  maxUses?: number;
  sectionNames: string[];
}
