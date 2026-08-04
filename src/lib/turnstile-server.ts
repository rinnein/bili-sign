import { env } from '#/env'

function isLocalHostname(hostname: string) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1'
  )
}

const configuredAuthUrl = env.BETTER_AUTH_URL
const configuredAuthIsLocal = (() => {
  if (!configuredAuthUrl) return false
  try {
    return isLocalHostname(new URL(configuredAuthUrl).hostname)
  } catch {
    return false
  }
})()

export const turnstileServerEnabled =
  import.meta.env.PROD && !configuredAuthIsLocal

export function isLocalDevelopmentRequest(request: Request) {
  try {
    return isLocalHostname(new URL(request.url).hostname)
  } catch {
    return false
  }
}

export async function verifyTurnstileToken(
  request: Request,
  token: string,
): Promise<{ success: boolean; configured: boolean }> {
  if (!env.TURNSTILE_SECRET) return { success: false, configured: false }

  try {
    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: env.TURNSTILE_SECRET,
          response: token,
          remoteip:
            request.headers.get('CF-Connecting-IP')?.trim() ||
            request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
            request.headers.get('X-Real-IP')?.trim() ||
            '',
        }),
      },
    )
    if (!response.ok) return { success: false, configured: true }

    const result = (await response.json()) as { success?: boolean }
    return { success: result.success === true, configured: true }
  } catch {
    return { success: false, configured: true }
  }
}
