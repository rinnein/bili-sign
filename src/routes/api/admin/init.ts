import { createFileRoute } from '@tanstack/react-router'

import { auth } from '#/lib/auth'
import { database } from '#/lib/database'
import { isAdminRole, isPendingAdminRole } from '#/lib/admin'

type InitState = {
  initialized: boolean
  canInitialize: boolean
  hasSession: boolean
  hasPasskey: boolean
  registrationAvailable: boolean
}

async function getSession(request: Request) {
  return auth.api.getSession({ headers: request.headers })
}

async function getInitState(userId?: string): Promise<InitState> {
  const users = await database
    .selectFrom('user')
    .select(['id', 'role', 'createdAt'])
    .orderBy('createdAt', 'asc')
    .execute()
  const initialized = users.some((user) => isAdminRole(user.role))
  const pendingAdmin = users.some((user) => isPendingAdminRole(user.role))
  const hasPasskey = userId
    ? Boolean(
        await database
          .selectFrom('passkey')
          .select('id')
          .where('userId', '=', userId)
          .executeTakeFirst(),
      )
    : false

  return {
    initialized,
    canInitialize:
      !initialized &&
      Boolean(
        userId &&
        users.some(
          (user) => user.id === userId && isPendingAdminRole(user.role),
        ),
      ),
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
          const result = await database.transaction().execute(async (tx) => {
            const users = await tx
              .selectFrom('user')
              .select(['id', 'role', 'createdAt'])
              .orderBy('createdAt', 'asc')
              .execute()

            if (users.some((user) => isAdminRole(user.role))) {
              return { status: 'initialized' as const }
            }
            const currentUser = users.find(
              (user) => user.id === session.user.id,
            )
            if (!currentUser || !isPendingAdminRole(currentUser.role)) {
              return { status: 'forbidden' as const }
            }

            const passkey = await tx
              .selectFrom('passkey')
              .select('id')
              .where('userId', '=', session.user.id)
              .executeTakeFirst()
            if (!passkey) return { status: 'passkey_required' as const }

            await tx
              .updateTable('user')
              .set({ role: 'admin' })
              .where('id', '=', session.user.id)
              .execute()
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
