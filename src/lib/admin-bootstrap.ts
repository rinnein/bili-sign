import {
  APIError,
  createAuthEndpoint,
  createAuthMiddleware,
  getSessionFromCtx,
} from 'better-auth/api'
import type { HookEndpointContext } from 'better-auth'
import { setSessionCookie } from 'better-auth/cookies'

import {
  ADMIN_BOOTSTRAP_RESERVATION,
  ADMIN_BOOTSTRAP_TTL_MS,
  ADMIN_BOOTSTRAP_EMAIL,
  findAdminUser,
  findPendingAdminUser,
  isAdminRole,
  isPendingAdminRole,
  PENDING_ADMIN_ROLE,
} from '#/lib/admin'

function isUniqueConstraintViolation(error: unknown) {
  if (typeof error !== 'object' || error === null) return false
  const candidate = error as { code?: unknown; cause?: unknown }
  if (candidate.code === '23505') return true
  return isUniqueConstraintViolation(candidate.cause)
}

function roleMutationRequestsAdmin(ctx: HookEndpointContext) {
  const body = ctx.body as
    | {
        role?: unknown
        userId?: unknown
        data?: { role?: unknown }
      }
    | undefined
  const requestedRole = body?.role ?? body?.data?.role
  const requestedRoles = Array.isArray(requestedRole)
    ? requestedRole
    : [requestedRole]
  return requestedRoles.some((role) => isAdminRole(role))
}

function roleMutationTargetId(ctx: HookEndpointContext) {
  const body = ctx.body as { userId?: unknown } | undefined
  return typeof body?.userId === 'string' ? body.userId : undefined
}

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
        const { user, session } = await ctx.context.adapter.transaction(
          async () => {
            const adminUser = await findAdminUser(ctx.context.adapter)
            if (adminUser) {
              throw new APIError('FORBIDDEN', {
                message: '管理员已经完成初始化。',
              })
            }

            const pendingAdmin = await findPendingAdminUser(ctx.context.adapter)
            const reservation =
              await ctx.context.internalAdapter.findVerificationValue(
                ADMIN_BOOTSTRAP_RESERVATION,
              )
            const now = new Date()
            const reservationActive = reservation && reservation.expiresAt > now

            if (pendingAdmin && reservationActive) {
              throw new APIError('CONFLICT', {
                message: '已有管理员注册正在进行中，请在原设备继续。',
              })
            }

            if (pendingAdmin) {
              await ctx.context.internalAdapter.deleteUser(pendingAdmin.id)
            }
            if (reservation) {
              await ctx.context.internalAdapter.deleteVerificationByIdentifier(
                ADMIN_BOOTSTRAP_RESERVATION,
              )
            }

            let bootstrapUser
            try {
              bootstrapUser = await ctx.context.internalAdapter.createUser(
                {
                  name: '管理员',
                  email: ADMIN_BOOTSTRAP_EMAIL,
                  emailVerified: false,
                  role: `user,${PENDING_ADMIN_ROLE}`,
                },
                { method: 'admin' },
              )
            } catch (error) {
              if (!isUniqueConstraintViolation(error)) throw error
              throw new APIError('CONFLICT', {
                message: '已有管理员注册正在进行中，请在原设备继续。',
              })
            }

            const reserved =
              await ctx.context.internalAdapter.reserveVerificationValue({
                identifier: ADMIN_BOOTSTRAP_RESERVATION,
                value: bootstrapUser.id,
                expiresAt: new Date(now.getTime() + ADMIN_BOOTSTRAP_TTL_MS),
              })
            if (!reserved) {
              throw new APIError('CONFLICT', {
                message: '已有管理员注册正在进行中，请稍后重试。',
              })
            }

            const bootstrapSession =
              await ctx.context.internalAdapter.createSession(
                bootstrapUser.id,
                false,
                {
                  expiresAt: new Date(now.getTime() + ADMIN_BOOTSTRAP_TTL_MS),
                },
              )
            return { user: bootstrapUser, session: bootstrapSession }
          },
        )

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
      {
        matcher: ({ path }: HookEndpointContext) =>
          path === '/admin/create-user' ||
          path === '/admin/update-user' ||
          path === '/admin/set-role',
        handler: createAuthMiddleware(async (ctx) => {
          if (!roleMutationRequestsAdmin(ctx)) return

          const existingAdmin = await findAdminUser(ctx.context.adapter)
          const targetId = roleMutationTargetId(ctx)
          if (!existingAdmin) {
            throw new APIError('FORBIDDEN', {
              message: '管理员必须通过初始化流程创建。',
            })
          }
          if (existingAdmin.id !== targetId) {
            throw new APIError('CONFLICT', {
              message: '系统只允许一个管理员。',
            })
          }
        }),
      },
      {
        matcher: ({ path }: HookEndpointContext) => path === '/oauth2/consent',
        handler: createAuthMiddleware(async (ctx) => {
          const body = ctx.body as { accept?: unknown } | undefined
          if (body?.accept !== true) return

          const session = await getSessionFromCtx(ctx)
          if (!isAdminRole(session?.user.role)) return

          throw new APIError('FORBIDDEN', {
            error: 'access_denied',
            error_description: '管理员账户不能授权第三方应用。',
          })
        }),
      },
    ],
  },
}
