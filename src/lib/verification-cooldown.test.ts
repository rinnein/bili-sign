import { beforeEach, describe, expect, it } from 'vite-plus/test'

import {
  getVerificationCooldownRemaining,
  startVerificationCooldown,
  verificationCooldownStorageKey,
} from './verification-cooldown'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }
}

describe('verification cooldown', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { sessionStorage: memoryStorage() },
    })
  })

  it('starts for 60 seconds and survives a fresh read', () => {
    const now = 1_000_000
    expect(startVerificationCooldown(now)).toBe(now + 60_000)
    expect(getVerificationCooldownRemaining(now)).toBe(60)
    expect(getVerificationCooldownRemaining(now + 59_001)).toBe(1)
  })

  it('does not extend an active cooldown', () => {
    const now = 1_000_000
    expect(startVerificationCooldown(now)).toBe(now + 60_000)
    expect(startVerificationCooldown(now + 10_000)).toBe(now + 60_000)
    expect(getVerificationCooldownRemaining(now + 60_000)).toBe(0)
    expect(window.sessionStorage.getItem(verificationCooldownStorageKey)).toBe(
      null,
    )
  })
})
