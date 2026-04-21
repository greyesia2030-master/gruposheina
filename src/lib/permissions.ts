import type { UserRole } from '@/lib/types/database';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  superadmin: 5,
  admin: 4,
  operator: 3,
  kitchen: 2,
  warehouse: 2,
  client_admin: 2,
  client_user: 1,
};

export function hasRole(role: UserRole, minRole: UserRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole];
}

// --- Financials ---
/** Operadores y superiores pueden ver costos de insumos/recetas */
export const canViewCost = (r: UserRole) => hasRole(r, 'operator');
/** Solo admin y superiores ven precios de venta */
export const canViewSalePrice = (r: UserRole) => hasRole(r, 'admin');
/** Solo admin y superiores pueden editar precios de venta */
export const canEditSalePrice = (r: UserRole) => hasRole(r, 'admin');

// --- Pedidos ---
/** Cualquier usuario puede confirmar su pedido */
export const canConfirmOrder = (r: UserRole) => hasRole(r, 'client_user');
/** Solo admins pueden cancelar después del corte */
export const canCancelAfterCutoff = (r: UserRole) => hasRole(r, 'admin');
/** Solo admins pueden hacer override post-corte */
export const canOverrideOrder = (r: UserRole) => hasRole(r, 'admin');
/** Operadores y superiores pueden pasar a in_production */
export const canSetInProduction = (r: UserRole) => hasRole(r, 'operator');
/** Operadores y superiores pueden marcar como entregado */
export const canSetDelivered = (r: UserRole) => hasRole(r, 'operator');

// --- Panel de administración ---
/** Operadores y superiores acceden al panel admin */
export const canAccessAdmin = (r: UserRole) => hasRole(r, 'operator');
/** Admins y superiores gestionan clientes */
export const canManageClients = (r: UserRole) => hasRole(r, 'admin');
/** Solo superadmin gestiona usuarios internos */
export const canManageUsers = (r: UserRole) => hasRole(r, 'superadmin');
/** Admins y superiores ven reportes financieros */
export const canViewReports = (r: UserRole) => hasRole(r, 'admin');

// --- Guards para server actions ---
export function requireAdmin(role: UserRole): void {
  if (!hasRole(role, 'admin')) {
    throw new Error('Unauthorized: se requiere rol admin o superior');
  }
}

export function requireOperator(role: UserRole): void {
  if (!hasRole(role, 'operator')) {
    throw new Error('Unauthorized: se requiere rol operator o superior');
  }
}

export function requireSuperAdmin(role: UserRole): void {
  if (!hasRole(role, 'superadmin')) {
    throw new Error('Unauthorized: se requiere rol superadmin');
  }
}
