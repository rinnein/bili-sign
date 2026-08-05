export function isAdminRole(role: unknown) {
  return (
    typeof role === 'string' &&
    role
      .split(',')
      .map((value) => value.trim())
      .includes('admin')
  )
}

const PENDING_ADMIN_ROLE = 'admin_pending'

export function isPendingAdminRole(role: unknown) {
  return (
    typeof role === 'string' &&
    role
      .split(',')
      .map((value) => value.trim())
      .includes(PENDING_ADMIN_ROLE)
  )
}
