import {
  APIError,
  createAuthEndpoint,
  createAuthMiddleware,
  getSessionFromCtx,
} from 'better-auth/api'
import type { HookEndpointContext } from 'better-auth'
import { setSessionCookie } from 'better-auth/cookies'

import { database } from '#/lib/database'
import { isAdminRole, isPendingAdminRole } from '#/lib/admin'

const PENDING_ADMIN_ROLE = 'admin_pending'

/**
 * Creates a temporary, Bilibili-independent user identity.
 * A passkey must be attached before the init route promotes this identity.
 */
export const adminBootstrap = {
  id: 'admin-bootstrap',
  version: '1.0.0',
  endpoints: {
    bootstrapAdmin: createAuthEndpoint(
      '/admin/bootstrap',
      { method: 'POST' },
      async (ctx) => {
        const user = await database.transaction().execute(async (tx) => {
          const users = await tx
            .selectFrom('user')
            .select(['id', 'role'])
            .forUpdate()
            .execute()

          if (users.some((item) => isAdminRole(item.role))) {
            throw new APIError('FORBIDDEN', {
              message: '管理员已经完成初始化。',
            })
          }

          if (users.some((item) => isPendingAdminRole(item.role))) {
            throw new APIError('CONFLICT', {
              message: '已有管理员注册正在进行中，请在原设备继续。',
            })
          }

          const now = new Date()
          const id = crypto.randomUUID()
          const email = `admin-${id}@invalid.local`
          return tx
            .insertInto('user')
            .values({
              id,
              name: '管理员',
              email,
              emailVerified: false,
              role: `user,${PENDING_ADMIN_ROLE}`,
              createdAt: now,
              updatedAt: now,
            })
            .returningAll()
            .executeTakeFirstOrThrow()
        })

        const session = await ctx.context.internalAdapter.createSession(user.id)
        await setSessionCookie(ctx, { session, user })
        return ctx.json({ ok: true })
      },
    ),
  },
  hooks: {
    before: [
      {
        matcher: ({ path }: HookEndpointContext) => path !== '/get-session',
        handler: createAuthMiddleware(async (ctx) => {
          const session = await getSessionFromCtx(ctx)
          if (!isPendingAdminRole(session?.user.role)) return

          const path = ctx.path
          const pendingSetupPaths = new Set([
            '/passkey/generate-register-options',
            '/passkey/verify-registration',
            '/passkey/list-user-passkeys',
            '/passkey/update-passkey',
            '/sign-out',
          ])
          if (pendingSetupPaths.has(path)) return

          throw new APIError('FORBIDDEN', {
            message: '请先完成管理员初始化。',
          })
        }),
      },
    ],
  },
}
