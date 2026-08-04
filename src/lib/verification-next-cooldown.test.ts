import { beforeEach, describe, expect, it } from 'vite-plus/test'

import {
  getVerificationNextCooldownRemaining,
  startVerificationNextCooldown,
  verificationNextCooldownStorageKey,
} from './verification-next-cooldown'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }
}

describe('verification next cooldown', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { sessionStorage: memoryStorage() },
    })
  })

  it('starts when the first step is submitted and lasts 10 seconds', () => {
    const now = 1_000_000
    expect(startVerificationNextCooldown(now)).toBe(now + 10_000)
    expect(getVerificationNextCooldownRemaining(now)).toBe(10)
    expect(getVerificationNextCooldownRemaining(now + 9_001)).toBe(1)
  })

  it('does not extend an active cooldown and clears after expiry', () => {
    const now = 1_000_000
    expect(startVerificationNextCooldown(now)).toBe(now + 10_000)
    expect(startVerificationNextCooldown(now + 1_000)).toBe(now + 10_000)
    expect(getVerificationNextCooldownRemaining(now + 10_000)).toBe(0)
    expect(
      window.sessionStorage.getItem(verificationNextCooldownStorageKey),
    ).toBe(null)
  })
})
