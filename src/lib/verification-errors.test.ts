import { describe, expect, it } from 'vite-plus/test'

import { friendlyVerificationError } from './bili-flow'

describe('friendly verification errors', () => {
  it('translates the pending challenge error', () => {
    expect(
      friendlyVerificationError(
        new Error('No pending challenge found for this mid.'),
      ),
    ).toBe('验证码已失效，请重新获取验证码。')
  })

  it('keeps existing Chinese errors and hides unknown technical errors', () => {
    expect(friendlyVerificationError(new Error('签名不匹配'))).toBe(
      '签名不匹配',
    )
    expect(friendlyVerificationError(new Error('Internal Error'))).toBe(
      '验证未完成，请重试',
    )
  })
})
