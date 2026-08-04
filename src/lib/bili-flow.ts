import type { PublicBiliInfo } from '#/lib/bili-public'
import { isPublicBiliInfo } from '#/lib/bili-public'
import { pluginBridge } from '#/lib/plugin-bridge'

export type BiliInfo = PublicBiliInfo

export type BiliChallenge = {
  identifier: string
  expiresAt: Date | string
  signInstruction: string
}

export function isChallengeUsable(
  challenge: BiliChallenge | null | undefined,
  now = Date.now(),
) {
  if (!challenge) return false
  const expiresAt = new Date(challenge.expiresAt).getTime()
  return Number.isFinite(expiresAt) && expiresAt > now
}

export function friendlyVerificationError(
  error: unknown,
  fallback = '验证未完成，请重试',
) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : ''
  const normalized = message.toLowerCase()

  if (normalized.includes('no pending challenge')) {
    return '验证码已失效，请重新获取验证码。'
  }
  if (
    normalized.includes('challenge') &&
    (normalized.includes('expired') || normalized.includes('expire'))
  ) {
    return '验证码已过期，请重新获取验证码。'
  }
  if (
    normalized.includes('signature') &&
    (normalized.includes('mismatch') || normalized.includes('invalid'))
  ) {
    return '签名不匹配，请确认已修改 B 站个性签名。'
  }
  if (
    normalized.includes('already bound') ||
    normalized.includes('already linked')
  ) {
    return '这个 B 站账号已经绑定，请重新登录。'
  }
  if (/[一-鿿]/.test(message)) return message
  return fallback
}

export const verificationStorageKeys = {
  sign: 'bili-sign:original-sign',
  mid: 'bili-sign:original-mid',
  challenge: 'bili-sign:challenge',
  completed: 'bili-sign:verification-completed',
  signInFallback: 'bili-sign:sign-in-fallback',
} as const

export function displayValue(value: unknown, fallback = '') {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (value instanceof Date) return value.toISOString()
  return fallback
}

export async function getBiliInfo(mid: string): Promise<BiliInfo> {
  if (
    typeof window !== 'undefined' &&
    pluginBridge.hasCapability('bili.api.proxy')
  ) {
    const result = await pluginBridge.request<unknown>(
      'bili.api.proxy',
      'bili.public-info.get',
      { mid },
    )
    if (!isPublicBiliInfo(result)) throw new Error('插件返回的账号资料格式无效')
    return result
  }

  const response = await fetch('/api/bili-info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mid }),
  })
  let result: BiliInfo & { error?: string }
  try {
    result = (await response.json()) as BiliInfo & { error?: string }
  } catch {
    throw new Error('资料查询服务暂时不可用，请稍后重试')
  }
  if (!response.ok) throw new Error(result.error ?? '无法获取 B 站用户信息')
  return result
}

export function openBiliSettings(mid: string) {
  window.open(
    `https://space.bilibili.com/${mid}/setting`,
    '_blank',
    'noopener,noreferrer',
  )
}

export function readVerificationCache() {
  if (typeof window === 'undefined') return null

  const sign = window.sessionStorage.getItem(verificationStorageKeys.sign)
  const mid = window.sessionStorage.getItem(verificationStorageKeys.mid)
  const challengeValue = window.sessionStorage.getItem(
    verificationStorageKeys.challenge,
  )
  const completed =
    window.sessionStorage.getItem(verificationStorageKeys.completed) === 'true'
  const signInFallback =
    window.sessionStorage.getItem(verificationStorageKeys.signInFallback) ===
    'true'

  let challenge: BiliChallenge | null = null
  if (challengeValue) {
    try {
      challenge = JSON.parse(challengeValue) as BiliChallenge
    } catch {
      window.sessionStorage.removeItem(verificationStorageKeys.challenge)
    }
  }

  return {
    sign: sign ?? '',
    mid: mid ?? '',
    challenge,
    completed,
    signInFallback,
  }
}

export function writeVerificationCache({
  sign,
  mid,
  challenge,
  completed,
  signInFallback,
}: {
  sign?: string
  mid?: string
  challenge?: BiliChallenge | null
  completed?: boolean
  signInFallback?: boolean
}) {
  if (typeof window === 'undefined') return
  if (sign !== undefined) {
    window.sessionStorage.setItem(verificationStorageKeys.sign, sign)
  }
  if (mid !== undefined) {
    window.sessionStorage.setItem(verificationStorageKeys.mid, mid)
  }
  if (completed !== undefined) {
    window.sessionStorage.setItem(
      verificationStorageKeys.completed,
      String(completed),
    )
  }
  if (signInFallback !== undefined) {
    window.sessionStorage.setItem(
      verificationStorageKeys.signInFallback,
      String(signInFallback),
    )
  }
  if (challenge === null) {
    window.sessionStorage.removeItem(verificationStorageKeys.challenge)
  } else if (challenge !== undefined) {
    window.sessionStorage.setItem(
      verificationStorageKeys.challenge,
      JSON.stringify(challenge),
    )
  }
}

export function clearVerificationCache() {
  if (typeof window === 'undefined') return
  Object.values(verificationStorageKeys).forEach((key) =>
    window.sessionStorage.removeItem(key),
  )
}
