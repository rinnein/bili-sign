export const ADMIN_ROLE = 'admin'
export const PENDING_ADMIN_ROLE = 'admin_pending'
export const ADMIN_BOOTSTRAP_EMAIL = 'admin-bootstrap@invalid.local'
export const ADMIN_INITIALIZATION_RESERVATION = 'bili-sign:admin-initialization'

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
