import { createFileRoute } from '@tanstack/react-router'

import { auth } from '#/lib/auth'
import { database } from '#/lib/database'
import { isAdminRole, isPendingAdminRole } from '#/lib/admin'

type SafeClient = {
  client_id: string
  user_id?: string
  client_name?: string
  client_uri?: string
  redirect_uris: Array<string>
  scope?: string
  grant_types?: Array<string>
  response_types?: Array<string>
  client_id_issued_at?: number
  created_at?: string
  updated_at?: string
  disabled?: boolean
  public?: boolean
}

function toSafeClient(client: {
  clientId: string
  userId: string | null
  name: string | null
  uri: string | null
  redirectUris: Array<string>
  scopes: Array<string> | null
  grantTypes: Array<string> | null
  responseTypes: Array<string> | null
  createdAt: Date | null
  updatedAt: Date | null
  disabled: boolean | null
  public: boolean | null
}): SafeClient {
  return {
    client_id: client.clientId,
    user_id: client.userId ?? undefined,
    client_name: client.name ?? undefined,
    client_uri: client.uri ?? undefined,
    redirect_uris: client.redirectUris,
    scope: client.scopes?.join(' '),
    grant_types: client.grantTypes ?? undefined,
    response_types: client.responseTypes ?? undefined,
    client_id_issued_at: client.createdAt
      ? Math.floor(client.createdAt.getTime() / 1000)
      : undefined,
    created_at: client.createdAt?.toISOString(),
    updated_at: client.updatedAt?.toISOString(),
    disabled: client.disabled ?? undefined,
    public: client.public ?? undefined,
  }
}

async function getSession(request: Request) {
  return auth.api.getSession({ headers: request.headers })
}

export const Route = createFileRoute('/api/admin/clients')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const session = await getSession(request)
        if (!session)
          return Response.json({ message: '请先登录。' }, { status: 401 })

        const currentUser = await database
          .selectFrom('user')
          .select('role')
          .where('id', '=', session.user.id)
          .executeTakeFirst()
        if (isPendingAdminRole(currentUser?.role)) {
          return Response.json(
            { message: '请先完成管理员初始化。' },
            { status: 403 },
          )
        }

        const url = new URL(request.url)
        const all = url.searchParams.get('scope') === 'all'
        if (all && !isAdminRole(currentUser?.role)) {
          return Response.json({ message: '需要管理员权限。' }, { status: 403 })
        }

        const query = database
          .selectFrom('oauthClient')
          .select([
            'clientId',
            'userId',
            'name',
            'uri',
            'redirectUris',
            'scopes',
            'grantTypes',
            'responseTypes',
            'createdAt',
            'updatedAt',
            'disabled',
            'public',
          ])
          .orderBy('createdAt', 'desc')

        const clients = all
          ? await query.execute()
          : await query.where('userId', '=', session.user.id).execute()

        return Response.json(clients.map(toSafeClient))
      },
      DELETE: async ({ request }: { request: Request }) => {
        const session = await getSession(request)
        if (!session)
          return Response.json({ message: '请先登录。' }, { status: 401 })

        const currentUser = await database
          .selectFrom('user')
          .select('role')
          .where('id', '=', session.user.id)
          .executeTakeFirst()
        if (isPendingAdminRole(currentUser?.role)) {
          return Response.json(
            { message: '请先完成管理员初始化。' },
            { status: 403 },
          )
        }

        let body: { client_id?: unknown }
        try {
          body = (await request.json()) as { client_id?: unknown }
        } catch {
          return Response.json({ message: '请求格式无效。' }, { status: 400 })
        }
        if (typeof body.client_id !== 'string' || !body.client_id) {
          return Response.json({ message: '缺少 Client ID。' }, { status: 400 })
        }

        const client = await database
          .selectFrom('oauthClient')
          .select(['clientId', 'userId'])
          .where('clientId', '=', body.client_id)
          .executeTakeFirst()
        if (!client)
          return Response.json({ message: 'Client 不存在。' }, { status: 404 })
        if (
          client.userId !== session.user.id &&
          !isAdminRole(currentUser?.role)
        ) {
          return Response.json(
            { message: '没有删除此 Client 的权限。' },
            { status: 403 },
          )
        }

        await database
          .deleteFrom('oauthClient')
          .where('clientId', '=', body.client_id)
          .execute()
        return Response.json({ ok: true })
      },
    },
  },
})
