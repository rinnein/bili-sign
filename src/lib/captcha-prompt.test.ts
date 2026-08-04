import { describe, expect, it } from 'vite-plus/test'

import {
  isCaptchaExpiredResponse,
  isCaptchaRequiredResponse,
} from './captcha-prompt'

describe('captcha response detection', () => {
  it('recognizes Better Auth missing captcha responses', async () => {
    await expect(
      isCaptchaRequiredResponse(
        Response.json(
          { code: 'MISSING_RESPONSE', message: 'Missing CAPTCHA response' },
          { status: 400 },
        ),
      ),
    ).resolves.toBe(true)
  })

  it('does not classify other authentication errors as captcha prompts', async () => {
    await expect(
      isCaptchaRequiredResponse(
        Response.json(
          { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' },
          { status: 400 },
        ),
      ),
    ).resolves.toBe(false)
  })

  it('ignores captcha-shaped responses with another status', async () => {
    await expect(
      isCaptchaRequiredResponse(
        Response.json(
          { code: 'MISSING_RESPONSE', message: 'Missing CAPTCHA response' },
          { status: 500 },
        ),
      ),
    ).resolves.toBe(false)
  })

  it('recognizes an expired captcha response as a retry condition', async () => {
    await expect(
      isCaptchaExpiredResponse(
        Response.json(
          {
            code: 'VERIFICATION_FAILED',
            message: 'Captcha verification failed',
          },
          { status: 403 },
        ),
      ),
    ).resolves.toBe(true)
  })
})
