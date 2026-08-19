import { Pool } from 'pg'
import { Kysely, PostgresDialect } from 'kysely'

import { env } from '#/env'

export interface AuthDatabase {
  account: {
    id: string
    providerId: string
    accountId: string
    userId: string
  }
  user: {
    id: string
    name: string
    email: string
    emailVerified: boolean
    role: string | null
    createdAt: Date
    updatedAt: Date
  }
  passkey: {
    id: string
    userId: string
  }
  oauthClient: {
    clientId: string
    userId: string | null
    name: string | null
    uri: string | null
    icon: string | null
    contacts: Array<string> | null
    tos: string | null
    policy: string | null
    softwareId: string | null
    softwareVersion: string | null
    softwareStatement: string | null
    redirectUris: Array<string>
    postLogoutRedirectUris: Array<string> | null
    tokenEndpointAuthMethod: string | null
    scopes: Array<string> | null
    grantTypes: Array<string> | null
    responseTypes: Array<string> | null
    applicationType: 'web' | 'native' | null
    createdAt: Date | null
    updatedAt: Date | null
    disabled: boolean | null
    skipConsent: boolean | null
    enableEndSession: boolean | null
  }
}

const pool = new Pool({
  connectionString: env.DATABASE_URL,
})

export const database = new Kysely<AuthDatabase>({
  dialect: new PostgresDialect({ pool }),
})
