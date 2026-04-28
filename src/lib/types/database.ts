// Enums — original
export type OrgStatus = "active" | "suspended" | "inactive";
export type UserRole = "superadmin" | "admin" | "operator" | "client_admin" | "client_user" | "kitchen" | "warehouse";
export type MenuStatus = "draft" | "published" | "archived";
export type MenuCategory = "principal" | "alternativa" | "sandwich" | "tarta" | "ensalada" | "veggie" | "especial";
export type OrderStatus = "draft" | "confirmed" | "in_production" | "delivered" | "cancelled" | "partially_filled" | "awaiting_confirmation";
export type OrderSource = "whatsapp_excel" | "whatsapp_bot" | "web_form" | "phone" | "subscription" | "web_form_shared";
export type PaymentStatus = "pending" | "partial" | "paid" | "overdue";
export type EventType = "created" | "line_added" | "line_modified" | "line_removed" | "confirmed" | "override" | "cancelled" | "delivered";
export type ActorRole = "client" | "admin" | "system" | "bot";
export type MovementType = "purchase" | "production_consumption" | "waste" | "adjustment_pos" | "adjustment_neg" | "return" | "transfer_out" | "transfer_in" | "cook_consumption" | "waste_pending" | "waste_approved";
export type InvCategory = "carnes" | "lacteos" | "verduras" | "secos" | "condimentos" | "envases" | "otros";

// Enums — FoodSync v2
export type SiteType = "warehouse" | "kitchen" | "delivery_point" | "distribution_hub";
export type ProductionTicketStatus = "pending" | "in_progress" | "paused" | "ready" | "blocked" | "cancelled";
export type CommunicationChannel = "whatsapp" | "email" | "sms" | "web_note" | "phone_call_note";
export type CommunicationDirection = "inbound" | "outbound";
export type CommunicationStatus = "pending" | "sending" | "sent" | "delivered" | "read" | "failed" | "ai_suggested" | "ai_sent" | "human_approved";
export type CommunicationCategory = "pedido_confirmacion" | "pedido_modificacion" | "facturacion" | "soporte" | "recordatorio_pago" | "entrega_notificacion" | "otro";
export type ThreadStatus = "open" | "waiting_client" | "waiting_admin" | "resolved" | "archived";

// Table row types — original (updated with new columns)
export interface Organization {
  id: string;
  name: string;
  cuit: string | null;
  contact_phone: string | null;
  email: string | null;
  delivery_address: string | null;
  cutoff_time: string; // HH:MM or HH:MM:SS (postgres time)
  cutoff_days_before: number;
  timezone: string; // IANA timezone, e.g. 'America/Argentina/Buenos_Aires'
  departments: string[];
  authorized_phones: string[];
  price_per_unit: number;
  status: OrgStatus;
  // FoodSync v2 additions
  business_unit_id: string | null;
  member_id: string | null;
  prefers_web_form: boolean;
  primary_contact_email: string | null;
  secondary_emails: string[];
  notification_preferences: Record<string, boolean> | null;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  auth_id: string;
  organization_id: string | null;
  role: UserRole;
  full_name: string;
  phone: string | null;
  email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WeeklyMenu {
  id: string;
  week_start: string;
  week_end: string;
  week_number: number;
  status: MenuStatus;
  created_at: string;
  updated_at: string;
}

export interface MenuItem {
  id: string;
  menu_id: string;
  day_of_week: number; // 1-5
  option_code: string;
  recipe_version_id: string | null;
  category: MenuCategory;
  display_name: string;
  is_available: boolean;
  // FoodSync v2 additions
  photo_url: string | null;
  calories_kcal: number | null;
  weight_grams: number | null;
  allergens: unknown[] | null;
  unit_price: number | null;
  is_published_to_form: boolean;
  description: string | null;
  created_at: string;
}

export interface Recipe {
  id: string;
  name: string;
  category: MenuCategory;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecipeVersion {
  id: string;
  recipe_id: string;
  version: number;
  portions_yield: number;
  preparation_notes: string | null;
  cost_per_portion: number;
  is_current: boolean;
  created_at: string;
}

export interface RecipeIngredient {
  id: string;
  recipe_version_id: string;
  inventory_item_id: string;
  quantity: number;
  unit: string;
  substitute_item_id: string | null;
}

export interface Order {
  id: string;
  organization_id: string;
  menu_id: string | null;
  week_label: string;
  order_code: string;
  status: OrderStatus;
  source: OrderSource;
  total_units: number;
  total_amount: number;
  payment_status: PaymentStatus;
  confirmed_at: string | null;
  confirmed_by: string | null;
  delivered_at: string | null;
  original_file_url: string | null;
  ai_parsing_log: Record<string, unknown> | null;
  // FoodSync v2 additions
  creation_mode: string | null;
  form_token_id: string | null;
  custom_cutoff_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderLine {
  id: string;
  order_id: string;
  menu_item_id: string;
  day_of_week: number;
  department: string;
  quantity: number;
  unit_price: number;
  recipe_version_id: string | null;
  option_code: string;
  display_name: string;
  // FoodSync v2 additions
  section_id: string | null;
  participant_id: string | null;
  // D.6 admin override
  is_admin_override: boolean;
  admin_override_by: string | null;
  admin_override_reason: string | null;
  admin_override_at: string | null;
}

export interface OrderEvent {
  id: string;
  order_id: string;
  event_type: EventType;
  actor_id: string | null;
  actor_role: ActorRole;
  payload: Record<string, unknown> | null;
  is_post_cutoff: boolean;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: InvCategory;
  unit: string;
  current_stock: number;
  min_stock: number;
  cost_per_unit: number;
  supplier: string | null;
  is_active: boolean;
  // FoodSync v2 additions
  requires_lot_tracking: boolean;
  default_site_id: string | null;
  default_unit: string | null;
  min_stock_alert: number;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  item_id: string;
  movement_type: MovementType;
  quantity: number;
  unit_cost: number | null;
  reference_type: string | null;
  reference_id: string | null;
  reason: string | null;
  actor_id: string | null;
  stock_after: number;
  // FoodSync v2 additions
  lot_id: string | null;
  site_id: string | null;
  unit: string | null;
  created_at: string;
}

export interface ConversationLog {
  id: string;
  phone: string;
  direction: "in" | "out";
  message_type: string | null;
  body: string | null;
  media_url: string | null;
  order_id: string | null;
  conv_state: string | null;
  created_at: string;
}

export interface OrderToken {
  id: string;
  order_id: string;
  token: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

// Table row types — FoodSync v2 new tables
export interface BusinessUnit {
  id: string;
  code: string;
  name: string;
  description: string | null;
  next_correlative: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Site {
  id: string;
  organization_id: string;
  name: string;
  site_type: SiteType;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  contact_phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  organization_id: string;
  name: string;
  cuit: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  payment_terms: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryLot {
  id: string;
  item_id: string;
  site_id: string;
  supplier_id: string | null;
  lot_code: string;
  quantity_initial: number;
  quantity_remaining: number;
  unit: string;
  cost_per_unit: number | null;
  received_at: string;
  expires_at: string | null;
  received_by: string | null;
  received_photo_url: string | null;
  notes: string | null;
  is_depleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductionLotConsumption {
  id: string;
  ticket_id: string;
  lot_id: string;
  quantity_consumed: number;
  unit: string;
  consumed_at: string;
  recorded_by: string | null;
}

export interface ProductionTicket {
  id: string;
  order_id: string;
  menu_item_id: string;
  recipe_version_id: string | null;
  cook_site_id: string | null;
  production_date: string;
  quantity_target: number;
  quantity_produced: number;
  quantity_wasted: number;
  status: ProductionTicketStatus;
  blocked_reason: string | null;
  assigned_cook_id: string | null;
  priority: number;
  started_at: string | null;
  ready_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderFormToken {
  id: string;
  order_id: string | null;
  organization_id: string;
  menu_id: string | null;
  token: string;
  valid_from: string;
  valid_until: string;
  max_uses: number;
  used_count: number;
  created_by: string;
  is_active: boolean;
  require_contact: boolean;
  created_at: string;
}

export interface OrderSection {
  id: string;
  order_id: string;
  name: string;
  display_order: number;
  closed_at: string | null;
  closed_by_participant_id: string | null;
  total_quantity: number;
  created_at: string;
}

export interface ClientDepartment {
  id: string;
  organization_id: string;
  name: string;
  expected_participants: number;
  authorized_emails: string[];
  created_at: string;
  updated_at: string;
}

export interface OrderParticipant {
  id: string;
  order_id: string;
  section_id: string | null;
  display_name: string;
  access_token: string;
  form_token_id: string | null;
  first_seen_at: string;
  last_activity_at: string;
  submitted_at: string | null;
  total_quantity: number;
  notes: string | null;
  member_contact: string | null;
  contact_type: "email" | "phone" | "none";
  is_authorized: boolean | null;
}

export interface CommunicationTemplate {
  id: string;
  name: string;
  channel: CommunicationChannel;
  category: CommunicationCategory;
  subject: string | null;
  body: string;
  variables: unknown[];
  business_unit_id: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommunicationThread {
  id: string;
  organization_id: string | null;
  subject: string | null;
  category: CommunicationCategory;
  order_id: string | null;
  status: ThreadStatus;
  assigned_to: string | null;
  last_message_at: string;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export interface Communication {
  id: string;
  organization_id: string | null;
  thread_id: string | null;
  order_id: string | null;
  template_id: string | null;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  category: CommunicationCategory;
  external_message_id: string | null;
  external_thread_id: string | null;
  subject: string | null;
  body: string;
  body_html: string | null;
  sender_identifier: string | null;
  recipient_identifier: string | null;
  sent_by_user_id: string | null;
  status: CommunicationStatus;
  status_detail: string | null;
  attachments: unknown[];
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  ai_generated: boolean;
  ai_confidence: number | null;
  ai_review_status: string | null;
  ai_model_used: string | null;
  created_at: string;
  updated_at: string;
}

// Supabase Database type for client typing
export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: Organization;
        Insert: Omit<Organization, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Organization, "id" | "created_at" | "updated_at">>;
      };
      users: {
        Row: User;
        Insert: Omit<User, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<User, "id" | "created_at" | "updated_at">>;
      };
      weekly_menus: {
        Row: WeeklyMenu;
        Insert: Omit<WeeklyMenu, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<WeeklyMenu, "id" | "created_at" | "updated_at">>;
      };
      menu_items: {
        Row: MenuItem;
        Insert: Omit<MenuItem, "id" | "created_at">;
        Update: Partial<Omit<MenuItem, "id" | "created_at">>;
      };
      recipes: {
        Row: Recipe;
        Insert: Omit<Recipe, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Recipe, "id" | "created_at" | "updated_at">>;
      };
      recipe_versions: {
        Row: RecipeVersion;
        Insert: Omit<RecipeVersion, "id" | "created_at">;
        Update: Partial<Omit<RecipeVersion, "id" | "created_at">>;
      };
      recipe_ingredients: {
        Row: RecipeIngredient;
        Insert: Omit<RecipeIngredient, "id">;
        Update: Partial<Omit<RecipeIngredient, "id">>;
      };
      orders: {
        Row: Order;
        Insert: Omit<Order, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Order, "id" | "created_at" | "updated_at">>;
      };
      order_lines: {
        Row: OrderLine;
        Insert: Omit<OrderLine, "id">;
        Update: Partial<Omit<OrderLine, "id">>;
      };
      order_events: {
        Row: OrderEvent;
        Insert: Omit<OrderEvent, "id" | "created_at">;
        Update: never;
      };
      inventory_items: {
        Row: InventoryItem;
        Insert: Omit<InventoryItem, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<InventoryItem, "id" | "created_at" | "updated_at">>;
      };
      inventory_movements: {
        Row: InventoryMovement;
        Insert: Omit<InventoryMovement, "id" | "created_at">;
        Update: never;
      };
      conversation_logs: {
        Row: ConversationLog;
        Insert: Omit<ConversationLog, "id" | "created_at">;
        Update: never;
      };
      order_tokens: {
        Row: OrderToken;
        Insert: Omit<OrderToken, "id" | "created_at">;
        Update: Partial<Pick<OrderToken, "used_at">>;
      };
      business_units: {
        Row: BusinessUnit;
        Insert: Omit<BusinessUnit, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<BusinessUnit, "id" | "created_at" | "updated_at">>;
      };
      sites: {
        Row: Site;
        Insert: Omit<Site, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Site, "id" | "created_at" | "updated_at">>;
      };
      suppliers: {
        Row: Supplier;
        Insert: Omit<Supplier, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Supplier, "id" | "created_at" | "updated_at">>;
      };
      inventory_lots: {
        Row: InventoryLot;
        Insert: Omit<InventoryLot, "id" | "is_depleted" | "created_at" | "updated_at">;
        Update: Partial<Omit<InventoryLot, "id" | "is_depleted" | "created_at" | "updated_at">>;
      };
      production_lot_consumption: {
        Row: ProductionLotConsumption;
        Insert: Omit<ProductionLotConsumption, "id">;
        Update: never;
      };
      production_tickets: {
        Row: ProductionTicket;
        Insert: Omit<ProductionTicket, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<ProductionTicket, "id" | "created_at" | "updated_at">>;
      };
      order_form_tokens: {
        Row: OrderFormToken;
        Insert: Omit<OrderFormToken, "id" | "created_at">;
        Update: Partial<Omit<OrderFormToken, "id" | "created_at">>;
      };
      order_sections: {
        Row: OrderSection;
        Insert: Omit<OrderSection, "id" | "created_at">;
        Update: Partial<Omit<OrderSection, "id" | "created_at">>;
      };
      order_participants: {
        Row: OrderParticipant;
        Insert: Omit<OrderParticipant, "id">;
        Update: Partial<Omit<OrderParticipant, "id">>;
      };
      communication_templates: {
        Row: CommunicationTemplate;
        Insert: Omit<CommunicationTemplate, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<CommunicationTemplate, "id" | "created_at" | "updated_at">>;
      };
      communication_threads: {
        Row: CommunicationThread;
        Insert: Omit<CommunicationThread, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<CommunicationThread, "id" | "created_at" | "updated_at">>;
      };
      communications: {
        Row: Communication;
        Insert: Omit<Communication, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Communication, "id" | "created_at" | "updated_at">>;
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      org_status: OrgStatus;
      user_role: UserRole;
      menu_status: MenuStatus;
      menu_category: MenuCategory;
      order_status: OrderStatus;
      order_source: OrderSource;
      payment_status: PaymentStatus;
      event_type: EventType;
      actor_role: ActorRole;
      movement_type: MovementType;
      inv_category: InvCategory;
      site_type: SiteType;
      production_ticket_status: ProductionTicketStatus;
      communication_channel: CommunicationChannel;
      communication_direction: CommunicationDirection;
      communication_status: CommunicationStatus;
      communication_category: CommunicationCategory;
      thread_status: ThreadStatus;
    };
  };
}
