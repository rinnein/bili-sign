import { createFileRoute } from '@tanstack/react-router'

import { auth } from '#/lib/auth'
import {
  ADMIN_INITIALIZATION_RESERVATION,
  ADMIN_ROLE,
  getUserRole,
  isAdminRole,
  isPendingAdminRole,
} from '#/lib/admin'

type RoleUser = {
  id: string
  role?: unknown
}

type InitState = {
  initialized: boolean
  canInitialize: boolean
  hasSession: boolean
  hasPasskey: boolean
  registrationAvailable: boolean
}

function getSession(request: Request) {
  return auth.api.getSession({ headers: request.headers })
}

function findAdminRoleUsers(context: Awaited<typeof auth.$context>) {
  return context.adapter.findMany<RoleUser>({
    model: 'user',
    where: [{ field: 'role', value: ADMIN_ROLE, operator: 'contains' }],
    select: ['id', 'role'],
  })
}

async function getInitState(userId?: string): Promise<InitState> {
  const context = await auth.$context
  const roleUsers = await findAdminRoleUsers(context)
  const initialized = roleUsers.some((user) => isAdminRole(user.role))
  const pendingAdmin = roleUsers.some((user) => isPendingAdminRole(user.role))
  const currentUser = userId
    ? await context.internalAdapter.findUserById(userId)
    : null
  const hasPasskey = userId
    ? Boolean(
        await context.adapter.findOne({
          model: 'passkey',
          where: [{ field: 'userId', value: userId }],
          select: ['id'],
        }),
      )
    : false

  return {
    initialized,
    canInitialize:
      !initialized &&
      Boolean(userId && isPendingAdminRole(getUserRole(currentUser))),
    hasSession: Boolean(userId),
    hasPasskey,
    registrationAvailable: !initialized && !pendingAdmin,
  }
}

export const Route = createFileRoute('/api/admin/init')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const session = await getSession(request)
        return Response.json(await getInitState(session?.user.id))
      },
      POST: async ({ request }: { request: Request }) => {
        const session = await getSession(request)
        if (!session) {
          return Response.json(
            { message: '请先开始管理员注册。' },
            { status: 401 },
          )
        }

        try {
          const context = await auth.$context
          const result = await context.adapter.transaction(async () => {
            const roleUsers = await findAdminRoleUsers(context)

            if (roleUsers.some((user) => isAdminRole(user.role))) {
              return { status: 'initialized' as const }
            }
            const currentUser = await context.internalAdapter.findUserById(
              session.user.id,
            )
            if (!currentUser || !isPendingAdminRole(getUserRole(currentUser))) {
              return { status: 'forbidden' as const }
            }

            const passkey = await context.adapter.findOne({
              model: 'passkey',
              where: [{ field: 'userId', value: session.user.id }],
              select: ['id'],
            })
            if (!passkey) return { status: 'passkey_required' as const }

            const now = new Date()
            const existingReservation =
              await context.internalAdapter.findVerificationValue(
                ADMIN_INITIALIZATION_RESERVATION,
              )
            if (existingReservation && existingReservation.expiresAt <= now) {
              await context.internalAdapter.deleteVerificationByIdentifier(
                ADMIN_INITIALIZATION_RESERVATION,
              )
            }

            const reserved =
              await context.internalAdapter.reserveVerificationValue({
                identifier: ADMIN_INITIALIZATION_RESERVATION,
                value: session.user.id,
                expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
              })
            if (!reserved) return { status: 'conflict' as const }

            try {
              await context.internalAdapter.updateUser(session.user.id, {
                role: ADMIN_ROLE,
              })
            } catch (error) {
              await context.internalAdapter.deleteVerificationByIdentifier(
                ADMIN_INITIALIZATION_RESERVATION,
              )
              throw error
            }
            return { status: 'initialized' as const }
          })

          if (result.status === 'forbidden') {
            return Response.json(
              { message: '当前账户不能完成管理员注册。' },
              { status: 403 },
            )
          }
          if (result.status === 'passkey_required') {
            return Response.json(
              { message: '请先绑定至少一个 Passkey。' },
              { status: 400 },
            )
          }
          if (result.status === 'conflict') {
            return Response.json(
              { message: '管理员初始化正在进行中，请稍后重试。' },
              { status: 409 },
            )
          }
          return Response.json({ initialized: true })
        } catch (error) {
          return Response.json(
            {
              message:
                error instanceof Error ? error.message : '管理员初始化失败。',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
