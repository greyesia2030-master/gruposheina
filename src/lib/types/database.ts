// Enums
export type OrgStatus = "active" | "suspended" | "inactive";
export type UserRole = "superadmin" | "admin" | "operator" | "client_admin" | "client_user";
export type MenuStatus = "draft" | "published" | "archived";
export type MenuCategory = "principal" | "alternativa" | "sandwich" | "tarta" | "ensalada" | "veggie" | "especial";
export type OrderStatus = "draft" | "confirmed" | "in_production" | "delivered" | "cancelled";
export type OrderSource = "whatsapp_excel" | "whatsapp_bot" | "web_form" | "phone" | "subscription";
export type PaymentStatus = "pending" | "partial" | "paid" | "overdue";
export type EventType = "created" | "line_added" | "line_modified" | "line_removed" | "confirmed" | "override" | "cancelled" | "delivered";
export type ActorRole = "client" | "admin" | "system" | "bot";
export type MovementType = "purchase" | "production_consumption" | "waste" | "adjustment_pos" | "adjustment_neg" | "return";
export type InvCategory = "carnes" | "lacteos" | "verduras" | "secos" | "condimentos" | "envases" | "otros";

// Table row types
export interface Organization {
  id: string;
  name: string;
  cuit: string;
  contact_phone: string;
  cutoff_time: string; // HH:MM
  cutoff_days_before: number;
  departments: string[];
  status: OrgStatus;
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
  status: OrderStatus;
  source: OrderSource;
  total_units: number;
  total_amount: number;
  payment_status: PaymentStatus;
  confirmed_at: string | null;
  confirmed_by: string | null;
  original_file_url: string | null;
  ai_parsing_log: Record<string, unknown> | null;
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
  created_at: string;
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
    };
  };
}
