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
}

const pool = new Pool({
  connectionString: env.DATABASE_URL,
})

export const database = new Kysely<AuthDatabase>({
  dialect: new PostgresDialect({ pool }),
})
