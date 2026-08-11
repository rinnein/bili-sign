import { betterAuth } from 'better-auth'
import { passkey } from '@better-auth/passkey'
import { oauthProvider } from '@better-auth/oauth-provider'
import { biliBasic } from 'better-auth-bili-basic/server'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { admin, bearer, captcha, multiSession } from 'better-auth/plugins'
import { deviceAuthorization } from 'better-auth/plugins/device-authorization'
import { jwt } from 'better-auth/plugins/jwt'
import { z } from 'zod'

import { env } from '#/env'
import { isAdminRole } from '#/lib/admin'
import { database } from '#/lib/database'
import {
  DEVICE_AUTH_CLIENT_ID,
  DEVICE_AUTH_USER_CODE_LENGTH,
} from '#/lib/device-auth'
import { turnstileServerEnabled } from '#/lib/turnstile-server'
import { adminBootstrap } from '#/lib/admin-bootstrap'

type BiliAccount = {
  accountId: string
  providerId: string
}

type ClaimsAuthContext = {
  internalAdapter: {
    findAccounts: (userId: string) => Promise<Array<BiliAccount>>
  }
}

export const auth = betterAuth({
  basePath: '/',
  database: { db: database, type: 'postgres' },
  appName: 'bili-sign',
  emailAndPassword: { enabled: false },
  advanced: {
    ipAddress: {
      ipAddressHeaders: [
        'cf-connecting-ip',
        'eo-connecting-ip',
        'x-real-ip',
        'x-forwarded-for',
      ],
    },
  },
  user: {
    deleteUser: {
      enabled: true,
    },
  },
  plugins: [
    biliBasic({
      authMark: 'bauth',
      skipCodeValidation: false,
      infoRestrictions: z.object({
        ban: z.literal(false),
        fans: z.int().nonnegative(),
        sign: z.string(),
        level: z.int().min(4).max(6),
        vip: z.int().min(0).max(2),
      }),
      signUpOnVerification: {
        enabled: true,
        deleteUserOnRevoke: true,
      },
    }),
    ...(turnstileServerEnabled
      ? [
          captcha({
            provider: 'cloudflare-turnstile',
            secretKey: env.TURNSTILE_SECRET ?? '',
            expectedAction: 'turnstile-spin-v2',
            endpoints: ['/bili-basic/send'],
          }),
        ]
      : []),
    bearer(),
    admin(),
    multiSession(),
    adminBootstrap,
    passkey(),
    deviceAuthorization({
      expiresIn: '2m',
      verificationUri: '/login',
      userCodeLength: DEVICE_AUTH_USER_CODE_LENGTH,
      validateClient: (clientId) => clientId === DEVICE_AUTH_CLIENT_ID,
    }),
    jwt(),
    oauthProvider({
      scopes: ['openid', 'profile', 'bili:public'] as const,
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: false,
      clientRegistrationDefaultScopes: ['openid', 'profile', 'bili:public'],
      clientRegistrationAllowedScopes: ['openid', 'profile', 'bili:public'],
      clientRegistrationClientSecretExpiration: '1 year',
      grantTypes: ['authorization_code', 'refresh_token'],
      loginPage: '/login',
      consentPage: '/oauth/consent',
      advertisedMetadata: {
        claims_supported: [
          'sub',
          'iss',
          'aud',
          'exp',
          'iat',
          'name',
          'picture',
          'bili_mid',
        ],
      },
      customUserInfoClaims: async ({ user, scopes }) => {
        if (!scopes.includes('bili:public')) return {}

        const accounts = await (
          await getClaimsAuthContext()
        ).internalAdapter.findAccounts(user.id)
        const account = accounts.find(
          (item) => item.providerId === 'bili-basic',
        )

        return account ? { bili_mid: account.accountId } : {}
      },
      postLogin: {
        page: '/oauth/consent',
        shouldRedirect: () => false,
        consentReferenceId: ({ user }) => {
          return isAdminRole(user.role)
            ? 'admin-oauth-consent-denied'
            : undefined
        },
      },
    }),
    tanstackStartCookies(),
  ],
})

function getClaimsAuthContext(): Promise<ClaimsAuthContext> {
  return auth.$context
}
