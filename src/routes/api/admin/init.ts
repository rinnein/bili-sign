import { createFileRoute } from '@tanstack/react-router'

import { auth } from '#/lib/auth'
import {
  ADMIN_BOOTSTRAP_RESERVATION,
  ADMIN_BOOTSTRAP_TTL_MS,
  ADMIN_INITIALIZATION_RESERVATION,
  ADMIN_ROLE,
  findAdminUser,
  findPendingAdminUser,
  getUserRole,
  isPendingAdminRole,
} from '#/lib/admin'

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

function isPendingRegistrationRecent(createdAt: Date | string | undefined) {
  if (!createdAt) return false
  const timestamp =
    createdAt instanceof Date ? createdAt.getTime() : Date.parse(createdAt)
  return (
    Number.isFinite(timestamp) &&
    Date.now() - timestamp < ADMIN_BOOTSTRAP_TTL_MS
  )
}

async function getInitState(userId?: string): Promise<InitState> {
  const context = await auth.$context
  const [adminUser, pendingAdmin] = await Promise.all([
    findAdminUser(context.adapter),
    findPendingAdminUser(context.adapter),
  ])
  const pendingRegistrationActive = Boolean(
    pendingAdmin && isPendingRegistrationRecent(pendingAdmin.createdAt),
  )
  const initialized = Boolean(adminUser)
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
      pendingRegistrationActive &&
      Boolean(userId && isPendingAdminRole(getUserRole(currentUser))),
    hasSession: Boolean(userId),
    hasPasskey,
    registrationAvailable: !initialized && !pendingRegistrationActive,
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
            if (await findAdminUser(context.adapter)) {
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
            const bootstrapReservation =
              await context.internalAdapter.findVerificationValue(
                ADMIN_BOOTSTRAP_RESERVATION,
              )
            if (
              !bootstrapReservation ||
              bootstrapReservation.value !== session.user.id ||
              bootstrapReservation.expiresAt <= now
            ) {
              return { status: 'expired' as const }
            }

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
              await context.internalAdapter.deleteVerificationByIdentifier(
                ADMIN_INITIALIZATION_RESERVATION,
              )
              await context.internalAdapter.deleteVerificationByIdentifier(
                ADMIN_BOOTSTRAP_RESERVATION,
              )
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
          if (result.status === 'expired') {
            return Response.json(
              { message: '管理员注册已过期，请重新开始。' },
              { status: 409 },
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
