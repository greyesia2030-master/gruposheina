# Security Policy

## Acción requerida por Gerardo — Repositorio Público

Este repositorio está actualmente configurado como **público** en GitHub.
El código no contiene secretos hardcodeados, pero la lógica de negocio y los
prompts de IA quedan expuestos. Se recomienda convertirlo a privado.

**Pasos:**
1. Ir a: github.com/greyesia2030-master/gruposheina → **Settings**
2. Scroll hasta **Danger Zone**
3. Click **Change repository visibility** → **Make private**
4. Confirmar con el nombre del repositorio

## Secretos y Variables de Entorno

Todos los secretos se manejan vía variables de entorno. **Nunca** commitear:
- `.env.local` (ignorado en `.gitignore`)
- API keys, tokens, passwords

Variables requeridas en Vercel (Settings → Environment Variables):
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_WHATSAPP_FROM
```

## Reporte de Vulnerabilidades

Reportar issues de seguridad directamente a Gerardo, no crear GitHub Issues públicos.
