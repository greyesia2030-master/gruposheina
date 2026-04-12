-- 001: Extensiones y Enums
-- Sistema de Gestión de Viandas — Grupo Sheina

-- Extensión para generar UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===== ENUMS =====

-- Estado de la organización cliente
CREATE TYPE org_status AS ENUM ('active', 'suspended', 'inactive');

-- Roles de usuario en el sistema
CREATE TYPE user_role AS ENUM ('superadmin', 'admin', 'operator', 'client_admin', 'client_user');

-- Estado del menú semanal
CREATE TYPE menu_status AS ENUM ('draft', 'published', 'archived');

-- Categorías de opciones de menú
CREATE TYPE menu_category AS ENUM (
  'principal', 'alternativa', 'sandwich', 'tarta', 'ensalada', 'veggie', 'especial'
);

-- Estado del pedido (máquina de estados)
CREATE TYPE order_status AS ENUM ('draft', 'confirmed', 'in_production', 'delivered', 'cancelled');

-- Origen del pedido
CREATE TYPE order_source AS ENUM ('whatsapp_excel', 'whatsapp_bot', 'web_form', 'phone', 'subscription');

-- Estado de pago
CREATE TYPE payment_status AS ENUM ('pending', 'partial', 'paid', 'overdue');

-- Tipos de evento de auditoría
CREATE TYPE event_type AS ENUM (
  'created', 'line_added', 'line_modified', 'line_removed',
  'confirmed', 'override', 'cancelled', 'delivered'
);

-- Rol del actor que genera el evento
CREATE TYPE actor_role AS ENUM ('client', 'admin', 'system', 'bot');

-- Tipo de movimiento de inventario
CREATE TYPE movement_type AS ENUM (
  'purchase', 'production_consumption', 'waste',
  'adjustment_pos', 'adjustment_neg', 'return'
);

-- Categoría de insumo
CREATE TYPE inv_category AS ENUM (
  'carnes', 'lacteos', 'verduras', 'secos', 'condimentos', 'envases', 'otros'
);
