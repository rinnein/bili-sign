import { createAuthClient } from 'better-auth/react'

import { captchaAwareFetch } from '#/lib/captcha-prompt'

export const sessionClient = createAuthClient({
  fetchOptions: {
    customFetchImpl: captchaAwareFetch,
  },
})
