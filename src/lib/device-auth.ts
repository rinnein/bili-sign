export const DEVICE_AUTH_CLIENT_ID = 'bili-sign-web'
export const DEVICE_AUTH_SCOPE = 'openid profile'
export const DEVICE_AUTH_USER_CODE_LENGTH = 8
export const DEVICE_AUTH_GRANT_TYPE =
  'urn:ietf:params:oauth:grant-type:device_code'

export function deviceAuthErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== 'object') return fallback
  const record = error as Record<string, unknown>
  const message =
    typeof record.message === 'string'
      ? record.message
      : typeof record.error_description === 'string'
        ? record.error_description
        : typeof record.error === 'string'
          ? record.error
          : ''
  return message || fallback
}

export function deviceAuthErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') return ''
  const record = error as Record<string, unknown>
  if (typeof record.error === 'string') return record.error
  if (typeof record.code === 'string') return record.code
  return ''
}

export function normalizeDeviceUserCode(value: string) {
  return value.trim().replace(/[\s-]/g, '').toUpperCase()
}

export function extractDeviceUserCodeFromQr(value: string) {
  try {
    const url = new URL(value.trim())
    if (url.pathname !== '/login' && url.pathname !== '/device/confirm') {
      return null
    }
    const userCode = url.searchParams.get('user_code')
    if (!userCode) return null
    const normalized = normalizeDeviceUserCode(userCode)
    return /^[A-Z0-9]{4,64}$/.test(normalized) ? normalized : null
  } catch {
    return null
  }
}
