import { describe, expect, it } from 'vite-plus/test'

import { mapBiliPublicInfo, parseMid } from './bili-public'

describe('parseMid', () => {
  it('accepts legal decimal strings without number precision loss', () => {
    const value = '90071992547409931234567890'
    expect(parseMid(value)).toBe(BigInt(value))
  })

  it.each(['', '-1', '1.5', 'abc', ' 123'])('rejects %j', (value: string) => {
    expect(parseMid(value)).toBeNull()
  })
})

describe('mapBiliPublicInfo', () => {
  it('returns only the public fields used by the page', () => {
    const response = {
      data: {
        card: {
          mid: '123',
          name: '公开用户',
          face: 'https://example.com/face.jpg',
          sign: 'hello',
          fans: 42,
          level_info: { current_level: 6 },
          vip: { type: 2 },
          spacesta: -2,
          description: 'private-looking field that must not escape',
        },
      },
    }
    const result = mapBiliPublicInfo(response)

    expect(result).toEqual({
      mid: '123',
      name: '公开用户',
      face: 'https://example.com/face.jpg',
      sign: 'hello',
      fans: 42,
      level: 6,
      vip: 2,
      ban: true,
    })
    expect(result).not.toHaveProperty('description')
  })
})
