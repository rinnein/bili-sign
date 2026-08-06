import { createFileRoute } from '@tanstack/react-router'

import { auth } from '#/lib/auth'
import { getUserRole, isAdminRole, isPendingAdminRole } from '#/lib/admin'

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

type OAuthClientRecord = {
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

        const context = await auth.$context
        const currentUser = await context.internalAdapter.findUserById(
          session.user.id,
        )
        if (isPendingAdminRole(getUserRole(currentUser))) {
          return Response.json(
            { message: '请先完成管理员初始化。' },
            { status: 403 },
          )
        }

        const url = new URL(request.url)
        const all = url.searchParams.get('scope') === 'all'
        if (all && !isAdminRole(getUserRole(currentUser))) {
          return Response.json({ message: '需要管理员权限。' }, { status: 403 })
        }

        const clients = await context.adapter.findMany<OAuthClientRecord>({
          model: 'oauthClient',
          select: [
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
          ],
          sortBy: { field: 'createdAt', direction: 'desc' },
          where: all
            ? undefined
            : [{ field: 'userId', value: session.user.id }],
        })

        return Response.json(clients.map(toSafeClient))
      },
      DELETE: async ({ request }: { request: Request }) => {
        const session = await getSession(request)
        if (!session)
          return Response.json({ message: '请先登录。' }, { status: 401 })

        const context = await auth.$context
        const currentUser = await context.internalAdapter.findUserById(
          session.user.id,
        )
        if (isPendingAdminRole(getUserRole(currentUser))) {
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

        const client = await context.adapter.findOne<
          Pick<OAuthClientRecord, 'clientId' | 'userId'>
        >({
          model: 'oauthClient',
          where: [{ field: 'clientId', value: body.client_id }],
          select: ['clientId', 'userId'],
        })
        if (!client)
          return Response.json({ message: 'Client 不存在。' }, { status: 404 })
        if (
          client.userId !== session.user.id &&
          !isAdminRole(getUserRole(currentUser))
        ) {
          return Response.json(
            { message: '没有删除此 Client 的权限。' },
            { status: 403 },
          )
        }

        await context.adapter.delete({
          model: 'oauthClient',
          where: [{ field: 'clientId', value: body.client_id }],
        })
        return Response.json({ ok: true })
      },
    },
  },
})
