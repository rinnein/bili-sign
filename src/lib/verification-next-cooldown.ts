export const verificationNextCooldownStorageKey =
  'bili-sign:verification-next-cooldown-until'

export const verificationNextCooldownMs = 10_000

function readStoredUntil() {
  if (typeof window === 'undefined') return 0

  try {
    const value = Number(
      window.sessionStorage.getItem(verificationNextCooldownStorageKey),
    )
    return Number.isFinite(value) && value > 0 ? value : 0
  } catch {
    return 0
  }
}

export function getVerificationNextCooldownRemaining(now = Date.now()) {
  const until = readStoredUntil()
  if (!until || until <= now) {
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(verificationNextCooldownStorageKey)
      } catch {
        // Storage can be unavailable in privacy-restricted browsers.
      }
    }
    return 0
  }

  return Math.ceil((until - now) / 1000)
}

export function startVerificationNextCooldown(now = Date.now()) {
  const currentUntil = readStoredUntil()
  if (currentUntil > now) return currentUntil

  const until = now + verificationNextCooldownMs
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(
        verificationNextCooldownStorageKey,
        String(until),
      )
    } catch {
      // The in-memory state still protects the current render.
    }
  }
  return until
}
