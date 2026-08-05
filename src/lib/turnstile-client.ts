import { env } from '#/env.ts'

export const turnstileAction = 'turnstile-spin-v2'
export const turnstileSiteKey = env.VITE_TURNSTILE_SITE_KEY
export const turnstileEnabled =
  import.meta.env.PROD && env.VITE_TURNSTILE_SITE_KEY

export async function verifyTurnstileToken(token: string) {
  if (!turnstileEnabled) return

  const response = await fetch('/api/turnstile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })

  let result: { success?: boolean; error?: string }
  try {
    result = (await response.json()) as { success?: boolean; error?: string }
  } catch {
    throw new Error('安全验证服务暂时不可用，请稍后重试。')
  }

  if (!response.ok || result.success !== true) {
    throw new Error(result.error ?? '安全验证未通过，请重试。')
  }
}
