# Migraciones v1 archivadas

Estos 13 archivos `.sql` corresponden a la versión 1 de FoodSync ERP. Se
aplicaron en su momento vía `supabase migration up` CLI, pero NUNCA fueron
registrados en la tabla `supabase_migrations.schema_migrations` del proyecto
`zenlpuiaavdgeyplfcma`.

Su efecto acumulado YA está en la BD actual de producción (tablas `users`,
`orders`, `inventory_items`, etc.). No re-aplicar.

Se mueven a este subdirectorio para que:
- Supabase CLI los ignore al hacer `db reset`
- El check de drift del Protocolo §11.7 no genere falsos positivos
- La traza histórica del schema v1 se preserve

Relación con migraciones vigentes:
- `001_extensions_and_enums.sql` → reemplazada por `017_foodsync_enums_extension.sql`
- `002_tables.sql` → reemplazada por `019_foodsync_core_tables.sql`
- `003_indexes.sql` → consolidada en `019_foodsync_core_tables.sql` y subsiguientes
- `004_rls_policies.sql` → reemplazada por `024_foodsync_rls_policies.sql`
- `005_functions.sql` → reemplazada por `023_foodsync_views_and_functions.sql`
- `006_seed_data.sql` → reemplazada por `025_foodsync_reset_demo_and_seed.sql`
- `007_auth_user_setup.sql` → consolidada en `024_foodsync_rls_policies.sql`
- `008_private_storage.sql` → consolidada en `20260427234705_e2_orders_cutoff_at.sql`
- `009_fix_rls.sql` → consolidada en bloque RLS f1 (4 migraciones)
- `010_fix_auth_user.sql` → consolidada en `20260428133854_h6_real_fix_users_self_select_rls.sql`
- `011_reseed_data.sql` → reemplazada por `025_foodsync_reset_demo_and_seed.sql` y `20260428144210_j1_reseed_menu_dates_to_future.sql`
- `012_mvp_fix.sql` → patches MVP, ya absorbidos
- `016_message_sid.sql` → consolidado en `021_foodsync_messaging_hub.sql`

Audit reference: docs/audits/AUDIT_PRE_CD_28042026.md (commit bc14e13)
Migration restore reference: chore/restore-orphan-migrations (commit 96a680e)
