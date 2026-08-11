import { passkeyClient } from '@better-auth/passkey/client'
import { oauthProviderClient } from '@better-auth/oauth-provider/client'
import { biliBasicClient } from 'better-auth-bili-basic/client'
import type { BetterAuthClientPlugin } from 'better-auth/client'
import {
  adminClient,
  deviceAuthorizationClient,
  multiSessionClient,
} from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

import type { adminBootstrap } from '#/lib/admin-bootstrap'
import { captchaAwareFetch } from '#/lib/captcha-prompt'

const rawBiliPlugin = biliBasicClient()

let deviceSessionToken: string | null = null

export function setDeviceSessionToken(token: string) {
  deviceSessionToken = token
}

export function clearDeviceSessionToken() {
  deviceSessionToken = null
}

async function authFetch(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(
    input instanceof Request ? input.headers : init?.headers,
  )
  if (deviceSessionToken && !headers.has('authorization')) {
    headers.set('authorization', `Bearer ${deviceSessionToken}`)
  }
  return captchaAwareFetch(input, { ...init, headers })
}

export async function appFetch(input: RequestInfo | URL, init?: RequestInit) {
  return authFetch(input, init)
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

const adminBootstrapClient = {
  id: 'admin-bootstrap-client',
  $InferServerPlugin: {} as typeof adminBootstrap,
} satisfies BetterAuthClientPlugin

export const authClient = createAuthClient({
  fetchOptions: {
    customFetchImpl: authFetch,
  },
  plugins: [
    biliPlugin,
    oauthProviderClient(),
    adminBootstrapClient,
    passkeyClient(),
    deviceAuthorizationClient(),
    adminClient(),
    multiSessionClient(),
  ],
})
