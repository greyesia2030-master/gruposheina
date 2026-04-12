-- 007: Vinculación del usuario admin con Supabase Auth
-- =====================================================================
-- IMPORTANTE: ejecutar DESPUÉS de crear el usuario en el panel de
-- Supabase Auth (Authentication → Users → "Invite user" o "Add user").
--
-- Email:      admin@sheina.com
-- Password:   (definirla al crear en el panel — mínimo 8 caracteres)
-- =====================================================================

-- Paso 1: crear el usuario en Auth desde SQL (solo funciona en entornos
-- con acceso a auth.users, p. ej. desde el SQL Editor de Supabase).
-- Si ya lo creaste desde el panel, saltá al Paso 2.

-- OPCIÓN A — crear usuario con contraseña desde SQL:
-- (Descomentar y reemplazar <PASSWORD_HASH> por el bcrypt del password)
--
-- INSERT INTO auth.users (
--   id, email, encrypted_password, email_confirmed_at,
--   created_at, updated_at, raw_app_meta_data, raw_user_meta_data, role
-- ) VALUES (
--   'auth-admin-sheina-000000000001',  -- UUID fijo para facilitar el vínculo
--   'admin@sheina.com',
--   crypt('Sheina2025!', gen_salt('bf')),
--   now(), now(), now(),
--   '{"provider":"email","providers":["email"]}',
--   '{"full_name":"Administrador Sheina"}',
--   'authenticated'
-- );

-- =====================================================================
-- Paso 2: vincular el auth.users.id con users.auth_id
-- Reemplazá <AUTH_UUID> por el UUID real del usuario creado en Auth.
-- =====================================================================

-- UPDATE users
-- SET auth_id = '<AUTH_UUID>'
-- WHERE email = 'admin@sheina.com';

-- =====================================================================
-- Paso 3 (alternativa automática): usar la función de Supabase para
-- crear el usuario desde una Edge Function o script de setup.
-- Ver: https://supabase.com/docs/reference/javascript/auth-admin-createuser
-- =====================================================================

-- HELPER: una vez que tenés el auth_id, este query lo vincula:
--
--   UPDATE users
--   SET auth_id = auth.users.id
--   FROM auth.users
--   WHERE auth.users.email = users.email
--     AND users.email IN ('admin@sheina.com', 'pedidos@pymedemo.com.ar');
--
-- Ese query vincula todos los usuarios cuyo email exista en ambas tablas,
-- sin necesidad de conocer el UUID de antemano.

-- =====================================================================
-- Verificación post-setup
-- =====================================================================
-- SELECT u.id, u.email, u.role, u.auth_id, au.email AS auth_email
-- FROM users u
-- LEFT JOIN auth.users au ON au.id = u.auth_id
-- WHERE u.email = 'admin@sheina.com';
