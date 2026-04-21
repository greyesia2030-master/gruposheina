import type { OrderSection } from "./database";

export interface OrderSectionWithParticipants extends OrderSection {
  participant_count: number;
  submitted_count: number;
}

export interface SectionProgress {
  section_id: string;
  name: string;
  total_quantity: number;
  is_closed: boolean;
  participant_count: number;
}
