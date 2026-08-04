import { describe, expect, it } from 'vite-plus/test'

import {
  extractDeviceUserCodeFromQr,
  normalizeDeviceUserCode,
} from './device-auth'

describe('device authorization QR values', () => {
  it('extracts a user code from the generated verification URL', () => {
    expect(
      extractDeviceUserCodeFromQr(
        'https://example.com/login?user_code=ab12-cd34',
      ),
    ).toBe('AB12CD34')
  })

  it('rejects unrelated QR content', () => {
    expect(extractDeviceUserCodeFromQr('https://example.com/login')).toBeNull()
    expect(
      extractDeviceUserCodeFromQr('https://example.com/?user_code=AB12'),
    ).toBeNull()
    expect(extractDeviceUserCodeFromQr('not a device QR')).toBeNull()
  })

  it('normalizes manual device code input', () => {
    expect(normalizeDeviceUserCode(' ab12-cd34 ')).toBe('AB12CD34')
  })
})
