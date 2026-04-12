# CLAUDE.md — Sistema de Gestión de Viandas (Grupo Sheina)

## Contexto del proyecto

Estamos construyendo una plataforma SaaS de gestión de viandas corporativas para **Grupo Sheina**, una empresa argentina que produce y entrega viandas (comidas preparadas) a empresas/PYMES. El sistema reemplaza un proceso manual donde los clientes completan un Excel con sus pedidos semanales y lo envían por WhatsApp.

### Problema que resolvemos
- Los clientes envían un Excel por WhatsApp con cantidades por opción de menú y departamento (adm, vtas, diet, log, otros)
- Un operador lo revisa manualmente, suma totales, detecta errores y confirma
- Cada pedido toma ~15 minutos de procesamiento manual
- No hay trazabilidad de cambios ni cálculo automático de insumos

### Solución
- Bot de WhatsApp que recibe el Excel, lo parsea con IA (Claude API), y devuelve un resumen para confirmación
- Panel admin web para gestionar pedidos, menús, recetas e inventario
- Sistema ABM (Altas, Bajas, Modificaciones) con auditoría completa y ventana de corte configurable

## Stack tecnológico

- **Framework**: Next.js 15 con App Router, TypeScript, Tailwind CSS
- **Base de datos**: Supabase (PostgreSQL + Auth + Storage + Edge Functions + Realtime)
- **IA**: Claude API (Sonnet 4.6) via @anthropic-ai/sdk
- **WhatsApp**: Twilio WhatsApp Business API
- **Parsing Excel**: xlsx (SheetJS)
- **Validación**: zod
- **Fechas**: date-fns
- **Iconos**: lucide-react
- **Pagos**: MercadoPago API (fase posterior)
- **Deploy**: Vercel (conectado a GitHub, deploy automático por push a main)

## Estructura del proyecto

```
src/
├── app/                          # App Router de Next.js
│   ├── (auth)/                   # Rutas públicas
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/              # Rutas protegidas (admin)
│   │   ├── page.tsx              # Dashboard principal (resumen del día)
│   │   ├── pedidos/
│   │   │   ├── page.tsx          # Lista de pedidos con filtros
│   │   │   └── [id]/page.tsx     # Detalle de pedido con ABM
│   │   ├── menus/
│   │   │   ├── page.tsx          # Lista de menús semanales
│   │   │   └── [id]/page.tsx     # Editor de menú
│   │   ├── recetas/
│   │   │   ├── page.tsx          # Lista de recetas
│   │   │   └── [id]/page.tsx     # Ficha técnica con versionado
│   │   ├── inventario/
│   │   │   ├── page.tsx          # Lista de insumos + alertas
│   │   │   └── [id]/page.tsx     # Detalle de insumo + movimientos
│   │   ├── clientes/
│   │   │   └── page.tsx          # Lista de organizaciones
│   │   └── layout.tsx            # Layout con sidebar
│   └── api/
│       ├── webhook/whatsapp/route.ts   # Webhook de Twilio
│       ├── parse-excel/route.ts        # Parsing con IA
│       └── orders/
│           ├── route.ts                # GET lista, POST crear
│           └── [id]/
│               ├── route.ts            # GET detalle, PATCH actualizar
│               ├── confirm/route.ts    # POST confirmar
│               └── events/route.ts     # GET eventos
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Cliente browser (con cookies)
│   │   ├── server.ts             # Cliente server (con service role)
│   │   └── middleware.ts         # Middleware de auth
│   ├── ai/
│   │   ├── claude-client.ts      # Cliente Anthropic configurado
│   │   └── prompts/
│   │       ├── parse-excel.ts    # System prompt para parsing de Excel
│   │       └── assistant.ts      # System prompt para asistente WA
│   ├── whatsapp/
│   │   ├── send-message.ts       # Enviar mensajes via Twilio
│   │   ├── receive-message.ts    # Procesar mensajes entrantes
│   │   └── format-summary.ts    # Formatear resumen de pedido para WA
│   ├── excel/
│   │   ├── sheina-parser.ts      # Parser específico del formato Sheina
│   │   └── types.ts              # Tipos del Excel parseado
│   ├── orders/
│   │   ├── state-machine.ts      # Máquina de estados del pedido
│   │   ├── cutoff.ts             # Lógica de ventana de corte
│   │   └── events.ts             # Crear eventos de auditoría
│   ├── inventory/
│   │   ├── movements.ts          # Registrar movimientos de stock
│   │   └── alerts.ts             # Lógica de alertas de mínimo
│   ├── recipes/
│   │   ├── versioning.ts         # Crear nueva versión de receta
│   │   └── cost-calculator.ts    # Calcular costo por porción
│   └── types/
│       ├── database.ts           # Tipos generados de Supabase
│       ├── orders.ts             # Tipos de dominio de pedidos
│       ├── menus.ts              # Tipos de dominio de menús
│       └── inventory.ts          # Tipos de dominio de inventario
├── components/
│   ├── ui/                       # Componentes base reutilizables
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── badge.tsx
│   │   ├── card.tsx
│   │   ├── table.tsx
│   │   ├── dialog.tsx
│   │   ├── toast.tsx
│   │   └── loading.tsx
│   ├── layout/
│   │   ├── sidebar.tsx           # Sidebar de navegación
│   │   ├── header.tsx            # Header con usuario y notificaciones
│   │   └── page-header.tsx       # Título de página con breadcrumbs
│   ├── orders/
│   │   ├── order-table.tsx       # Tabla de pedidos con filtros
│   │   ├── order-detail.tsx      # Vista detalle de pedido
│   │   ├── order-lines.tsx       # Líneas del pedido agrupadas por día
│   │   ├── order-timeline.tsx    # Timeline de eventos
│   │   └── order-status-badge.tsx
│   ├── menus/
│   │   ├── menu-editor.tsx       # Editor de menú semanal
│   │   ├── day-tab.tsx           # Pestaña de día con opciones
│   │   └── menu-item-row.tsx     # Fila de opción de menú
│   ├── recipes/
│   │   ├── recipe-form.tsx       # Formulario de receta
│   │   ├── ingredient-table.tsx  # Tabla de ingredientes editable
│   │   └── version-history.tsx   # Historial de versiones
│   └── inventory/
│       ├── item-table.tsx        # Tabla de insumos con alertas
│       ├── movement-form.tsx     # Formulario de movimiento de stock
│       └── movement-history.tsx  # Historial de movimientos
└── hooks/
    ├── use-supabase.ts           # Hook del cliente Supabase
    ├── use-orders.ts             # CRUD de pedidos
    ├── use-menus.ts              # CRUD de menús
    ├── use-recipes.ts            # CRUD de recetas
    └── use-inventory.ts          # CRUD de inventario
```

## Modelo de datos (PostgreSQL en Supabase)

### Enums
- `org_status`: active, suspended, inactive
- `user_role`: superadmin, admin, operator, client_admin, client_user
- `menu_status`: draft, published, archived
- `menu_category`: principal, alternativa, sandwich, tarta, ensalada, veggie, especial
- `order_status`: draft, confirmed, in_production, delivered, cancelled
- `order_source`: whatsapp_excel, whatsapp_bot, web_form, phone, subscription
- `payment_status`: pending, partial, paid, overdue
- `event_type`: created, line_added, line_modified, line_removed, confirmed, override, cancelled, delivered
- `actor_role`: client, admin, system, bot
- `movement_type`: purchase, production_consumption, waste, adjustment_pos, adjustment_neg, return
- `inv_category`: carnes, lacteos, verduras, secos, condimentos, envases, otros

### Tablas principales (11)
1. `organizations` — Clientes PYME (name, cuit, contact_phone, cutoff_time, cutoff_days_before, departments JSONB, status)
2. `users` — Usuarios vinculados a auth.users (organization_id FK, role, full_name, phone, email, is_active)
3. `weekly_menus` — Menús semanales (week_start, week_end, week_number, status)
4. `menu_items` — Opciones diarias del menú (menu_id FK, day_of_week 1-5, option_code, recipe_version_id FK, category, display_name, is_available)
5. `recipes` — Entidad lógica de receta (name, category, is_active)
6. `recipe_versions` — Versiones inmutables (recipe_id FK, version, portions_yield, preparation_notes, cost_per_portion, is_current)
7. `recipe_ingredients` — Ingredientes de cada versión (recipe_version_id FK, inventory_item_id FK, quantity, unit, substitute_item_id FK nullable)
8. `orders` — Pedidos semanales (organization_id FK, menu_id FK, week_label, status, source, total_units, total_amount, payment_status, confirmed_at, original_file_url, ai_parsing_log JSONB)
9. `order_lines` — Líneas de pedido (order_id FK, menu_item_id FK, day_of_week, department, quantity, unit_price, recipe_version_id FK, option_code, display_name)
10. `order_events` — Log de auditoría append-only (order_id FK, event_type, actor_id FK, actor_role, payload JSONB, is_post_cutoff, created_at)
11. `inventory_items` — Insumos (name, category, unit, current_stock, min_stock, cost_per_unit, supplier, is_active)
12. `inventory_movements` — Movimientos append-only (item_id FK, movement_type, quantity, unit_cost, reference_type, reference_id, reason, actor_id FK, stock_after)

### Relaciones clave
- organizations 1→N users, 1→N orders
- weekly_menus 1→N menu_items
- recipes 1→N recipe_versions 1→N recipe_ingredients
- menu_items →1 recipe_versions
- orders 1→N order_lines, 1→N order_events
- order_lines →1 menu_items, →1 recipe_versions
- recipe_ingredients →1 inventory_items
- inventory_items 1→N inventory_movements

## Reglas de negocio críticas

### Máquina de estados del pedido
```
draft → confirmed → in_production → delivered
draft → cancelled
confirmed → cancelled (solo pre-corte o admin)
```

### Ventana de corte
- Cada organización tiene `cutoff_time` (default 18:00) y `cutoff_days_before` (default 1)
- Antes del corte: el cliente puede hacer ABM total de su pedido
- Después del corte: solo un admin puede modificar (registrado como override post-corte con motivo obligatorio)
- Fórmula: `cutoff_datetime = fecha_entrega - cutoff_days_before días, a las cutoff_time`

### Versionado de recetas
- Modificar una receta crea una nueva `recipe_version` con `version = max + 1`
- La versión anterior se marca `is_current = false`
- Los pedidos ya confirmados mantienen su `recipe_version_id` original
- Solo la versión `is_current = true` se usa para nuevos pedidos

### Inventario inmutable
- Nunca editar `current_stock` directamente
- Todo cambio de stock se registra como `inventory_movement`
- Para corregir errores: crear un contramovimiento con motivo
- Al pasar pedido a `in_production`: calcular insumos y crear movimientos de tipo `production_consumption`

### Cascadas automáticas
- Modificar pedido → recalcular insumos necesarios → verificar stock → alertar si hay faltantes
- Cambiar precio de insumo → recalcular costo de todas las recetas activas que lo usan
- Modificar receta → nueva versión → ajustar proyección de insumos para pedidos futuros

## Formato del Excel de Sheina

El Excel tiene una hoja por semana. Estructura de cada hoja:
- Fila encabezado: columnas 5-9 son nombres de departamentos (adm, vtas, diet, log, otros)
- Cada bloque de día empieza con el nombre del día en columna 1
- Columna 0: etiqueta de semana (solo en primera fila del bloque)
- Columna 1: día (LUNES, MARTES, MIERCOLES, JUEVES, VIERNES)
- Columna 2: código de opción (A, B, C, D, E, F, G para lunes; H-N martes; O-U miércoles; V-BB jueves; CC-II viernes)
- Columna 3: nombre del plato
- Columna 4: cantidad principal (número, o letra si es feriado/pendiente)
- Columnas 5-9: cantidades por departamento (NaN = 0)
- Fila con "TOTALES" en columna 3: fin de día, columna 4 es el total
- Hay 7 opciones por día: principal, alternativa, sándwich, tarta, ensalada, veggie, especial

Anomalías conocidas:
- Jueves y viernes pueden tener letras (F, E, R, I, A, D, O) en columna 4 en vez de números → indica "completar después" o feriado
- Algunas hojas tienen filas vacías al inicio
- Los nombres de las hojas siguen el formato "DD.MM AL DD.MM"

## Estilo de código

- TypeScript estricto (no `any`)
- Server Components por defecto, Client Components solo donde haya interactividad
- Usar `use server` para server actions donde sea posible
- Nombrar archivos en kebab-case
- Componentes en PascalCase
- Funciones y variables en camelCase
- Imports absolutos con alias `@/`
- Tailwind CSS para estilos (no CSS modules)
- Validar inputs con zod en API routes y server actions
- Manejar errores con try/catch, nunca dejar promesas sin catch
- Logs con console.error para errores, no console.log para debug en producción

## Diseño UI

- Estilo limpio, profesional, mobile-first
- Paleta cálida: fondo claro, acentos terracota (#D4622B) para acciones principales
- Sidebar con navegación principal (Pedidos, Menús, Recetas, Inventario, Clientes)
- Tablas con filtros inline, badges de color por estado
- Formularios con validación en tiempo real
- Toast notifications para confirmaciones
- Diálogos de confirmación para acciones destructivas
- Loading states para todas las operaciones async

## Variables de entorno necesarias

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```
