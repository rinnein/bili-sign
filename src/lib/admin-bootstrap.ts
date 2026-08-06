import {
  APIError,
  createAuthEndpoint,
  createAuthMiddleware,
  getSessionFromCtx,
} from 'better-auth/api'
import type { DBAdapter, HookEndpointContext } from 'better-auth'
import { setSessionCookie } from 'better-auth/cookies'

import {
  ADMIN_BOOTSTRAP_EMAIL,
  ADMIN_ROLE,
  isAdminRole,
  isPendingAdminRole,
  PENDING_ADMIN_ROLE,
} from '#/lib/admin'

type RoleUser = {
  id: string
  role?: unknown
}

function isUniqueConstraintViolation(error: unknown) {
  if (typeof error !== 'object' || error === null) return false
  const candidate = error as { code?: unknown; cause?: unknown }
  if (candidate.code === '23505') return true
  return isUniqueConstraintViolation(candidate.cause)
}

async function findAdminRoleUsers(adapter: DBAdapter) {
  return adapter.findMany<RoleUser>({
    model: 'user',
    where: [{ field: 'role', value: ADMIN_ROLE, operator: 'contains' }],
    select: ['id', 'role'],
  })
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
        const roleUsers = await findAdminRoleUsers(ctx.context.adapter)
        if (roleUsers.some((item) => isAdminRole(item.role))) {
          throw new APIError('FORBIDDEN', {
            message: '管理员已经完成初始化。',
          })
        }

        if (roleUsers.some((item) => isPendingAdminRole(item.role))) {
          throw new APIError('CONFLICT', {
            message: '已有管理员注册正在进行中，请在原设备继续。',
          })
        }

        let user
        try {
          user = await ctx.context.internalAdapter.createUser({
            name: '管理员',
            email: ADMIN_BOOTSTRAP_EMAIL,
            emailVerified: false,
            role: `user,${PENDING_ADMIN_ROLE}`,
          })
        } catch (error) {
          if (isUniqueConstraintViolation(error)) {
            throw new APIError('CONFLICT', {
              message: '已有管理员注册正在进行中，请在原设备继续。',
            })
          }
          throw error
        }

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
      {
        matcher: ({ path }: HookEndpointContext) =>
          path === '/admin/create-user' ||
          path === '/admin/update-user' ||
          path === '/admin/set-role',
        handler: createAuthMiddleware(async (ctx) => {
          if (!roleMutationRequestsAdmin(ctx)) return

          const roleUsers = await findAdminRoleUsers(ctx.context.adapter)
          const existingAdmin = roleUsers.find((item) => isAdminRole(item.role))
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
    ],
  },
}
