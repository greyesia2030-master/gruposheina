# Prompts secuenciales para Claude Code
# Sistema de Gestión de Viandas — Grupo Sheina
#
# INSTRUCCIONES DE USO:
# 1. Copiá el archivo CLAUDE.md a la raíz de tu proyecto
# 2. Abrí Claude Code en la carpeta del proyecto
# 3. Ejecutá cada prompt en orden, esperando a que termine antes de pasar al siguiente
# 4. Después de cada prompt, verificá que funcione antes de avanzar
# 5. Hacé commit después de cada paso exitoso
#
# Tiempo total estimado: 12-16 horas de ejecución con Claude Code

---

## PROMPT 1: Scaffold del proyecto (30 min)

```
Creá el proyecto Next.js con toda la estructura base. Ejecutá estos pasos:

1. Inicializá Next.js 15 con TypeScript, Tailwind, ESLint, App Router, src directory:
   npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

2. Instalá las dependencias:
   npm install @supabase/supabase-js @supabase/ssr @anthropic-ai/sdk xlsx twilio zod date-fns lucide-react

3. Creá TODA la estructura de carpetas que está en CLAUDE.md (todas las carpetas y archivos vacíos con exports placeholder).

4. Creá el archivo .env.local.example con todas las variables de entorno listadas en CLAUDE.md (valores placeholder).

5. Creá el archivo .gitignore apropiado (incluir .env.local, node_modules, .next).

6. Configurá el path alias @/ en tsconfig.json.

7. Creá src/lib/supabase/client.ts con el cliente browser de Supabase usando createBrowserClient de @supabase/ssr.

8. Creá src/lib/supabase/server.ts con el cliente server usando createServerClient de @supabase/ssr con cookies de Next.js.

9. Creá src/middleware.ts que use el helper de Supabase para refrescar la sesión en cada request.

No escribas componentes de UI todavía, solo la estructura y la configuración base.
```

---

## PROMPT 2: Base de datos — Migraciones SQL (30 min)

```
Generá los archivos de migración SQL para ejecutar en el SQL Editor de Supabase. Creá estos archivos en una carpeta supabase/migrations/ en la raíz del proyecto:

001_extensions_and_enums.sql — Extensión uuid-ossp y todos los enums del CLAUDE.md
002_tables.sql — Las 12 tablas con todas las columnas, tipos, constraints, FK, defaults y checks
003_indexes.sql — Índices para todas las FK y campos frecuentes de consulta
004_rls_policies.sql — Habilitar RLS en todas las tablas + políticas para admin (acceso total) y client (solo su organización)
005_functions.sql — Funciones PostgreSQL:
  - fn_update_stock(item_id, qty, movement_type, reason, actor_id) — registra movimiento y actualiza current_stock atómicamente
  - fn_calculate_recipe_cost(recipe_version_id) — recalcula cost_per_portion sumando ingredientes
  - fn_check_cutoff(order_id) — devuelve true si el pedido está dentro de la ventana de corte
  - trigger on inventory_movements AFTER INSERT que actualiza inventory_items.current_stock
  - trigger on recipe_ingredients AFTER INSERT/UPDATE/DELETE que recalcula cost_per_portion
006_seed_data.sql — Datos semilla:
  - 1 organización: "Cliente PYME Demo" con departamentos [adm, vtas, diet, log, otros], cutoff 18:00, 1 día antes
  - 1 usuario admin: role superadmin, email admin@sheina.com
  - 15 insumos básicos: carne vacuna, pollo, muzzarella, harina 000, huevos, tomate, lechuga, papa, batata, jamón cocido, queso cremoso, arroz, fideos secos, pan de miga, aceite
  - 5 recetas con fichas técnicas completas (recipe + recipe_version + recipe_ingredients):
    * Milanesa de carne con ensalada (carne, harina, huevos, lechuga, tomate)
    * Ravioles con salsa fileto (harina, huevos, tomate, muzzarella)
    * Tarta de jamón y queso (harina, jamón, queso, huevos)
    * Ensalada Caesar (lechuga, pollo, queso)
    * Ñoquis con bolognesa (papa, harina, carne, tomate)
  - 1 menú semanal publicado (semana del 6 al 10 de abril) con 7 opciones por día basadas en el menú real de Sheina

Cada archivo debe ser ejecutable de forma independiente y en orden. Usá UUID para todos los IDs. Incluí comentarios descriptivos en español.
```

---

## PROMPT 3: Tipos TypeScript del dominio (20 min)

```
Basándote en el modelo de datos de las migraciones SQL que acabamos de crear, generá los tipos TypeScript completos en src/lib/types/:

1. database.ts — Tipos que reflejan exactamente las tablas de Supabase:
   - Tipo Row, Insert y Update para cada tabla (patrón Database['public']['Tables']['table_name'])
   - Exportar el tipo Database completo para usar con el cliente tipado de Supabase

2. orders.ts — Tipos de dominio de pedidos:
   - OrderWithLines (order + order_lines[] + organization)
   - OrderEvent (con actor name resuelto)
   - CreateOrderInput, UpdateOrderLineInput
   - OrderSummary (para la lista de pedidos)
   - ParsedExcelData (resultado del parsing de Excel)

3. menus.ts — Tipos de dominio de menús:
   - WeeklyMenuWithItems (menu + menu_items[] con recipe info)
   - MenuItemWithRecipe
   - CreateMenuInput, UpdateMenuItemInput

4. inventory.ts — Tipos de dominio de inventario:
   - InventoryItemWithAlerts (item + boolean isLowStock)
   - InventoryMovementWithActor
   - CreateMovementInput
   - StockAlert

Usá los enums de la base de datos como union types de TypeScript. Todos los tipos deben ser exportados.
```

---

## PROMPT 4: Parser de Excel de Sheina (1 hora)

```
Creá el parser de Excel específico para el formato de Grupo Sheina. Este es el módulo más crítico porque lee los archivos reales del cliente.

1. src/lib/excel/types.ts — Tipos del Excel parseado:
   - ParsedWeek { weekLabel, sheetName, days: ParsedDay[] }
   - ParsedDay { dayOfWeek: 1-5, dayName, options: ParsedOption[] }
   - ParsedOption { code, displayName, quantities: { main: number, departments: Record<string, number> }, anomalies: string[] }
   - ParseResult { weeks: ParsedWeek[], errors: string[], warnings: string[] }

2. src/lib/excel/sheina-parser.ts — Parser principal:
   - Función parseSheinaExcel(buffer: Buffer): ParseResult
   - Lee todas las hojas del Excel con xlsx
   - Para cada hoja:
     * Detecta el nombre de la semana del encabezado (fila con formato "DD-MM AL DD-MM")
     * Agrupa filas por día (detectando LUNES, MARTES, etc. en columna 1)
     * Para cada día, extrae las opciones: código (col 2), nombre (col 3), cantidad principal (col 4), departamentos (col 5-9)
     * Detecta fila TOTALES como fin de día
     * Detecta anomalías: valor no numérico en col 4 (letras = feriado o pendiente), totales inconsistentes, filas vacías
   - Retorna ParseResult con toda la data estructurada y las anomalías detectadas

3. src/lib/ai/prompts/parse-excel.ts — System prompt para Claude API:
   - Recibe los datos crudos del parser
   - Instrucciones para:
     * Validar que los totales cuadran (suma de departamentos = cantidad principal)
     * Detectar errores sutiles (nombres de platos mal escritos, cantidades inusuales)
     * Generar un resumen legible en español para WhatsApp
     * Retornar JSON estructurado con los datos validados
   - El prompt debe incluir ejemplos del formato esperado de entrada y salida

4. src/lib/ai/claude-client.ts — Cliente de Anthropic configurado:
   - Inicializa el client con ANTHROPIC_API_KEY
   - Función parseExcelWithAI(rawData: ParseResult): Promise<ValidatedOrderData>
   - Función generateOrderSummary(orderData): Promise<string> (resumen para WhatsApp)

5. src/app/api/parse-excel/route.ts — API Route:
   - POST que recibe multipart/form-data con el archivo Excel
   - Ejecuta sheina-parser, luego claude-client
   - Retorna { data: ValidatedOrderData, summary: string, warnings: string[] }

Testeá el parser con este formato de datos (es la estructura real del Excel de Sheina):
- Columna 0: "SEMANA 1" (solo primera fila del bloque)
- Columna 1: "LUNES" (día)
- Columna 2: "A" (código opción)
- Columna 3: "ÑOQUIS CON BOLOGNESA" (nombre plato)
- Columna 4: 35 (cantidad principal, o letras F/E/R/I/A/D/O si es feriado)
- Columna 5-9: cantidades por departamento (NaN = 0)
```

---

## PROMPT 5: Bot de WhatsApp (1.5 horas)

```
Creá el bot de WhatsApp completo con Twilio.

1. src/lib/whatsapp/send-message.ts:
   - Función sendWhatsAppMessage(to: string, body: string): envía texto via Twilio
   - Función sendWhatsAppFile(to: string, mediaUrl: string, body: string): envía archivo
   - Configuración con TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM

2. src/lib/whatsapp/format-summary.ts:
   - Función formatOrderSummary(orderData: ValidatedOrderData): string
   - Genera un mensaje de WhatsApp legible con:
     * Encabezado: "📋 Resumen de pedido — Semana del 6 al 10 de abril"
     * Para cada día: nombre del día, lista de opciones con cantidades
     * Total de viandas del día
     * Total semanal
     * Advertencias si hay anomalías
     * Footer: "Respondé *confirmo* para confirmar o *cancelar* para anular"

3. src/lib/whatsapp/receive-message.ts:
   - Función processIncomingMessage(body: TwilioWebhookBody):
     * Extrae: From (teléfono), Body (texto), NumMedia, MediaUrl0, MediaContentType0
     * Identifica tipo de mensaje:
       - Tiene archivo adjunto Excel → PROCESS_EXCEL
       - Texto contiene "confirmo|ok|dale|listo|sí|si" → CONFIRM_ORDER
       - Texto contiene "cancelar|anular|no" → CANCEL_ORDER
       - Cualquier otra cosa → HELP
   - Función identifyClient(phone: string): busca en users por phone, retorna user + organization

4. src/lib/orders/events.ts:
   - Función createOrderEvent(orderId, eventType, actorId, actorRole, payload, isPostCutoff): inserta en order_events
   - Tipos de payload según event_type

5. src/app/api/webhook/whatsapp/route.ts — El webhook principal:
   - POST handler que:
     * Valida la firma de Twilio (seguridad)
     * Procesa el mensaje con receive-message.ts
     * Para PROCESS_EXCEL:
       1. Descarga el archivo del MediaUrl0
       2. Parsea con sheina-parser + claude-client
       3. Identifica al cliente por teléfono
       4. Crea order (status: draft, source: whatsapp_excel) con todas las order_lines
       5. Crea order_event tipo 'created'
       6. Guarda el Excel original en Supabase Storage
       7. Envía resumen formateado por WhatsApp
     * Para CONFIRM_ORDER:
       1. Busca el último order en estado 'draft' del cliente
       2. Si no hay → envía "No encontré un pedido pendiente"
       3. Actualiza status a 'confirmed', confirmed_at, confirmed_by
       4. Crea order_event tipo 'confirmed'
       5. Envía confirmación: "✅ Pedido confirmado! Total: X viandas"
     * Para CANCEL_ORDER:
       1. Busca último order draft/confirmed del cliente
       2. Verifica ventana de corte (si es confirmed)
       3. Actualiza status a 'cancelled'
       4. Crea order_event tipo 'cancelled'
       5. Envía confirmación de cancelación
     * Para HELP:
       1. Envía instrucciones: "Enviame tu Excel de pedidos y lo proceso automáticamente..."
   - Retorna TwiML response vacía (200 OK)

Importante: el webhook debe responder en menos de 15 segundos (límite de Twilio). Si el parsing toma más tiempo, enviar un mensaje inmediato "Recibí tu archivo, estoy procesándolo..." y luego el resumen.
```

---

## PROMPT 6: Componentes UI base (1 hora)

```
Creá los componentes UI base reutilizables con Tailwind CSS. Estilo limpio, profesional, con la paleta cálida de Sheina.

1. src/app/globals.css — Configurar variables CSS de la paleta:
   - Primary: #D4622B (terracota)
   - Primary light: #E8943A
   - Dark: #1A2332
   - Background: #F7F4EF (crema)
   - Surface: #FFFFFF
   - Text: #2D3436
   - Muted: #6B7B8D
   - Success: #27AE60
   - Warning: #F39C12
   - Danger: #E74C3C
   - Info: #2E86C1

2. Actualizar tailwind.config.ts para incluir estos colores custom.

3. Componentes en src/components/ui/ — Cada uno con variantes:
   - button.tsx: variantes primary, secondary, ghost, danger. Tamaños sm, md, lg. Con loading state.
   - input.tsx: con label, error message, helper text. Variante para números con +/- buttons.
   - select.tsx: dropdown con opciones tipadas.
   - badge.tsx: variantes para los estados de pedido (draft=gris, confirmed=azul, in_production=naranja, delivered=verde, cancelled=rojo).
   - card.tsx: contenedor con shadow sutil y border.
   - table.tsx: tabla responsiva con header sticky, filas hover, soporte para acciones por fila.
   - dialog.tsx: modal con overlay, título, contenido, botones de acción. Usar portal.
   - toast.tsx: notificación temporal (success, error, warning, info). Auto-dismiss en 5 segundos.
   - loading.tsx: spinner + skeleton loader para tablas y cards.
   - page-header.tsx: título de página con breadcrumbs opcionales y botón de acción derecho.

4. src/components/layout/sidebar.tsx:
   - Logo de Sheina arriba (texto por ahora)
   - Links de navegación: Inicio, Pedidos, Menús, Recetas, Inventario, Clientes
   - Cada link con icono de lucide-react
   - Indicador de ruta activa (borde izquierdo terracota)
   - Colapsable en mobile (hamburger menu)
   - Fijo en desktop (w-64)

5. src/components/layout/header.tsx:
   - Nombre de usuario actual a la derecha
   - Botón de cerrar sesión
   - Badge de notificaciones (count de pedidos pendientes)

6. src/app/(dashboard)/layout.tsx:
   - Server Component que verifica sesión
   - Si no hay sesión → redirect a /login
   - Layout: sidebar fijo a la izquierda + contenido principal a la derecha
   - Header arriba del contenido
```

---

## PROMPT 7: Auth — Login y protección de rutas (30 min)

```
Implementá la autenticación con Supabase Auth.

1. src/app/(auth)/login/page.tsx:
   - Formulario de login con email + contraseña
   - Botón "Ingresar" que llama a supabase.auth.signInWithPassword
   - Manejo de errores (credenciales inválidas)
   - Redirect a /pedidos después de login exitoso
   - Estilo: card centrada en la pantalla, logo arriba, fondo crema

2. src/app/(auth)/layout.tsx:
   - Layout limpio sin sidebar
   - Si ya hay sesión → redirect a /pedidos

3. Actualizar src/middleware.ts:
   - Refrescar sesión en cada request
   - Si la ruta es (dashboard)/* y no hay sesión → redirect a /login
   - Si la ruta es /login y hay sesión → redirect a /pedidos

4. src/hooks/use-supabase.ts:
   - Hook que provee el cliente Supabase del browser
   - Expone user, session, signOut

5. Crear un usuario de prueba en Supabase Auth (admin@sheina.com) y vincularlo con el registro de users en la seed data.
```

---

## PROMPT 8: Vista de pedidos (1.5 horas)

```
Construí la vista principal de pedidos — la pantalla que el operador de Sheina va a vivir mirando.

1. src/app/(dashboard)/page.tsx — Dashboard principal:
   - 4 tarjetas métricas arriba: "Pedidos hoy" (count), "Viandas a producir" (sum), "Pendientes de confirmar" (count draft), "Pagos pendientes" (count pending)
   - Datos cargados en Server Component con supabase server client
   - Link a /pedidos desde cada tarjeta

2. src/app/(dashboard)/pedidos/page.tsx — Lista de pedidos:
   - Server Component que carga pedidos con joins (organization.name, total_units, status, source, created_at)
   - Filtros inline: por estado (tabs: Todos | Borrador | Confirmados | En producción | Entregados), por semana (selector), por cliente (dropdown)
   - Tabla con columnas: Cliente, Semana, Estado (badge), Viandas, Fuente (badge), Fecha, Acciones
   - Fuente muestra ícono: WhatsApp, Web, Teléfono
   - Acción rápida: botón "Confirmar" para drafts, "A producción" para confirmados
   - Click en fila navega a /pedidos/[id]
   - Ordenamiento por fecha descendente

3. src/app/(dashboard)/pedidos/[id]/page.tsx — Detalle de pedido:
   - Header: nombre del cliente, semana, badge de estado, fuente del pedido
   - Barra de acciones según estado:
     * draft: Confirmar | Cancelar
     * confirmed: A producción | Cancelar (solo si pre-corte o admin)
     * in_production: Marcar entregado
   - Sección "Detalle del pedido":
     * Agrupado por día (Lunes, Martes, etc.)
     * Para cada día: tabla con Opción | Plato | General | Adm | Vtas | Diet | Log | Otros | Total
     * Total del día al final
     * Si el pedido es editable (draft o confirmed pre-corte): las celdas de cantidad son inputs editables
     * Botón "Guardar cambios" que actualiza las order_lines y crea un order_event tipo 'line_modified'
     * Si es post-corte: al guardar pide un motivo obligatorio (textarea) y crea event con is_post_cutoff=true
   - Sección "Historial de cambios":
     * Timeline vertical con todos los order_events
     * Cada evento: ícono + descripción + actor + fecha/hora + badge "post-corte" si aplica
     * Los más recientes arriba

4. src/lib/orders/state-machine.ts:
   - Función getAvailableTransitions(currentStatus, userRole, isWithinCutoff): retorna las transiciones permitidas
   - Función transitionOrder(orderId, newStatus, actorId, actorRole, reason?): ejecuta la transición si es válida

5. src/lib/orders/cutoff.ts:
   - Función isWithinCutoff(order, organization): calcula si el pedido está dentro de la ventana de corte
   - Usa date-fns para el cálculo
```

---

## PROMPT 9: ABM de menús (1 hora)

```
Construí el módulo de gestión de menús semanales.

1. src/app/(dashboard)/menus/page.tsx — Lista de menús:
   - Tabla: Semana (fecha inicio - fin), Número de semana, Estado (badge), Opciones cargadas (count), Acciones
   - Botón "Nuevo menú" que abre un dialog para crear: fecha inicio (date picker), se calcula automáticamente fecha fin (+4 días hábiles)
   - Botón "Duplicar" que crea un nuevo menú copiando todas las opciones de uno existente

2. src/app/(dashboard)/menus/[id]/page.tsx — Editor de menú:
   - Header: semana, estado, botón "Publicar" (cambia status a published)
   - 5 pestañas: Lunes | Martes | Miércoles | Jueves | Viernes
   - Cada pestaña muestra las opciones del día en una tabla editable:
     * Código (auto-generado), Nombre del plato (input text), Categoría (select con enums), Receta vinculada (autocomplete que busca en recipes), Disponible (toggle)
   - Botón "Agregar opción" al final de cada día
   - Botón "Quitar" por opción (con confirmación)
   - Auto-save al cambiar cualquier campo (con debounce de 500ms y toast de confirmación)

3. src/hooks/use-menus.ts:
   - useMenus(): lista de menús con filtros
   - useMenu(id): menú con items, funciones CRUD
   - createMenu, updateMenuItem, deleteMenuItem, publishMenu, duplicateMenu
```

---

## PROMPT 10: ABM de recetas con versionado (1 hora)

```
Construí el módulo de recetas con fichas técnicas y versionado.

1. src/app/(dashboard)/recetas/page.tsx — Lista de recetas:
   - Tabla: Nombre, Categoría (badge), Versión actual, Costo/porción (formateado $), Estado, Acciones
   - Búsqueda por nombre
   - Filtro por categoría
   - Botón "Nueva receta"
   - Click en fila navega al detalle

2. src/app/(dashboard)/recetas/[id]/page.tsx — Ficha técnica:
   - Header: nombre, categoría, badge versión actual, costo por porción destacado grande
   - Sección "Ingredientes" (tabla editable):
     * Columnas: Insumo (autocomplete que busca en inventory_items), Cantidad, Unidad, Sustituto (autocomplete opcional), Costo parcial (calculado: cantidad * costo_unitario / portions_yield)
     * Fila de total al final
     * Botón "Agregar ingrediente"
     * Botón "Quitar" por fila
   - Campo "Rendimiento" (porciones que rinde la receta)
   - Campo "Notas de preparación" (textarea)
   - Botón "Guardar cambios":
     * Si hay cambios en ingredientes o rendimiento → crea nueva recipe_version (mostrar dialog: "Esto creará la versión X. ¿Continuar?")
     * Si solo cambian notas → actualiza la versión actual
   - Sección "Historial de versiones":
     * Lista de todas las versiones: número, fecha, costo/porción, quién la creó
     * Click en una versión muestra los ingredientes de esa versión (solo lectura)

3. src/lib/recipes/versioning.ts:
   - Función createNewVersion(recipeId, ingredients, portionsYield, notes, actorId):
     * Marca is_current=false en la versión actual
     * Crea nueva recipe_version con version=max+1, is_current=true
     * Copia los recipe_ingredients con las modificaciones
     * Recalcula cost_per_portion

4. src/lib/recipes/cost-calculator.ts:
   - Función calculateCostPerPortion(ingredients, portionsYield): suma (qty * costPerUnit) / yield
```

---

## PROMPT 11: ABM de inventario (1 hora)

```
Construí el módulo de inventario con movimientos trazables.

1. src/app/(dashboard)/inventario/page.tsx — Lista de insumos:
   - Tarjetas resumen arriba: "Total insumos activos", "Con stock bajo", "Últimos movimientos hoy"
   - Tabla: Nombre, Categoría (badge), Stock actual (con color rojo si < min_stock), Unidad, Costo/unidad, Proveedor, Acciones
   - Fila con fondo rojo suave si stock < min_stock
   - Filtro por categoría
   - Búsqueda por nombre
   - Botón "Nuevo insumo": dialog con formulario (nombre, categoría, unidad, stock inicial, stock mínimo, costo unitario, proveedor)
   - Al crear: inserta inventory_item + inventory_movement tipo adjustment_pos

2. src/app/(dashboard)/inventario/[id]/page.tsx — Detalle de insumo:
   - Header: nombre, categoría, stock actual (número grande), unidad, alerta si bajo mínimo
   - Card de datos editables: nombre, categoría, proveedor, stock mínimo, costo unitario. Botón guardar.
   - Sección "Registrar movimiento":
     * Select tipo: Compra, Merma, Ajuste positivo, Ajuste negativo, Devolución
     * Input cantidad
     * Input costo unitario (pre-llenado con el actual)
     * Textarea motivo (obligatorio para ajustes)
     * Botón "Registrar" → crea inventory_movement, actualiza current_stock, toast de confirmación
   - Sección "Historial de movimientos":
     * Tabla cronológica (más reciente primero): Fecha, Tipo (badge con color), Cantidad (+/-), Costo, Stock resultante, Motivo, Usuario
   - Botón "Desactivar insumo" (footer):
     * Si tiene recetas activas → dialog de advertencia listando las recetas afectadas
     * Si no tiene → confirmación simple
     * Soft delete: is_active = false

3. src/lib/inventory/movements.ts:
   - Función registerMovement(input: CreateMovementInput):
     * Inserta inventory_movement
     * Actualiza current_stock (sumando o restando según tipo)
     * Retorna el movimiento creado con stock_after

4. src/lib/inventory/alerts.ts:
   - Función getLowStockItems(): retorna items con current_stock < min_stock
   - Función getItemsUsedInRecipes(itemId): retorna recetas activas que usan este insumo
```

---

## PROMPT 12: Testing y polish (1 hora)

```
Revisá todo el proyecto, arreglá errores y hacé polish final.

1. Verificá que todas las rutas funcionan sin errores de TypeScript.
2. Verificá que el build pasa: npm run build
3. Arreglá cualquier error de tipo, import, o runtime.
4. Revisá que todos los formularios tienen:
   - Validación con zod
   - Loading state en los botones de submit
   - Toast de confirmación o error
   - Manejo de errores con try/catch
5. Revisá que las tablas tienen:
   - Estado vacío ("No hay pedidos aún")
   - Loading skeleton mientras cargan
6. Agregá un page.tsx a /clientes con una lista básica de organizaciones (readonly para MVP).
7. Verificá que el middleware redirige correctamente:
   - /login con sesión → /pedidos
   - /pedidos sin sesión → /login
8. Revisá la responsividad: sidebar colapsable, tablas scrolleables en mobile.
9. Hacé un commit final: "feat: MVP complete — bot WhatsApp + dashboard admin + ABM"
```

---

## NOTAS PARA EL DESARROLLADOR

### Orden de ejecución recomendado
1. Prompts 1-2: Setup y base de datos (Día 1)
2. Prompt 3: Tipos TypeScript (Día 1)
3. Prompts 4-5: Parser de Excel y Bot WhatsApp (Días 2-3)
4. Prompts 6-7: UI base y Auth (Día 4)
5. Prompt 8: Vista de pedidos (Día 5)
6. Prompts 9-10: Menús y Recetas (Día 6)
7. Prompt 11: Inventario (Día 7)
8. Prompt 12: Testing y polish (Día 7)

### Si Claude Code se traba o genera errores
- Pedile que ejecute `npm run build` y que arregle los errores que aparezcan
- Si un componente es muy complejo, pedile que lo divida en partes más pequeñas
- Si hay errores de tipos, pedile: "Corregí todos los errores de TypeScript del proyecto"

### Después del MVP
- Configurar webhook real de Twilio con la URL de Vercel
- Crear usuario admin real en Supabase Auth
- Cargar datos reales de Sheina (insumos, recetas, menú actual)
- Testear con el Excel real del cliente
- Iterar sobre feedback
