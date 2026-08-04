import { beforeEach, describe, expect, it } from 'vite-plus/test'

import {
  clearVerificationCache,
  isChallengeUsable,
  readVerificationCache,
  writeVerificationCache,
} from './bili-flow'
import {
  acknowledgeSafetyNotice,
  hasAcknowledgedSafetyNotice,
} from './safety-notice'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }
}

describe('browser-only UI state', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: memoryStorage(),
        sessionStorage: memoryStorage(),
      },
    })
  })

  it('requires and then remembers the safety acknowledgement', () => {
    expect(hasAcknowledgedSafetyNotice()).toBe(false)
    acknowledgeSafetyNotice()
    expect(hasAcknowledgedSafetyNotice()).toBe(true)
  })

  it('round-trips the original sign and challenge without number conversion', () => {
    writeVerificationCache({
      sign: '原签名',
      mid: '90071992547409931234567890',
      challenge: {
        identifier: 'identifier',
        expiresAt: '2030-01-01T00:00:00.000Z',
        signInstruction: 'bauth:ABCDE',
      },
      completed: false,
      signInFallback: false,
    })

    expect(readVerificationCache()).toEqual({
      sign: '原签名',
      mid: '90071992547409931234567890',
      challenge: {
        identifier: 'identifier',
        expiresAt: '2030-01-01T00:00:00.000Z',
        signInstruction: 'bauth:ABCDE',
      },
      completed: false,
      signInFallback: false,
    })

    clearVerificationCache()
    expect(readVerificationCache()).toEqual({
      sign: '',
      mid: '',
      challenge: null,
      completed: false,
      signInFallback: false,
    })
  })

  it('only reuses a challenge while its expiry is in the future', () => {
    const now = Date.parse('2030-01-01T00:00:00.000Z')
    const challenge = {
      identifier: 'identifier',
      expiresAt: '2030-01-01T00:10:00.000Z',
      signInstruction: 'bauth:ABCDE',
    }

    expect(isChallengeUsable(challenge, now)).toBe(true)
    expect(isChallengeUsable(challenge, now + 600_000)).toBe(false)
    expect(
      isChallengeUsable({ ...challenge, expiresAt: 'not-a-date' }, now),
    ).toBe(false)
  })
})
