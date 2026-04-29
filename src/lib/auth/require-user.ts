import { createSupabaseServer, createSupabaseAdmin } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types/database";

export class AuthError extends Error {
  constructor(message: string, public readonly status = 401) {
    super(message);
    this.name = "AuthError";
  }
}

export interface AuthedUser {
  authId: string;
  id: string;
  role: UserRole;
  organizationId: string | null;
  fullName: string | null;
}

const ADMIN_ROLES: UserRole[] = ["superadmin", "admin", "operator"];

/**
 * Resuelve el usuario autenticado a partir de la sesión del server
 * y devuelve su registro interno en `users`. Lanza AuthError si no hay
 * sesión o si el usuario no existe en la tabla `users`.
 *
 * Usar SIEMPRE al inicio de un Server Action para obtener el actor.
 */
export async function requireUser(): Promise<AuthedUser> {
  const supabase = await createSupabaseServer();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    throw new AuthError("No autenticado", 401);
  }

  const admin = await createSupabaseAdmin();
  const { data: record, error } = await admin
    .from("users")
    .select("id, role, organization_id, full_name, is_active")
    .eq("auth_id", authUser.id)
    .maybeSingle();

  if (error || !record) {
    throw new AuthError("Usuario no registrado", 403);
  }
  if (!record.is_active) {
    throw new AuthError("Usuario inactivo", 403);
  }

  return {
    authId: authUser.id,
    id: record.id,
    role: record.role as UserRole,
    organizationId: record.organization_id,
    fullName: record.full_name,
  };
}

/**
 * Como requireUser, pero además verifica que el rol sea admin/operador.
 * Lanza AuthError con 403 si el usuario es cliente.
 */
export async function requireAdmin(): Promise<AuthedUser> {
  const user = await requireUser();
  if (!ADMIN_ROLES.includes(user.role)) {
    throw new AuthError("Se requiere rol de administrador", 403);
  }
  return user;
}

export function isAdminRole(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role);
}
