# Migraciones huérfanas recuperadas — FoodSync ERP

**Fecha:** 28/04/2026
**Origen:** `supabase_migrations.schema_migrations` del proyecto `zenlpuiaavdgeyplfcma` (live BD)
**Total:** 34 archivos · ~52KB

## Por qué existen estos archivos

El audit `AUDIT_PRE_CD_28042026.md` (commit `bc14e13`) detectó schema drift entre el código TypeScript y los archivos de migración del repo. Investigando vía MCP Supabase, se confirmó que el "drift" no era código vs BD, sino **repo vs BD**: la BD tenía 46 migraciones aplicadas, el repo solo tenía 13 archivos (`007-016` + 3 legacy `013-015`). Las 34 restantes fueron aplicadas vía MCP durante las capas B, C parcial, D parcial, F y los fix-M, pero **nunca se commitearon como `.sql`**.

Estos archivos son la versión recuperada de esas 34 migraciones. El SQL es **idéntico** al aplicado en producción (extraído del campo `statements` de `supabase_migrations.schema_migrations`).

## Cómo usarlos

### 1. Copiar al repo

```bash
cp /mnt/user-data/outputs/supabase-migrations-restore/*.sql \
   /ruta/al/repo/supabase/migrations/
```

### 2. Verificar que no rompen nada

```bash
cd /ruta/al/repo
git status        # Debe mostrar 34 archivos nuevos en supabase/migrations/
git diff --stat   # Solo adds, ninguna modificación
```

### 3. Validar contra BD (opcional pero recomendado)

Crear branch de Supabase efímera y aplicar todas las migraciones contra una BD limpia:

```bash
# Vía Supabase CLI (si está configurada)
supabase db reset --db-url <URL_BRANCH>

# O usar Supabase:create_branch desde MCP en la próxima sesión
```

Si construye igual que producción, el repo está saneado.

### 4. Commit en branch separada

```bash
git checkout -b chore/restore-orphan-migrations
git add supabase/migrations/
git commit -m "chore: restore 34 orphan migrations from production BD

Recuperadas desde supabase_migrations.schema_migrations del proyecto
zenlpuiaavdgeyplfcma. Estas migraciones fueron aplicadas vía MCP durante
las capas B, C parcial, D parcial, F y los fix-M, pero nunca se
commitearon como archivos .sql al repo.

Sin estos archivos, un \`supabase db reset\` o un branch limpio resulta
en un schema incompleto. Con ellos, el repo es la fuente de verdad
reproducible.

Audit reference: docs/audits/AUDIT_PRE_CD_28042026.md (bc14e13)"
git push -u origin chore/restore-orphan-migrations
```

## Lista de migraciones recuperadas

Agrupadas por capa funcional:

### Capa B (formulario colaborativo + Hub) — 11 migraciones

| Archivo | Propósito |
|---|---|
| `20260425160755_b8_add_participant_contact_and_authorization.sql` | Campos de contacto + autorización en `order_participants` |
| `20260425160852_b8_add_require_contact_to_form_tokens.sql` | Flag `require_contact` en `order_form_tokens` |
| `20260425164348_b9_trigger_update_order_totals.sql` | Trigger `fn_update_order_totals` |
| `20260425171444_b10_client_departments.sql` | Tablas `client_departments` + `client_department_events` |
| `20260425192227_b13_organization_timezone.sql` | `organizations.timezone` + funciones `fn_org_now` y `fn_is_past_cutoff` |
| `20260426005139_b14_order_code.sql` | Columna `orders.order_code` + función + trigger |
| `20260426233250_b15_1_update_participant_totals.sql` | Extiende trigger para mantener `participant.total_quantity` |
| `20260427180524_d6_admin_override_columns.sql` | Columnas de override admin en `order_lines` |
| `20260427195441_e1_users_client_department.sql` | `users.client_department_id` |
| `20260427195856_d6_fix_quantity_constraint_for_overrides.sql` | Constraint que permite quantity negativa solo en overrides |
| `20260427234705_e2_orders_cutoff_at.sql` | `orders.cutoff_at` + bucket `menu-photos` |

### Capa C parcial (PWA + lotes) — 6 migraciones

| Archivo | Propósito |
|---|---|
| `20260426145308_c13_push_subscriptions.sql` | Tabla `push_subscriptions` |
| `20260428142739_i1_consume_inventory_for_production_hybrid.sql` | Función RPC FIFO (versión 1) |
| `20260428142905_i1_seed_inventory_lots_for_demo_v3.sql` | Seed de 22 lotes de demo |
| `20260428142941_i1_fix_consume_inventory_movement_type.sql` | Fix movement_type (versión 2) |
| `20260428174607_fix_consume_inventory_remove_is_depleted_set.sql` | Fix is_depleted generated column (versión 3) |
| `20260428174634_fix_consume_inventory_add_stock_after.sql` | Fix stock_after en movement (versión 4, vigente) |

### Fixes y rename — 3 migraciones

| Archivo | Propósito |
|---|---|
| `20260428004848_e2_rename_cutoff_at_to_custom.sql` | Rename `cutoff_at` → `custom_cutoff_at` |
| `20260428040544_h5_add_returned_event_type.sql` | Enum `event_type.returned` |
| `20260428041110_h_pre_fix_generate_order_code_uses_menu.sql` | Fix generate_order_code para usar week_number del menu |

### RLS fixes — 4 migraciones

| Archivo | Propósito |
|---|---|
| `20260425193110_f1_fix_form_tokens_orders_fk.sql` | FK explícita order_form_tokens → orders |
| `20260425203340_f1_inventory_rls_policies.sql` | RLS policies para inventory_items y inventory_movements |
| `20260425203728_f1_drop_orphan_inventory_policies.sql` | Limpieza policies con is_admin() inexistente |
| `20260425203750_f1_create_is_admin_function.sql` | Crea función `is_admin()` |
| `20260428133854_h6_real_fix_users_self_select_rls.sql` | RLS users self-select para kitchen/warehouse |

### Capa D parcial (notificaciones + auto-promote) — 3 migraciones

| Archivo | Propósito |
|---|---|
| `20260428175059_l1_auto_deliver_when_all_tickets_ready.sql` | Trigger auto-promote a `delivered` (luego revertido por fix-M) |
| `20260428175114_l2_create_notifications_table.sql` | Tabla `user_notifications` |
| `20260428175127_l3_emit_notif_when_order_delivered.sql` | Trigger notificación al entregar |

### Reseed datos demo — 1 migración

| Archivo | Propósito |
|---|---|
| `20260428144210_j1_reseed_menu_dates_to_future.sql` | Mueve fechas de menús S15→S19 y S16→S20 a futuras |

### FIX-M (logística) — 5 migraciones

| Archivo | Propósito |
|---|---|
| `20260428212235_fix_m_extend_order_status_logistics.sql` | Enum `order_status.ready_for_delivery` y `out_for_delivery` |
| `20260428212247_fix_m_trigger_promote_to_ready_for_delivery.sql` | Cambia auto-promote: `in_production` → `ready_for_delivery` (no `delivered`) |
| `20260428212319_fix_m_add_logistics_timestamps.sql` | Timestamps de logística en `orders` |
| `20260428212350_fix_m_realign_notification_triggers.sql` | Realinea triggers de notificación |
| `20260429000945_fix_m_extend_event_type_enum.sql` | Enum `event_type.ready_for_delivery` y `dispatched` |

## Notas técnicas

- **Cronología preservada**: el `version` (timestamp) coincide con el momento real de aplicación en BD. Si reseteás la BD y reaplicás estos archivos en orden, llegás al mismo estado que producción.
- **Migraciones encadenadas**: las funciones `consume_inventory_for_production` y `trg_check_all_tickets_ready` tienen 4 y 2 versiones respectivamente. La versión final es la vigente en producción. **No omitir las intermedias**: alguna podría ser dependencia transitoria de migraciones siguientes.
- **Seed de lotes**: `i1_seed_inventory_lots_for_demo_v3.sql` usa UUIDs hardcodeados (`c0000000-0000-...`). Si tu BD limpia no tiene esos `inventory_items`, fallará. El seed asume que los items 001-008, 010, 011, 015 ya existen (probablemente seedeados en `foodsync_015_reset_demo_and_seed.sql`).
- **Site UUID hardcodeado**: el seed apunta a site `0d366122-9daa-4650-bab4-3fe2c3b31cc9`. Si esa site no existe en tu BD limpia, también fallará.

## Verificación post-restore

Después de copiar y commitear, esta query debe devolver 0 filas (cero migraciones en BD que no estén en el repo):

```sql
SELECT version, name 
FROM supabase_migrations.schema_migrations 
WHERE version || '_' || name NOT IN (
  -- Lista de archivos en /supabase/migrations/ sin extensión .sql
  -- Ejecutar este SELECT en una sesión MCP después del commit
  ...
);
```

O simplemente:

```bash
ls supabase/migrations/*.sql | wc -l
# Debe coincidir con: SELECT count(*) FROM supabase_migrations.schema_migrations;
```
