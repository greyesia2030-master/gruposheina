import type {
  Communication,
  CommunicationChannel,
  CommunicationDirection,
  CommunicationStatus,
  CommunicationCategory,
} from "./database";

export interface CommunicationWithRelations extends Communication {
  organization_name: string | null;
  thread_subject: string | null;
  sent_by_name: string | null;
}

export interface CommFilters {
  orgId?: string;
  channel?: CommunicationChannel;
  direction?: CommunicationDirection;
  status?: CommunicationStatus;
  category?: CommunicationCategory;
  dateFrom?: string;
  dateTo?: string;
}

export const CHANNEL_LABELS: Record<CommunicationChannel, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  sms: "SMS",
  web_note: "Nota interna",
  phone_call_note: "Llamada",
};

export const CHANNEL_ICONS: Record<CommunicationChannel, string> = {
  whatsapp: "message-circle",
  email: "mail",
  sms: "message-square",
  web_note: "file-text",
  phone_call_note: "phone",
};

export const COMM_STATUS_LABELS: Record<CommunicationStatus, string> = {
  pending: "Pendiente",
  sending: "Enviando",
  sent: "Enviado",
  delivered: "Entregado",
  read: "Leído",
  failed: "Fallido",
  ai_suggested: "Sugerido por IA",
  ai_sent: "Enviado por IA",
  human_approved: "Aprobado manualmente",
};

export const CATEGORY_LABELS: Record<CommunicationCategory, string> = {
  pedido_confirmacion: "Confirmación de pedido",
  pedido_modificacion: "Modificación de pedido",
  facturacion: "Facturación",
  soporte: "Soporte",
  recordatorio_pago: "Recordatorio de pago",
  entrega_notificacion: "Notificación de entrega",
  otro: "Otro",
};
