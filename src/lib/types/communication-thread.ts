import type {
  CommunicationThread,
  ThreadStatus,
  CommunicationCategory,
} from "./database";
import type { CommunicationWithRelations } from "./communication";

export interface ThreadWithMessages extends CommunicationThread {
  messages: CommunicationWithRelations[];
  organization_name: string | null;
  assigned_to_name: string | null;
}

export interface InboxFilters {
  status?: ThreadStatus;
  category?: CommunicationCategory;
  assignedTo?: string;
  orgId?: string;
}

export const THREAD_STATUS_LABELS: Record<ThreadStatus, string> = {
  open: "Abierto",
  waiting_client: "Esperando cliente",
  waiting_admin: "Esperando admin",
  resolved: "Resuelto",
  archived: "Archivado",
};

export const THREAD_STATUS_COLORS: Record<ThreadStatus, string> = {
  open: "bg-blue-100 text-blue-700",
  waiting_client: "bg-amber-100 text-amber-700",
  waiting_admin: "bg-orange-100 text-orange-700",
  resolved: "bg-green-100 text-green-700",
  archived: "bg-gray-100 text-gray-500",
};
