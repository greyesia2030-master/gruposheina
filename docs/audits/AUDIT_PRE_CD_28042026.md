# AUDIT PRE-CD — Inventario Estado Real
**Proyecto:** FoodSync ERP / Grupo Sheina  
**Propósito:** Baseline pre-Capa C+D — sección read-only, sin modificaciones al repo ni a la BD.

---

## 1. Metadatos del audit

| Campo | Valor |
|-------|-------|
| Fecha/hora de ejecución | 2026-04-28 22:38 ART |
| Branch | `main` |
| Commit de partida | `f2b1f6f` — feat(b2): loading skeletons, empty states y polish responsive |
| Commit push local | 1 commit adelante de `origin/main` (f2b1f6f no pusheado aún) |
| Tools disponibles | `git`, `bash/grep/find`, `npx tsc`, `npm run` |
| MCP Supabase | ❌ No disponible — todas las secciones de BD usan **fuente: archivos** |
| Fuente BD | Archivos `/supabase/migrations/*.sql` + `src/lib/types/database.ts` |
| Total commits en repo | 126 |
| Archivos `.ts/.tsx` en `src/` | 207 |
| Tiempo total invertido | ~25 min |

---

## 2. Migraciones aplicadas

⚠️ **Fuente: archivos, no BD.** Sin MCP Supabase no se puede consultar `supabase_migrations.schema_migrations`. Se listan los archivos presentes en `/supabase/migrations/`.

| # | Archivo | Descripción |
|---|---------|-------------|
| 001 | `001_extensions_and_enums.sql` | UUID extension + 11 enums core (org_status, user_role, menu_status, menu_category, order_status, order_source, payment_status, event_type, actor_role, movement_type, inv_category) |
| 002 | `002_tables.sql` | 12 tablas core + trigger `update_updated_at()` en 7 tablas |
| 003 | `003_indexes.sql` | 29 índices de performance sobre todas las tablas core |
| 004 | `004_rls_policies.sql` | RLS habilitado en 12 tablas + helper functions (get_current_user_role, get_current_user_org_id, is_admin) + 24 policies |
| 005 | `005_functions.sql` | fn_update_stock(), fn_calculate_recipe_cost(), fn_check_cutoff() + trigger trg_recalculate_recipe_cost |
| 006 | `006_seed_data.sql` | Demo: 1 organización, 2 usuarios, 15 insumos, 5 recetas, 1 menú publicado con 35 items |
| 007 | `007_auth_user_setup.sql` | Documentación (SQL comentado) para vincular auth.users a public.users |
| 008 | `008_private_storage.sql` | Bucket 'order-files' privado + 3 policies (service_role only) |
| 009 | `009_fix_rls.sql` | Hardening: prevent_user_privilege_escalation() trigger + fix RLS orders/order_events |
| 010 | `010_fix_auth_user.sql` | Vincula auth real UUID 07fd7773-fb06-4474-aeb3-b7bde1009053 + re-crea FKs |
| 011 | `011_reseed_data.sql` | +5 insumos, +2 recetas (Wok pollo, Milanesa berenjena), nuevo menú con recipe_version_id |
| 012 | `012_mvp_fix.sql` | Vincula auth_id real, 2do menú publicado (14-18 Abr 2026) |
| 013 | `013_conversation_and_permissions.sql` | +conversation_logs, +order_tokens (WA auth), authorized_phones[] en organizations |
| 014 | `014_price_and_delivery.sql` | +price_per_unit en organizations, +delivered_at en orders |
| 015 | `015_org_contact_fields.sql` | +email, +delivery_address en organizations |
| 016 | `016_message_sid.sql` | +message_sid en conversation_logs (dedup Twilio) + índice condicional |
| 017 | `017_foodsync_enums_extension.sql` | +kitchen/warehouse a user_role; +transfer_out/in/cook_consumption/waste_pending/waste_approved a movement_type; +partially_filled/awaiting_confirmation a order_status; +7 nuevos enums (site_type, production_ticket_status, communication_channel/direction/status/category, thread_status) |
| 018 | `018_foodsync_business_units.sql` | +business_units table, fn_generate_member_id(), +business_unit_id/member_id en organizations |
| 019 | `019_foodsync_core_tables.sql` | +sites, +suppliers, +inventory_lots, +production_tickets, +production_lot_consumption |
| 020 | `020_foodsync_shared_form_tables.sql` | +order_form_tokens, +order_sections, +order_participants |
| 021 | `021_foodsync_messaging_hub.sql` | +communication_templates, +communication_threads, +communications; trigger fn_update_thread_on_message |
| 022 | `022_foodsync_extend_existing_tables.sql` | Extiende 5 tablas: organizations (+web_form prefs, emails, notifications JSONB), inventory_items (+lot tracking, site defaults, alerts), inventory_movements (+lot_id, site_id, unit), menu_items (+photos, nutrition, allergens, pricing), orders (+creation_mode, form_token_id), order_lines (+section_id, participant_id) |
| 023 | `023_foodsync_views_and_functions.sql` | +v_item_stock_by_site view, fn_consume_from_lots(), fn_close_order_section(), fn_check_order_sections_closed(), trigger trg_check_sections_closed |
| 024 | `024_foodsync_rls_policies.sql` | RLS en 10 tablas nuevas + 26 policies (business_units, sites, suppliers, inventory_lots, production_tickets, production_lot_consumption, order_form_tokens, order_sections/participants, communications/threads, communication_templates) |
| 025 | `025_foodsync_reset_demo_and_seed.sql` | Borra data transaccional, asigna business_unit_id a orgs demo, crea sites Sheina (Almacén Central, Cocina Principal), supplier placeholder |
| 026 | `026_foodsync_communication_templates_seed.sql` | 11 templates de comunicación (WhatsApp + email) con variables de sustitución |

**Total archivos en disco:** 26

### Diferencias archivo ↔ BD real

⚠️ Sin MCP Supabase no es posible verificar qué corrió en la BD real. Sin embargo, el historial git indica schema aplicado **directamente en Supabase SQL Editor** sin archivo de migración correspondiente. Ver Sección 12 (Hallazgos) para lista completa.

---

## 3. Schema real

⚠️ **Fuente: archivos de migración + `src/lib/types/database.ts` — no consulta BD live.**

### 3.1 Tablas

| Tabla | Migración origen | Comentario |
|-------|-----------------|------------|
| `organizations` | 002 + ext 013/014/015/018/022 | Core — clientes PYME |
| `users` | 002 | Core — usuarios vinculados a auth |
| `weekly_menus` | 002 | Core — menús semanales |
| `menu_items` | 002 + ext 022 | Core — opciones diarias |
| `recipes` | 002 | Core — entidad lógica receta |
| `recipe_versions` | 002 | Core — versiones inmutables |
| `recipe_ingredients` | 002 | Core — ingredientes por versión |
| `orders` | 002 + ext 014/022 | Core — pedidos semanales |
| `order_lines` | 002 + ext 022 | Core — líneas de pedido |
| `order_events` | 002 | Core — audit log append-only |
| `inventory_items` | 002 + ext 022 | Core — insumos |
| `inventory_movements` | 002 + ext 022 | Core — movimientos append-only |
| `conversation_logs` | 013 | WA message history |
| `order_tokens` | 013 | WA auth tokens (7-day) |
| `business_units` | 018 | Unidades de negocio Sheina |
| `sites` | 019 | Almacenes / cocinas / puntos entrega |
| `suppliers` | 019 | Proveedores |
| `inventory_lots` | 019 | Lotes de inventario con vencimiento |
| `production_tickets` | 019 | Tickets de cocina |
| `production_lot_consumption` | 019 | Trazabilidad lote → ticket |
| `order_form_tokens` | 020 | Links compartidos (form web) |
| `order_sections` | 020 | Secciones de pedido (por depto) |
| `order_participants` | 020 | Participantes individuales |
| `communication_templates` | 021 | Templates WA/email |
| `communication_threads` | 021 | Hilos de conversación |
| `communications` | 021 | Mensajes individuales |
| `client_departments` | ⚠️ **Solo SQL Editor** | Deptos por cliente con authorized_emails |
| `user_notifications` | ⚠️ **Solo database.ts** | Notificaciones in-app (no migración encontrada) |
| `push_subscriptions` | ⚠️ **Solo código** | Suscripciones Web Push (no migración encontrada) |

**Total tablas en database.ts:** 26 tipadas + 3 sin migración = **29 tablas reales estimadas**

---

### 3.2 Columnas por tabla

Se documentan las columnas por fuente (migración SQL cuando disponible, database.ts como respaldo).

#### organizations

| Columna | Tipo | NOT NULL | Default |
|---------|------|----------|---------|
| id | UUID | ✅ | uuid_generate_v4() |
| name | TEXT | ✅ | — |
| cuit | TEXT | ❌ | — |
| contact_phone | TEXT | ❌ | — |
| email | TEXT | ❌ | — (añadido 015) |
| delivery_address | TEXT | ❌ | — (añadido 015) |
| cutoff_time | TIME | ✅ | '18:00' |
| cutoff_days_before | INTEGER | ✅ | 1 |
| timezone | TEXT | ❌ | — (**⚠️ en database.ts, no en migración**) |
| departments | JSONB | ✅ | '["adm","vtas","diet","log","otros"]' |
| authorized_phones | text[] | ✅ | '{}' (añadido 013) |
| price_per_unit | numeric(10,2) | ✅ | 0.00 (añadido 014) |
| status | org_status | ✅ | 'active' |
| business_unit_id | UUID | ❌ | — (añadido 018) |
| member_id | VARCHAR(20) | ❌ | — UNIQUE (añadido 018) |
| prefers_web_form | BOOLEAN | ❌ | true (añadido 022) |
| primary_contact_email | VARCHAR(150) | ❌ | — (añadido 022) |
| secondary_emails | TEXT[] | ❌ | '{}' (añadido 022) |
| notification_preferences | JSONB | ❌ | {...} (añadido 022) |
| created_at | TIMESTAMPTZ | ✅ | now() |
| updated_at | TIMESTAMPTZ | ✅ | now() |

#### users

| Columna | Tipo | NOT NULL | Default |
|---------|------|----------|---------|
| id | UUID | ✅ | uuid_generate_v4() |
| auth_id | UUID | ❌ | — UNIQUE REFERENCES auth.users |
| organization_id | UUID | ❌ | — |
| role | user_role | ✅ | 'client_user' |
| full_name | TEXT | ✅ | — |
| phone | TEXT | ❌ | — UNIQUE (constraint 013) |
| email | TEXT | ✅ | — |
| is_active | BOOLEAN | ✅ | true |
| created_at | TIMESTAMPTZ | ✅ | now() |
| updated_at | TIMESTAMPTZ | ✅ | now() |

#### weekly_menus

| Columna | Tipo | NOT NULL | Default |
|---------|------|----------|---------|
| id | UUID | ✅ | uuid_generate_v4() |
| week_start | DATE | ✅ | — |
| week_end | DATE | ✅ | — |
| week_number | INTEGER | ✅ | CHECK (1-53) |
| status | menu_status | ✅ | 'draft' |
| created_at | TIMESTAMPTZ | ✅ | now() |
| updated_at | TIMESTAMPTZ | ✅ | now() |

#### menu_items

| Columna | Tipo | NOT NULL | Default |
|---------|------|----------|---------|
| id | UUID | ✅ | uuid_generate_v4() |
| menu_id | UUID | ✅ | → weekly_menus CASCADE |
| day_of_week | INTEGER | ✅ | CHECK (1-5) |
| option_code | TEXT | ✅ | — |
| recipe_version_id | UUID | ❌ | — → recipe_versions |
| category | menu_category | ✅ | — |
| display_name | TEXT | ✅ | — |
| is_available | BOOLEAN | ✅ | true |
| photo_url | TEXT | ❌ | — (022) |
| calories_kcal | INTEGER | ❌ | — (022) |
| weight_grams | INTEGER | ❌ | — (022) |
| allergens | JSONB | ❌ | '[]' (022) |
| unit_price | DECIMAL(10,2) | ❌ | — (022) |
| is_published_to_form | BOOLEAN | ❌ | true (022) |
| description | TEXT | ❌ | — (022) |
| created_at | TIMESTAMPTZ | ✅ | now() |
| UNIQUE | (menu_id, day_of_week, option_code) | — | — |

#### recipes

| Columna | Tipo | NOT NULL | Default |
|---------|------|----------|---------|
| id | UUID | ✅ | uuid_generate_v4() |
| name | TEXT | ✅ | — |
| category | menu_category | ✅ | — |
| is_active | BOOLEAN | ✅ | true |
| created_at | TIMESTAMPTZ | ✅ | now() |
| updated_at | TIMESTAMPTZ | ✅ | now() |

#### recipe_versions

| Columna | Tipo | NOT NULL | Default |
|---------|------|----------|---------|
| id | UUID | ✅ | uuid_generate_v4() |
| recipe_id | UUID | ✅ | → recipes CASCADE |
| version | INTEGER | ✅ | CHECK (≥1) |
| portions_yield | INTEGER | ✅ | CHECK (>0) |
| preparation_notes | TEXT | ❌ | — |
| cost_per_portion | NUMERIC(10,2) | ✅ | 0 |
| is_current | BOOLEAN | ✅ | true |
| created_by | UUID | ❌ | → users |
| created_at | TIMESTAMPTZ | ✅ | now() |
| UNIQUE | (recipe_id, version) | — | — |

#### recipe_ingredients

| Columna | Tipo | NOT NULL | Default |
|---------|------|----------|---------|
| id | UUID | ✅ | uuid_generate_v4() |
| recipe_version_id | UUID | ✅ | → recipe_versions CASCADE |
| inventory_item_id | UUID | ✅ | → inventory_items |
| quantity | NUMERIC(10,3) | ✅ | CHECK (>0) |
| unit | TEXT | ✅ | — |
| substitute_item_id | UUID | ❌ | → inventory_items |
| created_at | TIMESTAMPTZ | ✅ | now() |

> ⚠️ Tiene DOS FKs hacia inventory_items (inventory_item_id + substitute_item_id), lo cual causa ambigüedad en PostgREST JOINs. Requiere queries separadas (workaround activo en código).

#### orders

| Columna | Tipo | NOT NULL | Default |
|---------|------|----------|---------|
| id | UUID | ✅ | uuid_generate_v4() |
| organization_id | UUID | ✅ | → organizations |
| menu_id | UUID | ❌ | → weekly_menus |
| week_label | TEXT | ✅ | — |
| order_code | TEXT | ❌ | — (**⚠️ en database.ts, no en migración**) |
| status | order_status | ✅ | 'draft' |
| source | order_source | ✅ | 'web_form' |
| total_units | INTEGER | ✅ | 0 |
| total_amount | NUMERIC(12,2) | ✅ | 0 |
| payment_status | payment_status | ✅ | 'pending' |
| confirmed_at | TIMESTAMPTZ | ❌ | — |
| confirmed_by | UUID | ❌ | → users |
| ready_for_delivery_at | TIMESTAMPTZ | ❌ | — (**⚠️ en database.ts, no en migración**) |
| dispatched_at | TIMESTAMPTZ | ❌ | — (**⚠️ en database.ts, no en migración**) |
| dispatched_by | UUID | ❌ | — (**⚠️ en database.ts, no en migración**) |
| delivered_at | TIMESTAMPTZ | ❌ | — (añadido 014) |
| delivered_by | UUID | ❌ | — (**⚠️ en database.ts, no en migración**) |
| original_file_url | TEXT | ❌ | — |
| ai_parsing_log | JSONB | ❌ | — |
| creation_mode | VARCHAR(30) | ❌ | 'whatsapp_excel' (022) |
| form_token_id | UUID | ❌ | → order_form_tokens (022) |
| custom_cutoff_at | TIMESTAMPTZ | ❌ | — (**⚠️ en database.ts, no en migración**) |
| created_at | TIMESTAMPTZ | ✅ | now() |
| updated_at | TIMESTAMPTZ | ✅ | now() |

#### order_lines

| Columna | Tipo | NOT NULL | Default |
|---------|------|----------|---------|
| id | UUID | ✅ | uuid_generate_v4() |
| order_id | UUID | ✅ | → orders CASCADE |
| menu_item_id | UUID | ❌ | → menu_items |
| day_of_week | INTEGER | ✅ | CHECK (1-5) |
| department | TEXT | ✅ | — |
| quantity | INTEGER | ✅ | 0 |
| unit_price | NUMERIC(10,2) | ✅ | 0 |
| recipe_version_id | UUID | ❌ | → recipe_versions |
| option_code | TEXT | ✅ | — |
| display_name | TEXT | ✅ | — |
| section_id | UUID | ❌ | → order_sections (022) |
| participant_id | UUID | ❌ | → order_participants (022) |
| is_admin_override | BOOLEAN | ❌ | — (**⚠️ en database.ts, no en migración**) |
| admin_override_by | UUID | ❌ | — (**⚠️ en database.ts, no en migración**) |
| admin_override_reason | TEXT | ❌ | — (**⚠️ en database.ts, no en migración**) |
| admin_override_at | TIMESTAMPTZ | ❌ | — (**⚠️ en database.ts, no en migración**) |
| created_at | TIMESTAMPTZ | ✅ | now() |
| updated_at | TIMESTAMPTZ | ✅ | now() |

#### order_events

| Columna | Tipo | NOT NULL | Default |
|---------|------|----------|---------|
| id | UUID | ✅ | uuid_generate_v4() |
| order_id | UUID | ✅ | → orders CASCADE |
| event_type | event_type | ✅ | — |
| actor_id | UUID | ❌ | → users |
| actor_role | actor_role | ✅ | 'system' |
| payload | JSONB | ❌ | '{}' |
| is_post_cutoff | BOOLEAN | ✅ | false |
| created_at | TIMESTAMPTZ | ✅ | now() |

#### inventory_items

| Columna | Tipo | NOT NULL | Default |
|---------|------|----------|---------|
| id | UUID | ✅ | uuid_generate_v4() |
| name | TEXT | ✅ | — |
| category | inv_category | ✅ | — |
| unit | TEXT | ✅ | — |
| current_stock | NUMERIC(10,3) | ✅ | 0 |
| min_stock | NUMERIC(10,3) | ✅ | 0 |
| cost_per_unit | NUMERIC(10,2) | ✅ | 0 |
| supplier | TEXT | ❌ | — |
| is_active | BOOLEAN | ✅ | true |
| requires_lot_tracking | BOOLEAN | ❌ | false (022) |
| default_site_id | UUID | ❌ | → sites (022) |
| default_unit | VARCHAR(10) | ❌ | 'g' CHECK IN (g,kg,ml,l,un) (022) |
| min_stock_alert | DECIMAL(12,3) | ❌ | 0 (022) |
| photo_url | TEXT | ❌ | — (022) |
| created_at | TIMESTAMPTZ | ✅ | now() |
| updated_at | TIMESTAMPTZ | ✅ | now() |

#### inventory_movements

| Columna | Tipo | NOT NULL | Default |
|---------|------|----------|---------|
| id | UUID | ✅ | uuid_generate_v4() |
| item_id | UUID | ✅ | → inventory_items |
| movement_type | movement_type | ✅ | — |
| quantity | NUMERIC(10,3) | ✅ | — |
| unit_cost | NUMERIC(10,2) | ❌ | — |
| reference_type | TEXT | ❌ | — |
| reference_id | UUID | ❌ | — |
| reason | TEXT | ❌ | — |
| actor_id | UUID | ❌ | → users |
| stock_after | NUMERIC(10,3) | ✅ | — |
| lot_id | UUID | ❌ | → inventory_lots (022) |
| site_id | UUID | ❌ | → sites (022) |
| unit | VARCHAR(10) | ❌ | — (022) |
| created_at | TIMESTAMPTZ | ✅ | now() |

#### inventory_lots

| Columna | Tipo | NOT NULL | Default |
|---------|------|----------|---------|
| id | UUID | ✅ | uuid_generate_v4() |
| item_id | UUID | ✅ | → inventory_items |
| site_id | UUID | ✅ | → sites |
| supplier_id | UUID | ❌ | → suppliers |
| lot_code | VARCHAR(100) | ✅ | — |
| quantity_initial | DECIMAL(12,3) | ✅ | CHECK (>0) |
| quantity_remaining | DECIMAL(12,3) | ✅ | CHECK (≥0) |
| unit | VARCHAR(10) | ✅ | CHECK IN (g,kg,ml,l,un) |
| cost_per_unit | DECIMAL(10,4) | ❌ | — |
| received_at | TIMESTAMPTZ | ❌ | now() |
| expires_at | DATE | ❌ | — |
| received_by | UUID | ❌ | → users |
| received_photo_url | TEXT | ❌ | — |
| notes | TEXT | ❌ | — |
| is_depleted | BOOLEAN | ✅ | GENERATED (quantity_remaining = 0) |
| created_at | TIMESTAMPTZ | ✅ | now() |
| updated_at | TIMESTAMPTZ | ✅ | now() |
| UNIQUE | (item_id, lot_code, received_at) | — | — |

#### production_tickets

| Columna | Tipo | NOT NULL | Default |
|---------|------|----------|---------|
| id | UUID | ✅ | uuid_generate_v4() |
| order_id | UUID | ✅ | → orders |
| menu_item_id | UUID | ✅ | → menu_items |
| recipe_version_id | UUID | ❌ | → recipe_versions |
| cook_site_id | UUID | ❌ | → sites |
| production_date | DATE | ✅ | — |
| quantity_target | INTEGER | ✅ | CHECK (>0) |
| quantity_produced | INTEGER | ❌ | 0 |
| quantity_wasted | INTEGER | ❌ | 0 |
| status | production_ticket_status | ❌ | 'pending' |
| blocked_reason | TEXT | ❌ | — |
| assigned_cook_id | UUID | ❌ | → users |
| priority | INTEGER | ❌ | 5 CHECK (1-10) |
| started_at | TIMESTAMPTZ | ❌ | — |
| ready_at | TIMESTAMPTZ | ❌ | — |
| created_at | TIMESTAMPTZ | ❌ | now() |
| updated_at | TIMESTAMPTZ | ❌ | now() |

#### production_lot_consumption

| Columna | Tipo | NOT NULL | Default |
|---------|------|----------|---------|
| id | UUID | ✅ | uuid_generate_v4() |
| ticket_id | UUID | ✅ | → production_tickets |
| lot_id | UUID | ✅ | → inventory_lots |
| quantity_consumed | DECIMAL(12,3) | ✅ | — |
| unit | VARCHAR(10) | ✅ | — |
| consumed_at | TIMESTAMPTZ | ❌ | now() |
| recorded_by | UUID | ❌ | → users |

#### sites

| Columna | Tipo | NOT NULL | Default |
|---------|------|----------|---------|
| id | UUID | ✅ | uuid_generate_v4() |
| organization_id | UUID | ✅ | → organizations |
| name | VARCHAR(100) | ✅ | — |
| site_type | site_type | ✅ | 'warehouse' |
| address | TEXT | ❌ | — |
| latitude | DECIMAL(10,7) | ❌ | — |
| longitude | DECIMAL(10,7) | ❌ | — |
| contact_phone | VARCHAR(30) | ❌ | — |
| is_active | BOOLEAN | ❌ | true |
| created_at | TIMESTAMPTZ | ❌ | now() |
| updated_at | TIMESTAMPTZ | ❌ | now() |
| UNIQUE | (organization_id, name) | — | — |

#### suppliers

| Columna | Tipo | NOT NULL | Default |
|---------|------|----------|---------|
| id | UUID | ✅ | uuid_generate_v4() |
| organization_id | UUID | ✅ | → organizations |
| name | VARCHAR(150) | ✅ | — |
| cuit | VARCHAR(20) | ❌ | — |
| contact_name | VARCHAR(100) | ❌ | — |
| contact_phone | VARCHAR(30) | ❌ | — |
| contact_email | VARCHAR(100) | ❌ | — |
| payment_terms | VARCHAR(100) | ❌ | — |
| is_active | BOOLEAN | ❌ | true |
| notes | TEXT | ❌ | — |
| created_at | TIMESTAMPTZ | ❌ | now() |
| updated_at | TIMESTAMPTZ | ❌ | now() |

#### business_units

| Columna | Tipo | NOT NULL | Default |
|---------|------|----------|---------|
| id | UUID | ✅ | uuid_generate_v4() |
| code | VARCHAR(10) | ✅ | UNIQUE |
| name | VARCHAR(80) | ✅ | — |
| description | TEXT | ❌ | — |
| next_correlative | INTEGER | ❌ | 1 |
| is_active | BOOLEAN | ❌ | true |
| created_at | TIMESTAMPTZ | ❌ | now() |
| updated_at | TIMESTAMPTZ | ❌ | now() |

#### order_form_tokens

| Columna | Tipo | NOT NULL | Default |
|---------|------|----------|---------|
| id | UUID | ✅ | uuid_generate_v4() |
| order_id | UUID | ❌ | → orders |
| organization_id | UUID | ✅ | → organizations |
| menu_id | UUID | ❌ | → weekly_menus |
| token | UUID | ✅ | UNIQUE uuid_generate_v4() |
| valid_from | TIMESTAMPTZ | ❌ | now() |
| valid_until | TIMESTAMPTZ | ✅ | — |
| max_uses | INTEGER | ❌ | 50 |
| used_count | INTEGER | ❌ | 0 |
| created_by | UUID | ✅ | → users |
| is_active | BOOLEAN | ❌ | true |
| require_contact | BOOLEAN | ❌ | — (**⚠️ en database.ts, no en migración 020**) |
| created_at | TIMESTAMPTZ | ❌ | now() |

#### order_sections

| Columna | Tipo | NOT NULL | Default |
|---------|------|----------|---------|
| id | UUID | ✅ | uuid_generate_v4() |
| order_id | UUID | ✅ | → orders CASCADE |
| name | VARCHAR(100) | ✅ | — |
| display_order | INTEGER | ❌ | 0 |
| closed_at | TIMESTAMPTZ | ❌ | — |
| closed_by_participant_id | UUID | ❌ | → order_participants |
| total_quantity | INTEGER | ❌ | 0 |
| created_at | TIMESTAMPTZ | ❌ | now() |
| UNIQUE | (order_id, name) | — | — |

#### order_participants

| Columna | Tipo | NOT NULL | Default |
|---------|------|----------|---------|
| id | UUID | ✅ | uuid_generate_v4() |
| order_id | UUID | ✅ | → orders CASCADE |
| section_id | UUID | ❌ | → order_sections |
| display_name | VARCHAR(100) | ✅ | — |
| access_token | UUID | ✅ | UNIQUE uuid_generate_v4() |
| form_token_id | UUID | ❌ | → order_form_tokens |
| first_seen_at | TIMESTAMPTZ | ❌ | now() |
| last_activity_at | TIMESTAMPTZ | ❌ | now() |
| submitted_at | TIMESTAMPTZ | ❌ | — |
| total_quantity | INTEGER | ❌ | 0 |
| notes | TEXT | ❌ | — |
| member_contact | TEXT | ❌ | — (**⚠️ en database.ts, no en migración 020**) |
| contact_type | VARCHAR | ❌ | — (**⚠️ en database.ts, no en migración 020**) |
| is_authorized | BOOLEAN | ❌ | — (**⚠️ en database.ts, no en migración 020**) |

#### communication_templates

| Columna | Tipo | NOT NULL | Default |
|---------|------|----------|---------|
| id | UUID | ✅ | uuid_generate_v4() |
| name | VARCHAR(100) | ✅ | — UNIQUE per channel |
| channel | communication_channel | ✅ | — |
| category | communication_category | ✅ | — |
| subject | VARCHAR(200) | ❌ | — |
| body | TEXT | ✅ | — |
| variables | JSONB | ❌ | '[]' |
| business_unit_id | UUID | ❌ | → business_units |
| is_active | BOOLEAN | ❌ | true |
| created_by | UUID | ❌ | → users |
| created_at | TIMESTAMPTZ | ❌ | now() |
| updated_at | TIMESTAMPTZ | ❌ | now() |

#### communication_threads

| Columna | Tipo | NOT NULL | Default |
|---------|------|----------|---------|
| id | UUID | ✅ | uuid_generate_v4() |
| organization_id | UUID | ❌ | → organizations |
| subject | VARCHAR(200) | ❌ | — |
| category | communication_category | ❌ | 'otro' |
| order_id | UUID | ❌ | → orders |
| status | thread_status | ❌ | 'open' |
| assigned_to | UUID | ❌ | → users |
| last_message_at | TIMESTAMPTZ | ❌ | now() |
| unread_count | INTEGER | ❌ | 0 |
| created_at | TIMESTAMPTZ | ❌ | now() |
| updated_at | TIMESTAMPTZ | ❌ | now() |

#### communications

| Columna | Tipo | NOT NULL | Default |
|---------|------|----------|---------|
| id | UUID | ✅ | uuid_generate_v4() |
| organization_id | UUID | ❌ | → organizations |
| thread_id | UUID | ❌ | → communication_threads |
| order_id | UUID | ❌ | → orders |
| template_id | UUID | ❌ | → communication_templates |
| channel | communication_channel | ✅ | — |
| direction | communication_direction | ✅ | — |
| category | communication_category | ❌ | 'otro' |
| external_message_id | VARCHAR(200) | ❌ | — |
| external_thread_id | VARCHAR(200) | ❌ | — |
| subject | VARCHAR(200) | ❌ | — |
| body | TEXT | ✅ | — |
| body_html | TEXT | ❌ | — |
| sender_identifier | VARCHAR(200) | ❌ | — |
| recipient_identifier | VARCHAR(200) | ❌ | — |
| sent_by_user_id | UUID | ❌ | → users |
| status | communication_status | ❌ | 'pending' |
| status_detail | TEXT | ❌ | — |
| attachments | JSONB | ❌ | '[]' |
| sent_at | TIMESTAMPTZ | ❌ | — |
| delivered_at | TIMESTAMPTZ | ❌ | — |
| read_at | TIMESTAMPTZ | ❌ | — |
| ai_generated | BOOLEAN | ❌ | false |
| ai_confidence | DECIMAL(3,2) | ❌ | — |
| ai_review_status | VARCHAR(30) | ❌ | — |
| ai_model_used | VARCHAR(50) | ❌ | — |
| created_at | TIMESTAMPTZ | ❌ | now() |
| updated_at | TIMESTAMPTZ | ❌ | now() |

#### conversation_logs

| Columna | Tipo | NOT NULL | Default |
|---------|------|----------|---------|
| id | UUID | ✅ | uuid_generate_v4() |
| phone | TEXT | ✅ | — |
| direction | TEXT | ✅ | CHECK IN ('in','out') |
| message_type | TEXT | ❌ | — |
| body | TEXT | ❌ | — |
| media_url | TEXT | ❌ | — |
| order_id | UUID | ❌ | → orders |
| conv_state | TEXT | ❌ | — |
| message_sid | TEXT | ❌ | — (016) |
| created_at | TIMESTAMPTZ | ✅ | now() |

#### order_tokens

| Columna | Tipo | NOT NULL | Default |
|---------|------|----------|---------|
| id | UUID | ✅ | uuid_generate_v4() |
| order_id | UUID | ✅ | → orders CASCADE |
| token | UUID | ✅ | UNIQUE uuid_generate_v4() |
| expires_at | TIMESTAMPTZ | ✅ | now() + 7 days |
| used_at | TIMESTAMPTZ | ❌ | — |
| created_at | TIMESTAMPTZ | ✅ | now() |

#### client_departments ⚠️ SQL Editor only

| Columna | Tipo | NOT NULL | Default |
|---------|------|----------|---------|
| id | UUID | ✅ | gen_random_uuid() |
| organization_id | UUID | ✅ | → organizations CASCADE |
| name | TEXT | ✅ | — |
| expected_participants | INTEGER | ✅ | 0 |
| authorized_emails | TEXT[] | ✅ | '{}' |
| created_at | TIMESTAMPTZ | ❌ | now() |
| updated_at | TIMESTAMPTZ | ❌ | now() |
| UNIQUE | (organization_id, name) | — | — |

> Fuente: commit b10 message body (SQL embedded in commit, applied manually).

#### user_notifications ⚠️ Solo database.ts

| Columna | Tipo | NOT NULL | Default |
|---------|------|----------|---------|
| id | UUID | ✅ | — |
| recipient_user_id | UUID | ❌ | — |
| recipient_organization_id | UUID | ❌ | — |
| title | TEXT | ✅ | — |
| body | TEXT | ✅ | — |
| link_url | TEXT | ❌ | — |
| read_at | TIMESTAMPTZ | ❌ | — |
| created_at | TIMESTAMPTZ | ✅ | — |

#### push_subscriptions ⚠️ Solo código

> Estructura inferida de `src/app/actions/push.ts`: `endpoint` (TEXT), `subscription` (JSONB). Estructura exacta desconocida (no hay migración ni tipo en database.ts).

---

### 3.3 Enums

⚠️ Fuente: migraciones SQL + database.ts. Los valores `ready_for_delivery`, `out_for_delivery` (order_status) y `dispatched` (event_type) están en database.ts pero **NO en ninguna migración SQL**.

| Enum | Valores |
|------|---------|
| `org_status` | active, suspended, inactive |
| `user_role` | superadmin, admin, operator, client_admin, client_user, kitchen, warehouse |
| `menu_status` | draft, published, archived |
| `menu_category` | principal, alternativa, sandwich, tarta, ensalada, veggie, especial |
| `order_status` | draft, confirmed, in_production, delivered, cancelled, partially_filled, awaiting_confirmation, **ready_for_delivery** ⚠️, **out_for_delivery** ⚠️ |
| `order_source` | whatsapp_excel, whatsapp_bot, web_form, phone, subscription, web_form_shared |
| `payment_status` | pending, partial, paid, overdue |
| `event_type` | created, line_added, line_modified, line_removed, confirmed, override, cancelled, delivered, **dispatched** ⚠️ |
| `actor_role` | client, admin, system, bot |
| `movement_type` | purchase, production_consumption, waste, adjustment_pos, adjustment_neg, return, transfer_out, transfer_in, cook_consumption, waste_pending, waste_approved |
| `inv_category` | carnes, lacteos, verduras, secos, condimentos, envases, otros |
| `site_type` | warehouse, kitchen, delivery_point, distribution_hub |
| `production_ticket_status` | pending, in_progress, paused, ready, blocked, cancelled |
| `communication_channel` | whatsapp, email, sms, web_note, phone_call_note |
| `communication_direction` | inbound, outbound |
| `communication_status` | pending, sending, sent, delivered, read, failed, ai_suggested, ai_sent, human_approved |
| `communication_category` | pedido_confirmacion, pedido_modificacion, facturacion, soporte, recordatorio_pago, entrega_notificacion, otro |
| `thread_status` | open, waiting_client, waiting_admin, resolved, archived |

---

### 3.4 Foreign keys

Documentación completa de las FKs definidas en migraciones (ON DELETE behavior donde especificado):

| Tabla origen | Columna | → Tabla destino | → Col | ON DELETE |
|-------------|---------|----------------|-------|-----------|
| users | auth_id | auth.users | id | SET NULL |
| users | organization_id | organizations | id | SET NULL |
| weekly_menus | — | — | — | — |
| menu_items | menu_id | weekly_menus | id | CASCADE |
| menu_items | recipe_version_id | recipe_versions | id | SET NULL |
| recipes | — | — | — | — |
| recipe_versions | recipe_id | recipes | id | CASCADE |
| recipe_versions | created_by | users | id | SET NULL |
| recipe_ingredients | recipe_version_id | recipe_versions | id | CASCADE |
| recipe_ingredients | inventory_item_id | inventory_items | id | — |
| recipe_ingredients | substitute_item_id | inventory_items | id | — |
| orders | organization_id | organizations | id | — |
| orders | menu_id | weekly_menus | id | — |
| orders | confirmed_by | users | id | — |
| orders | form_token_id | order_form_tokens | id | — |
| order_lines | order_id | orders | id | CASCADE |
| order_lines | menu_item_id | menu_items | id | SET NULL |
| order_lines | recipe_version_id | recipe_versions | id | — |
| order_lines | section_id | order_sections | id | — |
| order_lines | participant_id | order_participants | id | — |
| order_events | order_id | orders | id | CASCADE |
| order_events | actor_id | users | id | — |
| inventory_items | default_site_id | sites | id | — |
| inventory_movements | item_id | inventory_items | id | — |
| inventory_movements | actor_id | users | id | — |
| inventory_movements | lot_id | inventory_lots | id | — |
| inventory_movements | site_id | sites | id | — |
| conversation_logs | order_id | orders | id | SET NULL |
| order_tokens | order_id | orders | id | CASCADE |
| business_units | — | — | — | — |
| organizations | business_unit_id | business_units | id | — |
| sites | organization_id | organizations | id | — |
| suppliers | organization_id | organizations | id | — |
| inventory_lots | item_id | inventory_items | id | — |
| inventory_lots | site_id | sites | id | — |
| inventory_lots | supplier_id | suppliers | id | — |
| inventory_lots | received_by | users | id | — |
| production_tickets | order_id | orders | id | — |
| production_tickets | menu_item_id | menu_items | id | — |
| production_tickets | recipe_version_id | recipe_versions | id | — |
| production_tickets | cook_site_id | sites | id | — |
| production_tickets | assigned_cook_id | users | id | — |
| production_lot_consumption | ticket_id | production_tickets | id | — |
| production_lot_consumption | lot_id | inventory_lots | id | — |
| production_lot_consumption | recorded_by | users | id | — |
| order_form_tokens | order_id | orders | id | — |
| order_form_tokens | organization_id | organizations | id | — |
| order_form_tokens | menu_id | weekly_menus | id | — |
| order_form_tokens | created_by | users | id | — |
| order_sections | order_id | orders | id | CASCADE |
| order_sections | closed_by_participant_id | order_participants | id | — |
| order_participants | order_id | orders | id | CASCADE |
| order_participants | section_id | order_sections | id | — |
| order_participants | form_token_id | order_form_tokens | id | — |
| communication_templates | business_unit_id | business_units | id | — |
| communication_templates | created_by | users | id | — |
| communication_threads | organization_id | organizations | id | — |
| communication_threads | order_id | orders | id | — |
| communication_threads | assigned_to | users | id | — |
| communications | organization_id | organizations | id | — |
| communications | thread_id | communication_threads | id | — |
| communications | order_id | orders | id | — |
| communications | template_id | communication_templates | id | — |
| communications | sent_by_user_id | users | id | — |
| client_departments | organization_id | organizations | id | CASCADE |

---

### 3.5 Indexes

**83 índices** definidos en migraciones. Resumen por área:

- **organizations**: idx_organizations_status, idx_orgs_business_unit, idx_orgs_member_id
- **users**: idx_users_auth_id, idx_users_organization_id, idx_users_role, idx_users_phone, idx_users_email
- **weekly_menus**: idx_weekly_menus_week_start, idx_weekly_menus_status, idx_weekly_menus_week_number
- **menu_items**: idx_menu_items_menu_id, idx_menu_items_day_of_week, idx_menu_items_recipe_version_id
- **recipes**: idx_recipes_category, idx_recipes_is_active
- **recipe_versions**: idx_recipe_versions_recipe_id, idx_recipe_versions_is_current
- **recipe_ingredients**: idx_recipe_ingredients_version_id, idx_recipe_ingredients_item_id
- **orders**: idx_orders_organization_id, idx_orders_menu_id, idx_orders_status, idx_orders_created_at (DESC), idx_orders_payment_status, idx_orders_org_status, idx_orders_creation_mode, idx_orders_form_token
- **order_lines**: idx_order_lines_order_id, idx_order_lines_menu_item_id, idx_order_lines_day_of_week, idx_order_lines_section, idx_order_lines_participant
- **order_events**: idx_order_events_order_id, idx_order_events_created_at (DESC), idx_order_events_event_type
- **inventory_items**: idx_inventory_items_category, idx_inventory_items_is_active, idx_inventory_items_low_stock (condicional WHERE is_active)
- **inventory_movements**: idx_inventory_movements_item_id, idx_inventory_movements_created_at (DESC), idx_inventory_movements_type, idx_movements_lot, idx_movements_site
- **conversation_logs**: idx_conv_logs_phone, idx_conv_logs_order, idx_conv_logs_sid (condicional WHERE NOT NULL)
- **order_tokens**: idx_order_tokens_token
- **sites**: idx_sites_org, idx_sites_type
- **suppliers**: idx_suppliers_org
- **inventory_lots**: idx_lots_item_site, idx_lots_expires (condicional WHERE NOT is_depleted), idx_lots_supplier
- **production_tickets**: idx_tickets_order, idx_tickets_status, idx_tickets_date, idx_tickets_cook
- **production_lot_consumption**: idx_plc_ticket, idx_plc_lot
- **order_form_tokens**: idx_form_tokens_token, idx_form_tokens_org, idx_form_tokens_valid
- **order_sections**: idx_sections_order
- **order_participants**: idx_participants_order, idx_participants_section, idx_participants_token
- **communication_templates**: idx_templates_channel_cat, idx_templates_business_unit
- **communication_threads**: idx_threads_org, idx_threads_status, idx_threads_assigned, idx_threads_last_msg (DESC), idx_threads_order
- **communications**: idx_comms_org, idx_comms_thread, idx_comms_channel_dir, idx_comms_recipient, idx_comms_sender, idx_comms_order, idx_comms_created (DESC), idx_comms_pending (condicional WHERE pending/sending), idx_comms_external
- **business_units**: (ninguno explícito, PK natural)

---

### 3.6 Views

| View | Migración | Definición (resumen) |
|------|-----------|----------------------|
| `v_item_stock_by_site` | 023 | CROSS JOIN inventory_items × sites → stock actual por ítem+sitio (híbrido lot-based / movement-based) |

> ⚠️ Esta view existe en migración 023 pero **NO está reflejada** en la sección `Views` de `database.ts` (registrada como `[_ in never]: never`). El código no usa esta view en ningún server action.

---

## 4. Funciones PL/pgSQL

⚠️ Fuente: archivos de migración.

| Función | Args | Returns | Security Definer |
|---------|------|---------|-----------------|
| `update_updated_at()` | — | TRIGGER | No |
| `get_current_user_role()` | — | user_role | No |
| `get_current_user_org_id()` | — | UUID | No |
| `is_admin()` | — | BOOLEAN | No |
| `fn_update_stock()` | p_item_id UUID, p_qty NUMERIC, p_movement_type movement_type, p_reason TEXT, p_actor_id UUID, p_unit_cost NUMERIC, p_reference_type TEXT, p_reference_id UUID | inventory_movements | No |
| `fn_calculate_recipe_cost()` | p_recipe_version_id UUID | NUMERIC | No |
| `fn_check_cutoff()` | p_order_id UUID | BOOLEAN | No |
| `trg_recalculate_recipe_cost()` | — | TRIGGER | No |
| `prevent_user_privilege_escalation()` | — | TRIGGER | No |
| `fn_generate_member_id()` | p_business_unit_id UUID | VARCHAR | No |
| `fn_autogen_member_id()` | — | TRIGGER | No |
| `fn_update_thread_on_message()` | — | TRIGGER | No |
| `fn_consume_from_lots()` | p_item_id UUID, p_site_id UUID, p_quantity DECIMAL, p_unit VARCHAR, p_ticket_id UUID, p_recorded_by UUID | JSONB | No |
| `fn_close_order_section()` | p_section_id UUID, p_participant_id UUID | BOOLEAN | No |
| `fn_check_order_sections_closed()` | — | TRIGGER | No |

---

## 5. Triggers

⚠️ Fuente: archivos de migración. El trigger `trg_check_all_tickets_ready` es referenciado en comentarios del código pero **no aparece en ninguna migración**.

| Tabla | Trigger | Evento | Función |
|-------|---------|--------|---------|
| organizations | trg_organizations_updated_at | BEFORE UPDATE | update_updated_at() |
| users | trg_users_updated_at | BEFORE UPDATE | update_updated_at() |
| users | users_prevent_escalation | BEFORE UPDATE | prevent_user_privilege_escalation() |
| weekly_menus | trg_weekly_menus_updated_at | BEFORE UPDATE | update_updated_at() |
| recipes | trg_recipes_updated_at | BEFORE UPDATE | update_updated_at() |
| orders | trg_orders_updated_at | BEFORE UPDATE | update_updated_at() |
| order_lines | trg_order_lines_updated_at | BEFORE UPDATE | update_updated_at() |
| inventory_items | trg_inventory_items_updated_at | BEFORE UPDATE | update_updated_at() |
| recipe_ingredients | trg_recipe_ingredients_cost | AFTER INSERT/UPDATE/DELETE | trg_recalculate_recipe_cost() |
| organizations | trg_organizations_member_id | BEFORE INSERT | fn_autogen_member_id() |
| communications | trg_comms_update_thread | AFTER INSERT | fn_update_thread_on_message() |
| order_sections | trg_check_sections_closed | AFTER UPDATE OF closed_at | fn_check_order_sections_closed() |

> ⚠️ `trg_check_all_tickets_ready` — referenciado en `src/lib/production/actions/complete-ticket.ts` como responsable de la transición automática `in_production → ready_for_delivery`. **No existe en ningún archivo de migración**. Si no fue aplicado vía SQL Editor, la transición no ocurre automáticamente.

---

## 6. RLS Policies

⚠️ Fuente: archivos de migración.

| Tabla | Policy | Comando | Rol objetivo | Expresión resumida |
|-------|--------|---------|-------------|-------------------|
| organizations | Admin: acceso total | ALL | authenticated | is_admin() |
| organizations | Cliente: ver su org | SELECT | authenticated | id = get_current_user_org_id() |
| users | Admin: acceso total | ALL | authenticated | is_admin() |
| users | Cliente: ver org | SELECT | authenticated | organization_id = get_current_user_org_id() |
| users | Usuario: actualizar perfil | UPDATE | authenticated | auth_id = auth.uid() (USING + WITH CHECK) |
| users | Usuario: ver perfil | SELECT | authenticated | auth_id = auth.uid() |
| weekly_menus | Admin: CRUD | ALL | authenticated | is_admin() |
| weekly_menus | Autenticado: ver publicados | SELECT | authenticated | status = 'published' OR is_admin() |
| menu_items | Admin: CRUD | ALL | authenticated | is_admin() |
| menu_items | Autenticado: ver | SELECT | authenticated | true |
| recipes | Admin: CRUD | ALL | authenticated | is_admin() |
| recipes | Autenticado: ver activas | SELECT | authenticated | is_active OR is_admin() |
| recipe_versions | Admin: CRUD | ALL | authenticated | is_admin() |
| recipe_versions | Autenticado: ver | SELECT | authenticated | true |
| recipe_ingredients | Admin: CRUD | ALL | authenticated | is_admin() |
| recipe_ingredients | Autenticado: ver | SELECT | authenticated | true |
| orders | Admin: acceso total | ALL | authenticated | is_admin() |
| orders | Cliente: ver org | SELECT | authenticated | organization_id = get_current_user_org_id() |
| orders | Cliente: crear | INSERT | authenticated | WITH CHECK organization_id = get_current_user_org_id() |
| orders | Cliente: modificar draft | UPDATE | authenticated | USING (org+draft/confirmed) / WITH CHECK (org+draft/confirmed/cancelled) |
| order_lines | Admin: acceso total | ALL | authenticated | is_admin() |
| order_lines | Cliente: ver | SELECT | authenticated | EXISTS orders.organization_id = user_org |
| order_lines | Cliente: modificar draft | ALL | authenticated | EXISTS orders.organization_id = user_org AND orders.status = 'draft' |
| order_events | Admin: ver | SELECT | authenticated | is_admin() |
| order_events | Admin: crear | INSERT | authenticated | WITH CHECK is_admin() |
| order_events | Cliente: crear | INSERT | authenticated | actor_role = 'client' AND EXISTS orders.organization_id |
| order_events | Cliente: ver | SELECT | authenticated | EXISTS orders.organization_id = user_org |
| inventory_items | Admin: CRUD | ALL | authenticated | is_admin() |
| inventory_movements | Admin: ver | SELECT | authenticated | is_admin() |
| inventory_movements | Admin: crear | INSERT | authenticated | WITH CHECK is_admin() |
| conversation_logs | service_role_all | ALL | service_role | true |
| conversation_logs | admin_read | SELECT | authenticated | users.role IN (superadmin,admin,operator) |
| order_tokens | service_role_all | ALL | service_role | true |
| business_units | read_internal | SELECT | authenticated | users.role IN (superadmin,admin,operator,warehouse,kitchen) |
| business_units | modify_admin | ALL | authenticated | users.role IN (superadmin,admin) |
| sites | access_internal | ALL | authenticated | org match + role IN (superadmin,admin,operator,warehouse,kitchen) |
| suppliers | access | ALL | authenticated | org match + role IN (superadmin,admin,operator,warehouse) |
| inventory_lots | access | ALL | authenticated | org match via sites + role IN (superadmin,admin,operator,warehouse,kitchen) |
| production_tickets | access | ALL | authenticated | users.role IN (superadmin,admin,operator,kitchen,warehouse) |
| production_lot_consumption | access | ALL | authenticated | users.role IN (superadmin,admin,kitchen,warehouse) |
| order_form_tokens | admin | ALL | authenticated | users.role IN (superadmin,admin) |
| order_sections | access | ALL | authenticated | org match or admin |
| order_participants | access | ALL | authenticated | org match or admin |
| communications | admin_all | ALL | authenticated | role IN (superadmin,admin,operator) |
| communications | client_own | SELECT | authenticated | client roles + org match |
| communication_threads | admin_all | ALL | authenticated | role IN (superadmin,admin,operator) |
| communication_threads | client_own | SELECT | authenticated | client roles + org match |
| communication_templates | read_internal | SELECT | authenticated | auth_id = auth.uid() (any user) |
| communication_templates | modify_admin | INSERT | authenticated | role IN (superadmin,admin) |
| communication_templates | update_admin | UPDATE | authenticated | role IN (superadmin,admin) |
| communication_templates | delete_admin | DELETE | authenticated | role IN (superadmin,admin) |
| storage.objects | order_files_select | SELECT | — | bucket='order-files' AND role='service_role' |
| storage.objects | order_files_insert | INSERT | — | bucket='order-files' AND role='service_role' |
| storage.objects | order_files_update | UPDATE | — | bucket='order-files' AND role='service_role' |

> ⚠️ Las tablas `client_departments`, `user_notifications` y `push_subscriptions` no tienen policies RLS definidas en ninguna migración.

---

## 7. Repo — estructura

### 7.1 Árbol resumido `/src`

```
src/
├── app/
│   ├── (auth)/
│   │   └── login/
│   ├── (dashboard)/                   # Admin / Sheina staff
│   │   ├── clientes/
│   │   │   └── [id]/
│   │   │       ├── configuracion/
│   │   │       ├── conversaciones/
│   │   │       ├── departamentos/
│   │   │       └── mensajes/
│   │   ├── inventario/[id]/
│   │   ├── mensajes/[threadId]/
│   │   ├── menus/[id]/
│   │   ├── pedidos/
│   │   │   └── [id]/
│   │   │       ├── compartir/
│   │   │       └── participantes/
│   │   ├── plantillas/[id]/
│   │   ├── recetas/[id]/
│   │   └── page.tsx (dashboard KPIs)
│   ├── (operador)/                    # kitchen/warehouse staff
│   │   └── operador/
│   │       ├── inventario/
│   │       └── produccion/[id]/
│   ├── (portal-cliente)/              # client_admin / client_user
│   │   └── mi-portal/
│   │       ├── empresa/
│   │       ├── equipo/
│   │       ├── menu/
│   │       └── pedidos/
│   │           └── [id]/
│   │               ├── cargar/
│   │               └── participantes/
│   ├── (public)/                      # No auth required
│   │   └── pedido/[token]/
│   │       ├── gracias/
│   │       ├── menu/
│   │       └── resumen/
│   ├── actions/                       # Server actions
│   │   ├── admin-overrides.ts
│   │   ├── client-departments.ts
│   │   ├── communication-templates.ts  ⚠️ STUB
│   │   ├── communications.ts
│   │   ├── inventory.ts
│   │   ├── menus.ts
│   │   ├── order-context.ts
│   │   ├── order-form-tokens.ts
│   │   ├── order-participants.ts       ⚠️ STUB
│   │   ├── order-sections.ts           ⚠️ STUB
│   │   ├── orders.ts
│   │   ├── organization-config.ts
│   │   ├── portal-cliente.ts
│   │   ├── push.ts                    ⚠️ usa 'use server' (single quotes)
│   │   ├── recipes.ts
│   │   └── shared-form-public.ts
│   ├── api/
│   │   ├── email/webhook/route.ts
│   │   ├── orders/                    ⚠️ DIRECTORIO VACÍO (sin route.ts)
│   │   ├── parse-excel/route.ts
│   │   └── webhook/whatsapp/route.ts
│   ├── layout.tsx                     # Root layout + ToastProvider
│   └── offline/page.tsx               # PWA offline fallback
├── components/
│   ├── admin/
│   ├── auth/                          # RoleGuard, SignOutButton
│   ├── dashboard/                     # KPIs, charts, proximas-entregas, waste-approval
│   ├── layout/                        # header, sidebar, page-header
│   ├── notifications/                 # NotificationBell
│   ├── portal-cliente/                # CloseOrderButton, CopyButton
│   ├── public/                        # OrderContextHeader
│   └── ui/                            # button, input, select, badge, card, dialog,
│                                      # toast, loading, table, empty-state
├── hooks/
│   ├── use-menus.ts
│   └── use-supabase.ts
└── lib/
    ├── __tests__/time.test.ts
    ├── ai/                            # claude-client, prompts
    ├── auth/require-user.ts
    ├── email/resend-client.ts
    ├── excel/                         # sheina-parser, types
    ├── inventory/                     # alerts, movements
    ├── messaging/                     # matching, template-renderer
    ├── orders/
    │   ├── actions/                   # confirm-delivery, dispatch-order
    │   ├── cutoff.ts
    │   ├── events.ts
    │   ├── invariants.ts
    │   ├── placeholders.ts
    │   └── state-machine.ts
    ├── production/actions/            # approve-waste, cancel/complete/generate/record/start
    ├── recipes/                       # cost-calculator, versioning
    ├── supabase/                      # admin-client, client, middleware, server
    ├── types/                         # 14 type files + database.ts
    ├── utils/timezone.ts
    └── whatsapp/                      # 8 módulos WA
```

**Total pages:** 44 (incluye layouts)  
**Total archivos `.ts/.tsx` en src/:** 207  
**Route groups:** `(auth)` · `(dashboard)` · `(operador)` · `(portal-cliente)` · `(public)`  
**Build output:** 44 rutas, todas `ƒ` (Dynamic), excepto `/_not-found` (Static) y `/offline` (Static)

---

### 7.2 Server actions

| Archivo | Funciones exportadas | Cliente Supabase | Zod | revalidatePath |
|---------|---------------------|-----------------|-----|----------------|
| `actions/orders.ts` | transitionOrderStatus, updateOrderLines, consumeInventoryForOrder, retryInventoryConsumption, checkStockForOrder, sendReminderToClient, applyAdminOverride, setOrderCutoff, markProductionComplete, getOrgsAndMenusForModal, createManualOrder, returnOrderToClient, approveOrder, sendToProduction | createSupabaseAdmin | ✅ | ✅ (/pedidos, /inventario, /mi-portal/pedidos, /operador/produccion) |
| `actions/menus.ts` | createMenu, publishMenu, duplicateMenu, updateMenuItemField, addMenuItem, deleteMenuItem, uploadMenuItemPhoto | createSupabaseAdmin | ✅ | ✅ (/menus, /menus/[id]) |
| `actions/recipes.ts` | createRecipe, updateRecipeVersionNotes, createRecipeVersion | createSupabaseAdmin | ✅ | ✅ (/recetas, /recetas/[id]) |
| `actions/inventory.ts` | createItem, updateItem, registerMovement, deactivateItem | createSupabaseAdmin | ✅ | ✅ (/inventario, /inventario/[id]) |
| `actions/portal-cliente.ts` | clientAdminCloseOrder, getPublishedMenusAndDepts, createOrderAsClientAdmin, getOrderForCargar, submitOwnOrderAsClientAdmin | createAdminClient | ❌ | ✅ (/mi-portal/pedidos, /pedidos) |
| `actions/communications.ts` | upsertCommunicationTemplate, sendCommunication, getCommunications, getThreads, updateThreadStatus, markThreadRead | createAdminClient | ❌ | ❌ |
| `actions/communication-templates.ts` | createCommunicationTemplate, updateCommunicationTemplate, deleteCommunicationTemplate, getCommunicationTemplates | — | ❌ | ❌ (**⚠️ STUB: todas las funciones lanzan `throw new Error("TODO")`**) |
| `actions/admin-overrides.ts` | saveParticipantOverride, deleteParticipant, getMenuItemsForOrder | createAdminClient + createSupabaseServer | ❌ | ❌ |
| `actions/client-departments.ts` | getClientDepartments, upsertClientDepartment, deleteClientDepartment | createAdminClient | ❌ | ✅ (/clientes/[id]) |
| `actions/order-context.ts` | getOrderContext | createAdminClient | ❌ | ❌ |
| `actions/order-form-tokens.ts` | createOrderFormToken, deactivateOrderFormToken, getOrderFormTokens, validateOrderFormToken | createAdminClient | ❌ | ❌ |
| `actions/order-participants.ts` | registerParticipant, updateParticipantCart, submitParticipantOrder, getParticipantsByOrder | — | ❌ | ❌ (**⚠️ STUB: todas lanzan `throw new Error`**) |
| `actions/order-sections.ts` | createOrderSection, closeOrderSection, getOrderSections, deleteOrderSection | — | ❌ | ❌ (**⚠️ STUB: todas lanzan `throw new Error`**) |
| `actions/organization-config.ts` | updateOrganizationConfig | createAdminClient | ❌ | ✅ (/clientes/[id]) |
| `actions/shared-form-public.ts` | getSharedFormData, resolveFormToken, joinSection, getMenuItemsForToken, getParticipantCart, upsertCartLine, submitCart, recordOrderLineFromPublicForm, closeOrderSectionFromPublicForm | createAdminClient | ❌ | ❌ |
| `actions/push.ts` | subscribePush, unsubscribePush, sendPushToUser | createSupabaseServer (via `'use server'` single-quote) | ❌ | ❌ |
| `clientes/[id]/actions.ts` | addAuthorizedPhoneAction, removeAuthorizedPhoneAction | createSupabaseAdmin | ❌ | ✅ (/clientes/[id]) |
| `clientes/actions.ts` | createOrganizationAction, updateOrganizationAction, deactivateOrganizationAction, addUserToOrgAction, updateClientUserAction, resetClientUserPasswordAction | createSupabaseAdmin | ✅ | ✅ (/clientes) |
| `lib/orders/actions/confirm-delivery.ts` | confirmDelivery | createSupabaseAdmin | ❌ | ✅ (/pedidos, /mi-portal/pedidos) |
| `lib/orders/actions/dispatch-order.ts` | dispatchOrder | createSupabaseAdmin | ❌ | ✅ (/pedidos, /mi-portal/pedidos) |
| `lib/production/actions/approve-waste.ts` | approveWaste, rejectWaste | createSupabaseAdmin | ❌ | ✅ (/, /inventario) |
| `lib/production/actions/cancel-ticket.ts` | cancelProductionTicket | createSupabaseAdmin | ❌ | ✅ (/operador/produccion) |
| `lib/production/actions/complete-ticket.ts` | completeProductionTicket | createSupabaseAdmin | ❌ | ✅ (/operador, /pedidos, /mi-portal/pedidos) |
| `lib/production/actions/generate-tickets.ts` | generateProductionTicketsForOrder | createSupabaseAdmin | ❌ | ✅ (/pedidos, /operador) |
| `lib/production/actions/record-partial-waste.ts` | recordPartialWaste | createSupabaseAdmin | ❌ | ✅ (/operador/produccion/[id]) |
| `lib/production/actions/start-ticket.ts` | startProductionTicket | createSupabaseAdmin | ❌ | ✅ (/operador/produccion) |

---

### 7.3 Rutas (App Router)

| Ruta pública | Archivo page.tsx | Component | Tabla principal |
|--------------|-----------------|-----------|----------------|
| `/` (→ dashboard) | `(dashboard)/page.tsx` | Server | orders, production_tickets, inventory_items |
| `/login` | `(auth)/login/page.tsx` | Server | auth |
| `/clientes` | `(dashboard)/clientes/page.tsx` | Server | organizations |
| `/clientes/[id]` | `(dashboard)/clientes/[id]/page.tsx` | Server | organizations, users, orders |
| `/clientes/[id]/configuracion` | Server | organizations |
| `/clientes/[id]/conversaciones` | Server | conversation_logs |
| `/clientes/[id]/departamentos` | Server | client_departments |
| `/clientes/[id]/mensajes` | Server | communications, communication_threads |
| `/inventario` | `(dashboard)/inventario/page.tsx` | Server | inventory_items, inventory_movements |
| `/inventario/[id]` | Server | inventory_items, inventory_movements |
| `/mensajes` | `(dashboard)/mensajes/page.tsx` | Server | communication_threads |
| `/mensajes/[threadId]` | Server | communication_threads, communications |
| `/menus` | `(dashboard)/menus/page.tsx` | Server | weekly_menus |
| `/menus/[id]` | Server | weekly_menus, menu_items, recipes |
| `/pedidos` | `(dashboard)/pedidos/page.tsx` | Server | orders, organizations |
| `/pedidos/[id]` | Server | orders, order_lines, order_events |
| `/pedidos/[id]/compartir` | Server | order_form_tokens |
| `/pedidos/[id]/participantes` | Server | order_participants, order_sections |
| `/plantillas` | `(dashboard)/plantillas/page.tsx` | Server | communication_templates |
| `/plantillas/[id]` | Server | communication_templates |
| `/recetas` | `(dashboard)/recetas/page.tsx` | Server | recipes, recipe_versions |
| `/recetas/[id]` | Server | recipes, recipe_versions, recipe_ingredients |
| `/operador` | `(operador)/operador/page.tsx` | Server | production_tickets, inventory_items |
| `/operador/inventario` | Server | inventory_items, inventory_movements |
| `/operador/produccion` | Server | production_tickets, menu_items |
| `/operador/produccion/[id]` | Server | production_tickets, recipe_ingredients, inventory_items |
| `/mi-portal` | `(portal-cliente)/mi-portal/page.tsx` | Server | orders |
| `/mi-portal/empresa` | Server | organizations |
| `/mi-portal/equipo` | Server | order_sections, order_participants |
| `/mi-portal/menu` | Server | weekly_menus, menu_items |
| `/mi-portal/pedidos` | Server | orders |
| `/mi-portal/pedidos/[id]` | Server | orders, order_lines |
| `/mi-portal/pedidos/[id]/cargar` | Server | orders, menu_items, order_sections |
| `/mi-portal/pedidos/[id]/participantes` | Server | order_participants, order_sections |
| `/pedido/[token]` | `(public)/pedido/[token]/page.tsx` | Server | order_form_tokens |
| `/pedido/[token]/menu` | Server | menu_items, weekly_menus |
| `/pedido/[token]/resumen` | Server | order_participants, order_lines |
| `/pedido/[token]/gracias` | Server | — (static message) |
| `/offline` | Static (PWA fallback) | Static | — |

---

### 7.4 API routes

| Ruta | Método | Propósito |
|------|--------|-----------|
| `/api/webhook/whatsapp` | POST | Webhook Twilio WA: valida firma HMAC-SHA1, rate-limit, dedup por MessageSid; clasifica mensaje y despacha a manejadores |
| `/api/email/webhook` | POST | Webhook email inbound (Resend/SMTP): valida HMAC, parsea mensaje entrante, matchea thread vía `matchIncomingMessage()` |
| `/api/parse-excel` | POST | Parses Excel + IA (Claude Sonnet) para debug/testing del parser |

> ⚠️ `src/app/api/orders/` es un **directorio vacío** — no tiene `route.ts` ni ningún archivo.

---

### 7.5 Libs y utilidades

| Archivo | Propósito |
|---------|-----------|
| `lib/ai/claude-client.ts` | Anthropic SDK configurado — parseExcelWithAI, generateOrderSummary |
| `lib/ai/prompts/parse-excel.ts` | System prompt para parsing de Excel |
| `lib/ai/prompts/assistant.ts` | System prompt para asistente WA |
| `lib/auth/require-user.ts` | requireUser() — SSR auth guard, devuelve perfil completo o redirige |
| `lib/email/resend-client.ts` | Cliente Resend para envío de emails transaccionales |
| `lib/excel/sheina-parser.ts` | Parser del formato Excel Sheina (xlsx, SheetJS) |
| `lib/excel/types.ts` | Tipos TypeScript del Excel parseado |
| `lib/inventory/alerts.ts` | Lógica alertas stock mínimo |
| `lib/inventory/movements.ts` | Registrar movimientos de stock |
| `lib/messaging/matching.ts` | matchIncomingMessage() — resuelve email/WA → thread |
| `lib/messaging/template-renderer.ts` | Renderiza templates con variables de sustitución |
| `lib/orders/actions/confirm-delivery.ts` | Server action: confirmDelivery (out_for_delivery → delivered) |
| `lib/orders/actions/dispatch-order.ts` | Server action: dispatchOrder (ready_for_delivery → out_for_delivery) |
| `lib/orders/cutoff.ts` | isWithinCutoff() — ventana de corte por org + menú (ART, DST-safe) |
| `lib/orders/events.ts` | createOrderEvent() — audit log append-only |
| `lib/orders/invariants.ts` | 10 funciones invariantes del dominio (ver Sección 9) |
| `lib/orders/placeholders.ts` | insertPlaceholders() — genera participantes pre-generados desde authorized_emails |
| `lib/orders/state-machine.ts` | TRANSITIONS array + transitionOrder() con service role |
| `lib/permissions.ts` | canViewSalePrice() y similares por rol |
| `lib/production/actions/*.ts` | 6 server actions: approve/cancel/complete/generate/record/start tickets |
| `lib/recipes/cost-calculator.ts` | Cálculo de costo por porción |
| `lib/recipes/versioning.ts` | Versionado de recetas |
| `lib/supabase/admin-client.ts` | createAdminClient() — service role sync (no await) |
| `lib/supabase/client.ts` | createClient() — browser client con cookies |
| `lib/supabase/middleware.ts` | updateSession() — refresca sesión en cada request |
| `lib/supabase/server.ts` | createSupabaseServer() + createSupabaseAdmin() — server-side |
| `lib/time.ts` | Utilidades de tiempo |
| `lib/utils/timezone.ts` | formatART() — formateo fechas en America/Argentina/Buenos_Aires |
| `lib/whatsapp/*.ts` | 8 módulos WA: audit-log, classify, conversation-state, format-summary, receive-message, responses, send-message, validations, web-form-handler |

---

### 7.6 Componentes compartidos

**UI primitives** (`src/components/ui/`):
- `button.tsx` — Button con variants (primary, secondary, danger, ghost, outline) + loading
- `input.tsx` — Input con label, helperText, error
- `select.tsx` — Select estilizado
- `badge.tsx` — Badge + OrderStatusBadge (con labels y colores por estado)
- `card.tsx` — Card container
- `dialog.tsx` — Dialog modal
- `toast.tsx` — Toast system (custom, sin Sonner)
- `loading.tsx` — Loading spinner + Skeleton, SkeletonCard, SkeletonTable, SkeletonStatCard
- `table.tsx` — Table wrapper
- `empty-state.tsx` — EmptyState con icon, title, description, action

**Layout** (`src/components/layout/`):
- `sidebar.tsx`, `header.tsx`, `page-header.tsx`

**Auth** (`src/components/auth/`):
- `role-guard.tsx` — Client-side role check + redirect
- `sign-out-button.tsx`

**Dashboard** (`src/components/dashboard/`):
- `kpis.tsx`, `chart-estados.tsx`, `chart-viandas-dia.tsx`, `proximas-entregas.tsx`, `waste-approval-widget.tsx`

**Portal cliente** (`src/components/portal-cliente/`):
- `close-order-button.tsx`, `copy-button.tsx`

**Notificaciones** (`src/components/notifications/`):
- `notification-bell.tsx` — Lee `user_notifications`, badge de no leídas, dropdown

**Public** (`src/components/public/`):
- `order-context-header.tsx`

**Admin** (`src/components/admin/`):
- `edit-participant-modal.tsx`

**Otros**:
- `CartDrawer.tsx`, `push-prompt.tsx`, `sw-register.tsx`

---

### 7.7 Types

| Archivo | Contenido |
|---------|-----------|
| `lib/types/database.ts` | 624 líneas — Tipos manuales (NO autogenerado por Supabase CLI). Contiene: 18 enums, 26 interfaces de tabla, tipo Database completo. Mantenido manualmente. |
| `lib/types/business-unit.ts` | Tipos dominio BusinessUnit |
| `lib/types/communication-template.ts` | Tipos dominio CommunicationTemplate |
| `lib/types/communication-thread.ts` | Tipos dominio CommunicationThread |
| `lib/types/communication.ts` | Tipos dominio Communication |
| `lib/types/inventory-lot.ts` | Tipos dominio InventoryLot |
| `lib/types/inventory.ts` | Tipos dominio Inventory |
| `lib/types/menus.ts` | CATEGORY_LABELS, CATEGORY_ORDER — labels display para categorías |
| `lib/types/order-form-token.ts` | Tipos dominio OrderFormToken |
| `lib/types/order-participant.ts` | Tipos dominio OrderParticipant |
| `lib/types/order-section.ts` | Tipos dominio OrderSection |
| `lib/types/orders.ts` | Tipos dominio Orders |
| `lib/types/production-ticket.ts` | Tipos dominio ProductionTicket |
| `lib/types/site.ts` | Tipos dominio Site |
| `lib/types/supplier.ts` | Tipos dominio Supplier |

> ⚠️ `database.ts` NO es un archivo autogenerado por `supabase gen types`. Es mantenido manualmente. Contiene tipos que no tienen respaldo en ninguna migración (ver Sección 12).

---

## 8. Variables de entorno

| Variable | Archivos | Pública | En .env.example |
|----------|---------|---------|----------------|
| NEXT_PUBLIC_SUPABASE_URL | 5 | ✅ | ✅ |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | 3 | ✅ | ✅ |
| SUPABASE_SERVICE_ROLE_KEY | 2 | ❌ | ✅ |
| ANTHROPIC_API_KEY | 1 | ❌ | ✅ |
| TWILIO_ACCOUNT_SID | 2 | ❌ | ✅ |
| TWILIO_AUTH_TOKEN | 4 | ❌ | ✅ |
| TWILIO_WHATSAPP_FROM | 1 | ❌ | ✅ |
| RESEND_API_KEY | 1 | ❌ | ⚠️ NO |
| RESEND_FROM_EMAIL | 1 | ❌ | ⚠️ NO |
| RESEND_WEBHOOK_SECRET | 2 | ❌ | ⚠️ NO |
| NEXT_PUBLIC_APP_URL | 1 | ✅ | ⚠️ NO |
| NEXT_PUBLIC_VAPID_PUBLIC_KEY | 1 | ✅ | ⚠️ NO |
| VAPID_PUBLIC_KEY | 1 | ❌ | ⚠️ NO |
| VAPID_PRIVATE_KEY | 1 | ❌ | ⚠️ NO |
| VAPID_SUBJECT | 1 | ❌ | ⚠️ NO |
| NODE_ENV | 2 | ❌ | (inyectada por runtime) |

**9 variables en código que no están en .env.example:**
RESEND_API_KEY, RESEND_FROM_EMAIL, RESEND_WEBHOOK_SECRET, NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (+ NODE_ENV runtime)

---

## 9. State machine de pedidos — estado real

### Transiciones (src/lib/orders/state-machine.ts)

| From | To | requiredRoles | requiresCutoff |
|------|----|---------------|----------------|
| draft | confirmed | — | — |
| awaiting_confirmation | confirmed | — | — |
| partially_filled | confirmed | — | — |
| confirmed | in_production | superadmin, admin, operator | — |
| in_production | ready_for_delivery | — | — |
| ready_for_delivery | out_for_delivery | superadmin, admin, operator | — |
| out_for_delivery | delivered | superadmin, admin, operator | — |
| draft | cancelled | — | — |
| awaiting_confirmation | cancelled | — | — |
| partially_filled | cancelled | — | — |
| confirmed | cancelled | — | ✅ (solo dentro de corte) |
| in_production | cancelled | superadmin, admin | — |
| ready_for_delivery | cancelled | superadmin, admin | — |
| out_for_delivery | cancelled | superadmin, admin | — |
| partially_filled | awaiting_confirmation | — | — |
| awaiting_confirmation | draft | superadmin, admin | — |

**Total transiciones:** 16

### Invariantes (src/lib/orders/invariants.ts)

| Función | Condición |
|---------|-----------|
| canAcceptLoads | status IN (draft, partially_filled) |
| canBeOverriddenByAdmin | status IN (draft, partially_filled, awaiting_confirmation) |
| canBeClosedByClient | status IN (draft, partially_filled) |
| canBeApprovedBySheina | status = awaiting_confirmation |
| canBeReturnedBySheina | status = awaiting_confirmation |
| canBeSentToProduction | status = confirmed |
| canBeDispatched | status = ready_for_delivery |
| canBeConfirmedDelivered | status = out_for_delivery |
| shouldTokenBeActive | status IN (draft, partially_filled) |
| isTerminal | status IN (delivered, cancelled) |

### Statuses en BD

⚠️ Sin MCP Supabase no es posible ejecutar `SELECT status, count(*) FROM orders GROUP BY status`. Valores posibles en enum según database.ts:

`draft` · `confirmed` · `in_production` · `delivered` · `cancelled` · `partially_filled` · `awaiting_confirmation` · `ready_for_delivery`\* · `out_for_delivery`\*

\* Estos dos valores **no están en ninguna migración SQL** — solo en database.ts y en el código.

---

## 10. Roles de usuario — estado real

⚠️ Sin MCP Supabase no es posible ejecutar `SELECT role, count(*) FROM users GROUP BY role`.

### Roles definidos en enum `user_role`

| Rol | Agregado en | Acceso |
|-----|-------------|--------|
| superadmin | 001 | Total, bypasa todos los guards |
| admin | 001 | Total sobre datos cliente, puede hacer overrides |
| operator | 001 | Dashboard admin + producción |
| client_admin | 001 | Portal cliente, puede crear pedidos y gestionar equipo |
| client_user | 001 | Portal cliente, read-mostly |
| kitchen | 017 | Portal operador: producción únicamente |
| warehouse | 017 | Portal operador: inventario + producción |

### Middleware de auth

```
src/middleware.ts → updateSession()
Matcher excluye: _next/static, _next/image, favicon, sw.js, manifest, icons, offline, 
                  api/webhook/whatsapp, api/email/webhook, assets estáticos
```

---

## 11. Datos demo presentes

⚠️ Sin MCP Supabase no es posible ejecutar queries live. Según migraciones de seed (006, 011, 012, 025, 026):

| Tabla | Contenido esperado (post-seed) |
|-------|-------------------------------|
| `organizations` | 1+ orgs demo (Sheina + clientes de prueba) |
| `business_units` | Registros Viandas (VIA), Comercial (COM), etc. según 025 |
| `sites` | Almacén Central, Cocina Principal (025) |
| `suppliers` | 1 supplier placeholder (025) |
| `inventory_items` | 15+ insumos (006 + 011 + 012) |
| `inventory_lots` | 0 (Capa C — no arrancó) |
| `weekly_menus` | 2+ menús publicados (006 + 012) |
| `menu_items` | 35+ items (7 opciones × 5 días × 2+ menús) |
| `recipes` | 7+ recetas con versiones (006 + 011) |
| `recipe_versions` | 7+ versiones (is_current = true) |
| `orders` | 0 (limpiado por 025) o datos reales de prueba |
| `production_tickets` | 0 (limpiado por 025) |
| `communications` | 0 (limpiado por 025) |
| `communication_threads` | 0 (limpiado por 025) |
| `communication_templates` | 11 templates (026) |
| `client_departments` | Desconocido (sin migración oficial) |
| `user_notifications` | Desconocido (sin migración oficial) |
| `push_subscriptions` | Desconocido (sin migración oficial) |

---

## 12. Hallazgos preliminares

Lista objetiva de cosas que llaman la atención. Sin juicio de valor, solo hechos.

### Schema drift — campos/tablas en código sin migración correspondiente

1. **`order_status` enum incompleto en SQL:** Los valores `ready_for_delivery` y `out_for_delivery` están en database.ts y en el código de la state machine, pero **no aparecen en ningún archivo de migración**. Si no fueron aplicados al enum real en Supabase, las transiciones hacia esos estados fallarán silenciosamente (Postgres rechazará el INSERT con error de tipo).

2. **`event_type` enum incompleto en SQL:** El valor `dispatched` está en database.ts pero no en ninguna migración. Mismo riesgo que punto 1.

3. **Columnas en `orders` sin migración:** `order_code`, `ready_for_delivery_at`, `dispatched_at`, `dispatched_by`, `delivered_by`, `custom_cutoff_at` — todas presentes en database.ts y referenciadas en el código, pero no aparecen en ningún `ALTER TABLE orders` de los 26 archivos de migración.

4. **Columnas en `order_lines` sin migración:** `is_admin_override`, `admin_override_by`, `admin_override_reason`, `admin_override_at` — en database.ts pero no en migraciones.

5. **Columna `timezone` en `organizations`:** En database.ts pero no en ninguna migración.

6. **Columna `require_contact` en `order_form_tokens`:** En database.ts pero no en migración 020.

7. **Columnas extra en `order_participants`:** `member_contact`, `contact_type`, `is_authorized` — en database.ts pero no en migración 020.

8. **Tabla `client_departments` sin migración:** Aplicada vía SQL Editor según commit b10. Commit incluye la DDL en el mensaje, pero no hay archivo `.sql` en `/supabase/migrations/`.

9. **Tabla `user_notifications` sin migración:** Tipada en database.ts y leída por NotificationBell, pero sin migración en el repo.

10. **Tabla `push_subscriptions` sin migración:** Referenciada en `actions/push.ts` (upsert/delete), sin migración ni tipo en database.ts.

### Trigger referenciado que no existe en migraciones

11. **`trg_check_all_tickets_ready`:** Referenciado en comentarios de `complete-ticket.ts` como el responsable de la transición automática `in_production → ready_for_delivery`. No aparece en ningún archivo de migración. Si no existe en la BD real, la transición requiere que el código la dispare manualmente (lo cual fue removido en FIX-L).

### Funciones definidas pero no usadas

12. **`fn_consume_from_lots()`:** Definida en migración 023 (FIFO lot consumption). Ningún server action la llama. El consumo actual usa `fn_update_stock()` directamente vía `inventory_movements`. La función existe pero es código muerto de BD.

13. **`v_item_stock_by_site`:** View definida en migración 023. No está tipada en `database.ts` (`Views: [_ in never]: never`). Ningún server action la consulta. View existente pero no integrada.

### Server actions stub (throws en producción)

14. **`actions/communication-templates.ts`:** Exporta 4 funciones que todas lanzan `throw new Error("TODO")`. Llamar a estas funciones desde `/plantillas` rompería con 500.

15. **`actions/order-participants.ts`:** Exporta 4 funciones que todas lanzan. No parece usarse en el flujo principal (el flujo de participantes usa `shared-form-public.ts`).

16. **`actions/order-sections.ts`:** Exporta 4 funciones que todas lanzan. Idem — el flujo principal usa `shared-form-public.ts`.

### Variables de entorno sin documentar

17. **9 variables en código no están en `.env.example`:** RESEND_API_KEY, RESEND_FROM_EMAIL, RESEND_WEBHOOK_SECRET (integración email), VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY (Web Push), NEXT_PUBLIC_APP_URL.

### Directorio vacío

18. **`src/app/api/orders/`:** Directorio existe pero no contiene ningún archivo. Posiblemente remanente de una refactorización hacia server actions.

### Anomalías de código menor

19. **`actions/push.ts`:** Usa `'use server'` (comillas simples) mientras todos los demás archivos usan `"use server"` (comillas dobles). Funciona igual, pero inconsistente.

20. **Dos tablas de tokens:** `order_tokens` (migración 013, para auth WA de 7 días) y `order_form_tokens` (migración 020, para formularios compartidos). Nombres similares, propósitos distintos. Potencial confusión.

21. **`database.ts` mantenido manualmente:** El archivo no es autogenerado por `supabase gen types`. Riesgo de deriva entre tipos TypeScript y schema real de BD que no se detecta automáticamente en CI.

22. **Sin RLS para `client_departments`, `user_notifications`, `push_subscriptions`:** Las tres tablas sin migración tampoco tienen policies definidas. Sus políticas de acceso dependen de lo que haya sido aplicado manualmente en Supabase.

---

## 13. Smoke rápido

| Check | Resultado | Detalle |
|-------|-----------|---------|
| `npx tsc --noEmit` | ✅ Sin errores | Exit code 0 |
| `npm run lint` | ⚠️ No ejecutable | `next lint` falla en entorno Bash/WSL por path Windows (`K:\Proyectos_VSCODE\GrupoSheina\lint` no existe) — issue de entorno, no de código |
| `npm run build` | ✅ Build exitoso | Exit code 0 — 44 rutas generadas, todas Dynamic excepto /_not-found y /offline |
| `git status` | ✅ Limpio | 1 archivo untracked ignorado: `.claude/settings.local.json` |
| Commit HEAD | `f2b1f6f` (1 commit adelante de origin/main, no pusheado) | feat(b2): loading skeletons, empty states y polish responsive |

**Build output — rutas generadas:**

```
/ clientes  /clientes/[id]  /clientes/[id]/configuracion  
/clientes/[id]/conversaciones  /clientes/[id]/departamentos  
/clientes/[id]/mensajes  /inventario  /inventario/[id]  
/login  /mensajes  /mensajes/[threadId]  /menus  /menus/[id]  
/mi-portal  /mi-portal/empresa  /mi-portal/equipo  /mi-portal/menu  
/mi-portal/pedidos  /mi-portal/pedidos/[id]  /mi-portal/pedidos/[id]/cargar  
/mi-portal/pedidos/[id]/participantes  /operador  /operador/inventario  
/operador/produccion  /operador/produccion/[id]  
/pedido/[token]  /pedido/[token]/gracias  /pedido/[token]/menu  /pedido/[token]/resumen  
/pedidos  /pedidos/[id]  /pedidos/[id]/compartir  /pedidos/[id]/participantes  
/plantillas  /plantillas/[id]  /recetas  /recetas/[id]  
/api/email/webhook  /api/parse-excel  /api/webhook/whatsapp
```

---

*Audit generado el 2026-04-28 · Branch main · Commit f2b1f6f · Fuente: archivos de repo (sin MCP Supabase)*
