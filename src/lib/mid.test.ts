import { beforeEach, describe, expect, it } from 'vite-plus/test'

import {
  extractB23Links,
  extractMid,
  isValidMid,
  readLastMid,
  rememberMid,
} from './mid'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }
}

describe('MID input handling', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: memoryStorage() },
    })
  })

  it.each([
    ['123456', '123456'],
    ['https://space.bilibili.com/123456', '123456'],
    ['https://m.bilibili.com/space/123456', '123456'],
    [
      '请查看 https://space.bilibili.com/90071992547409931234567890 的主页',
      '90071992547409931234567890',
    ],
  ])('extracts %j as %j', (input, expected) => {
    expect(extractMid(input)).toBe(expected)
  })

  it.each(['', '-1', '1.5', 'abc', '12 34'])(
    'rejects invalid MID %j',
    (input) => {
      expect(isValidMid(input)).toBe(false)
      expect(extractMid(input)).toBeNull()
    },
  )

  it('finds b23 links in surrounding text', () => {
    expect(extractB23Links('打开 b23.tv/abc_12 或 https://b23.tv/xyz')).toEqual(
      ['https://b23.tv/abc_12', 'https://b23.tv/xyz'],
    )
  })

  it('persists only the last confirmed MID', () => {
    expect(readLastMid()).toBe('')
    rememberMid('90071992547409931234567890')
    expect(readLastMid()).toBe('90071992547409931234567890')
    rememberMid('-1')
    expect(readLastMid()).toBe('90071992547409931234567890')
  })
})
