import { loadEnvFile } from 'node:process'

import { Pool } from 'pg'
import type { PoolClient } from 'pg'

const dryRun = process.argv.includes('--dry-run')
const dropLegacyOAuthColumns = process.argv.includes(
  '--drop-legacy-oauth-columns',
)
const showHelp = process.argv.includes('--help') || process.argv.includes('-h')

type AccountRow = {
  id: string
  providerId: string
  accountId: string
  issuer: string | null
}

type OAuthClientRow = {
  clientId: string
  applicationType: 'web' | 'native' | null
  clientDiscoveryId: string | null
  clientCredentialsScopes: Array<string> | null
  tokenEndpointAuthMethod: string | null
  grantTypes: Array<string> | null
  responseTypes: Array<string> | null
  legacyType: string | null
  legacyPublic: boolean | null
}

function loadProjectEnv() {
  for (const file of ['.env.local', '.env']) {
    try {
      loadEnvFile(file)
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !('code' in error) ||
        error.code !== 'ENOENT'
      ) {
        throw error
      }
    }
  }
}

function printUsage() {
  console.log(`Usage: pnpm migrate:auth [options]

Options:
  --dry-run                    Validate the migration in a rolled-back transaction
  --drop-legacy-oauth-columns  Remove oauthClient.type and oauthClient.public after backfill
  --help                       Show this message`)
}

async function tableExists(db: PoolClient, tableName: string) {
  const result = await db.query(
    `
      select 1
      from information_schema.tables
      where table_schema = 'public' and table_name = $1
    `,
    [tableName],
  )
  return result.rowCount === 1
}

async function columnExists(
  db: PoolClient,
  tableName: string,
  columnName: string,
) {
  const result = await db.query(
    `
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = $1
        and column_name = $2
    `,
    [tableName, columnName],
  )
  return result.rowCount === 1
}

function accountIssuer(providerId: string) {
  if (providerId === 'credential') return 'local:credential'
  return `local:oauth:${encodeURIComponent(providerId)}`
}

function resolveApplicationType(row: OAuthClientRow) {
  const value = row.applicationType ?? row.legacyType ?? 'web'
  if (value === 'web' || value === 'native') return value
  throw new Error(
    `OAuth client ${row.clientId} uses unsupported application type ${JSON.stringify(value)}. Review it manually before migrating.`,
  )
}

function assertReciprocalGrantTypes(row: OAuthClientRow) {
  const grantTypes = row.grantTypes ?? []
  const responseTypes = row.responseTypes ?? []
  const hasAuthorizationCode = grantTypes.includes('authorization_code')
  const hasCodeResponse = responseTypes.includes('code')

  if (hasAuthorizationCode !== hasCodeResponse) {
    throw new Error(
      `OAuth client ${row.clientId} has mismatched grant_types and response_types.`,
    )
  }

  if (grantTypes.includes('client_credentials')) {
    throw new Error(
      `OAuth client ${row.clientId} uses the unsupported client_credentials grant. Remove it from grant_types before retrying.`,
    )
  }
}

async function prepareAccounts(db: PoolClient) {
  if (!(await tableExists(db, 'account'))) return

  if (!(await columnExists(db, 'account', 'issuer'))) {
    await db.query('alter table "account" add column "issuer" text')
  }

  const accounts = await db.query<AccountRow>(
    'select "id", "providerId", "accountId", "issuer" from "account"',
  )
  for (const account of accounts.rows) {
    if (account.issuer) continue
    await db.query(
      'update "account" set "issuer" = $1 where "id" = $2 and "issuer" is null',
      [accountIssuer(account.providerId), account.id],
    )
  }

  const missingIssuer = await db.query(
    'select count(*)::int as count from "account" where "issuer" is null',
  )
  if (missingIssuer.rows[0]?.count !== 0) {
    throw new Error('Some account rows still have no issuer.')
  }

  const collisions = await db.query(
    `
      select "issuer", "accountId", count(*)::int as count
      from "account"
      group by "issuer", "accountId"
      having count(*) > 1
    `,
  )
  if (collisions.rowCount) {
    throw new Error(
      `Account identity collisions found: ${JSON.stringify(collisions.rows)}`,
    )
  }

  await db.query('alter table "account" alter column "issuer" set not null')
  await db.query(
    `
      create unique index if not exists "account_issuer_accountId_uidx"
      on "account" ("issuer", "accountId")
    `,
  )
}

async function prepareOAuthClients(db: PoolClient) {
  if (!(await tableExists(db, 'oauthClient'))) return

  const hasLegacyType = await columnExists(db, 'oauthClient', 'type')
  const hasLegacyPublic = await columnExists(db, 'oauthClient', 'public')

  await db.query(
    'alter table "oauthClient" add column if not exists "applicationType" text',
  )
  await db.query(
    'alter table "oauthClient" add column if not exists "clientDiscoveryId" text',
  )
  await db.query(
    'alter table "oauthClient" add column if not exists "clientCredentialsScopes" jsonb',
  )

  const legacySelect = [
    '"clientId"',
    '"applicationType"',
    '"clientDiscoveryId"',
    '"clientCredentialsScopes"',
    '"tokenEndpointAuthMethod"',
    '"grantTypes"',
    '"responseTypes"',
  ]
  if (hasLegacyType) legacySelect.push('"type" as "legacyType"')
  if (hasLegacyPublic) legacySelect.push('public as "legacyPublic"')

  const clients = await db.query<OAuthClientRow>(
    `select ${legacySelect.join(', ')} from "oauthClient"`,
  )
  for (const client of clients.rows) {
    assertReciprocalGrantTypes(client)

    const applicationType = resolveApplicationType(client)
    if (!client.applicationType) {
      await db.query(
        'update "oauthClient" set "applicationType" = $1 where "clientId" = $2',
        [applicationType, client.clientId],
      )
    }
    if (!client.clientCredentialsScopes) {
      await db.query(
        'update "oauthClient" set "clientCredentialsScopes" = $1::jsonb where "clientId" = $2',
        ['[]', client.clientId],
      )
    }

    if (
      client.legacyPublic === true &&
      client.tokenEndpointAuthMethod &&
      client.tokenEndpointAuthMethod !== 'none'
    ) {
      throw new Error(
        `OAuth client ${client.clientId} is marked public but uses ${client.tokenEndpointAuthMethod}.`,
      )
    }
    if (
      client.legacyPublic === false &&
      client.tokenEndpointAuthMethod === 'none'
    ) {
      throw new Error(
        `OAuth client ${client.clientId} is marked confidential but uses none authentication.`,
      )
    }
  }

  if (dropLegacyOAuthColumns) {
    if (hasLegacyType)
      await db.query('alter table "oauthClient" drop column "type"')
    if (hasLegacyPublic)
      await db.query('alter table "oauthClient" drop column "public"')
  }
}

async function assertDeviceCodesReady(db: PoolClient) {
  if (!(await tableExists(db, 'deviceCode'))) return

  const duplicateDeviceCodes = await db.query(
    `
      select "deviceCode", count(*)::int as count
      from "deviceCode"
      group by "deviceCode"
      having count(*) > 1
    `,
  )
  const duplicateUserCodes = await db.query(
    `
      select "userCode", count(*)::int as count
      from "deviceCode"
      group by "userCode"
      having count(*) > 1
    `,
  )
  if (duplicateDeviceCodes.rowCount || duplicateUserCodes.rowCount) {
    throw new Error(
      `Duplicate device codes must be resolved first: ${JSON.stringify({
        deviceCode: duplicateDeviceCodes.rows,
        userCode: duplicateUserCodes.rows,
      })}`,
    )
  }
}

async function printCurrentState(db: PoolClient) {
  const tableNames = ['account', 'oauthClient', 'deviceCode']
  const tables: Record<string, boolean> = {}
  for (const tableName of tableNames) {
    tables[tableName] = await tableExists(db, tableName)
  }
  console.log(`Database migration mode: ${dryRun ? 'dry-run' : 'apply'}`)
  console.log(`account table: ${tables.account ? 'present' : 'missing'}`)
  console.log(
    `oauthClient table: ${tables.oauthClient ? 'present' : 'missing'}`,
  )
  console.log(`deviceCode table: ${tables.deviceCode ? 'present' : 'missing'}`)
  if (tables.account) {
    const result = await db.query(
      'select count(*)::int as count from "account"',
    )
    console.log(`account rows: ${result.rows[0]?.count ?? 0}`)
  }
  if (tables.oauthClient) {
    const result = await db.query(
      'select count(*)::int as count from "oauthClient"',
    )
    console.log(`oauthClient rows: ${result.rows[0]?.count ?? 0}`)
  }
  if (tables.deviceCode) {
    const result = await db.query(
      'select count(*)::int as count from "deviceCode"',
    )
    console.log(`deviceCode rows: ${result.rows[0]?.count ?? 0}`)
  }
}

async function run() {
  if (showHelp) {
    printUsage()
    return
  }

  loadProjectEnv()
  const { env } = await import('../src/env.ts')
  const pool = new Pool({ connectionString: env.DATABASE_URL })
  let database: { destroy: () => Promise<void> } | undefined

  try {
    const db = await pool.connect()
    try {
      await printCurrentState(db)
      await assertDeviceCodesReady(db)

      if (dryRun) {
        await db.query('begin')
        try {
          await prepareAccounts(db)
          await prepareOAuthClients(db)
          await db.query('rollback')
        } catch (error) {
          await db.query('rollback').catch(() => undefined)
          throw error
        }

        const [{ auth }, databaseModule] = await Promise.all([
          import('../src/lib/auth.ts'),
          import('../src/lib/database.ts'),
        ])
        database = databaseModule.database
        const context = await auth.$context
        console.log(
          `Auth config loaded; runMigrations is ${typeof context.runMigrations}.`,
        )
        console.log(
          'Dry-run validation succeeded; no database changes were made.',
        )
        return
      }

      await db.query('begin')
      await db.query("set local lock_timeout = '5s'")
      await prepareAccounts(db)
      await prepareOAuthClients(db)
      await db.query('commit')
      console.log('Manual 1.7 data preparation completed.')
    } catch (error) {
      await db.query('rollback').catch(() => undefined)
      throw error
    } finally {
      db.release()
    }

    const [{ auth }, databaseModule] = await Promise.all([
      import('../src/lib/auth.ts'),
      import('../src/lib/database.ts'),
    ])
    database = databaseModule.database
    const context = await auth.$context
    await context.runMigrations()
    console.log('Better Auth schema migration completed.')
  } finally {
    await database?.destroy()
    await pool.end()
  }
}

run().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Better Auth migration failed.',
  )
  process.exitCode = 1
})
