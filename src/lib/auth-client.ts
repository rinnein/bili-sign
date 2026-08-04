import { passkeyClient } from '@better-auth/passkey/client'
import { biliBasicClient } from 'better-auth-bili-basic/client'
import type { BetterAuthClientPlugin } from 'better-auth/client'
import { deviceAuthorizationClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

import { captchaAwareFetch } from '#/lib/captcha-prompt'

const rawBiliPlugin = biliBasicClient()

let deviceSessionToken: string | null = null

export function setDeviceSessionToken(token: string) {
  deviceSessionToken = token
}

export function clearDeviceSessionToken() {
  deviceSessionToken = null
}

export async function authFetch(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(
    input instanceof Request ? input.headers : init?.headers,
  )
  if (deviceSessionToken && !headers.has('authorization')) {
    headers.set('authorization', `Bearer ${deviceSessionToken}`)
  }
  return captchaAwareFetch(input, { ...init, headers })
}

const biliPlugin = {
  ...rawBiliPlugin,
  getActions: (
    $fetch: Parameters<NonNullable<BetterAuthClientPlugin['getActions']>>[0],
  ) =>
    rawBiliPlugin.getActions(
      $fetch as unknown as Parameters<typeof rawBiliPlugin.getActions>[0],
    ),
}

export const authClient = createAuthClient({
  fetchOptions: {
    customFetchImpl: authFetch,
  },
  plugins: [biliPlugin, passkeyClient(), deviceAuthorizationClient()],
})
