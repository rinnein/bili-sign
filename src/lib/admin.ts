import type { BetterAuthOptions, DBAdapter } from 'better-auth'

export const ADMIN_ROLE = 'admin'
export const PENDING_ADMIN_ROLE = 'admin_pending'
export const ADMIN_BOOTSTRAP_EMAIL = 'admin-bootstrap@invalid.local'
export const ADMIN_BOOTSTRAP_RESERVATION = 'bili-sign:admin-bootstrap'
export const ADMIN_INITIALIZATION_RESERVATION = 'bili-sign:admin-initialization'
export const ADMIN_BOOTSTRAP_TTL_MS = 15 * 60 * 1000

export type RoleUser = {
  id: string
  role?: unknown
  createdAt?: Date | string
}

export function findAdminUser<Options extends BetterAuthOptions>(
  adapter: DBAdapter<Options>,
) {
  return adapter.findOne<RoleUser>({
    model: 'user',
    where: [{ field: 'role', value: ADMIN_ROLE, operator: 'eq' }],
    select: ['id', 'role'],
  })
}

export function findPendingAdminUser<Options extends BetterAuthOptions>(
  adapter: DBAdapter<Options>,
) {
  return adapter.findOne<RoleUser>({
    model: 'user',
    where: [{ field: 'role', value: PENDING_ADMIN_ROLE, operator: 'contains' }],
    select: ['id', 'role', 'createdAt'],
  })
}

export function getUserRole(user: unknown) {
  if (typeof user !== 'object' || user === null || !('role' in user)) {
    return undefined
  }
  return user.role
}

function hasRole(role: unknown, expectedRole: string) {
  return (
    typeof role === 'string' &&
    role
      .split(',')
      .map((value) => value.trim())
      .includes(expectedRole)
  )
}

export function isAdminRole(role: unknown) {
  return hasRole(role, ADMIN_ROLE)
}

export function isPendingAdminRole(role: unknown) {
  return hasRole(role, PENDING_ADMIN_ROLE)
}
