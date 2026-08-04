export const verificationCooldownStorageKey =
  'bili-sign:verification-cooldown-until'

export const verificationCooldownMs = 60_000

function readStoredUntil() {
  if (typeof window === 'undefined') return 0

  try {
    const value = Number(
      window.sessionStorage.getItem(verificationCooldownStorageKey),
    )
    return Number.isFinite(value) && value > 0 ? value : 0
  } catch {
    return 0
  }
}

export function getVerificationCooldownRemaining(now = Date.now()) {
  const until = readStoredUntil()
  if (!until || until <= now) {
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(verificationCooldownStorageKey)
      } catch {
        // Storage can be unavailable in privacy-restricted browsers.
      }
    }
    return 0
  }

  return Math.ceil((until - now) / 1000)
}

export function startVerificationCooldown(now = Date.now()) {
  const currentUntil = readStoredUntil()
  if (currentUntil > now) return currentUntil

  const until = now + verificationCooldownMs
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(
        verificationCooldownStorageKey,
        String(until),
      )
    } catch {
      // The in-memory state still protects the current render.
    }
  }
  return until
}
