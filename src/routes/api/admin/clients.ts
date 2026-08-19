import { createFileRoute } from '@tanstack/react-router'

import { auth } from '#/lib/auth'
import { getUserRole, isAdminRole, isPendingAdminRole } from '#/lib/admin'

type SafeClient = {
  client_id: string
  user_id?: string
  client_name?: string
  client_uri?: string
  logo_uri?: string
  redirect_uris: Array<string>
  scope?: string
  contacts?: Array<string>
  tos_uri?: string
  policy_uri?: string
  software_id?: string
  software_version?: string
  software_statement?: string
  post_logout_redirect_uris?: Array<string>
  token_endpoint_auth_method?: string
  grant_types?: Array<string>
  response_types?: Array<string>
  application_type?: 'web' | 'native'
  require_pkce?: boolean
  client_id_issued_at?: number
  created_at?: string
  updated_at?: string
  disabled?: boolean
}

type OAuthClientRecord = {
  clientId: string
  userId: string | null
  name: string | null
  uri: string | null
  icon: string | null
  contacts: Array<string> | null
  tos: string | null
  policy: string | null
  softwareId: string | null
  softwareVersion: string | null
  softwareStatement: string | null
  redirectUris: Array<string>
  postLogoutRedirectUris: Array<string> | null
  tokenEndpointAuthMethod: string | null
  scopes: Array<string> | null
  grantTypes: Array<string> | null
  responseTypes: Array<string> | null
  applicationType: 'web' | 'native' | null
  requirePKCE: boolean | null
  createdAt: Date | null
  updatedAt: Date | null
  disabled: boolean | null
}

function toSafeClient(client: {
  clientId: string
  userId: string | null
  name: string | null
  uri: string | null
  icon: string | null
  contacts: Array<string> | null
  tos: string | null
  policy: string | null
  softwareId: string | null
  softwareVersion: string | null
  softwareStatement: string | null
  redirectUris: Array<string>
  postLogoutRedirectUris: Array<string> | null
  tokenEndpointAuthMethod: string | null
  scopes: Array<string> | null
  grantTypes: Array<string> | null
  responseTypes: Array<string> | null
  applicationType: 'web' | 'native' | null
  requirePKCE: boolean | null
  createdAt: Date | null
  updatedAt: Date | null
  disabled: boolean | null
}): SafeClient {
  return {
    client_id: client.clientId,
    user_id: client.userId ?? undefined,
    client_name: client.name ?? undefined,
    client_uri: client.uri ?? undefined,
    logo_uri: client.icon ?? undefined,
    redirect_uris: client.redirectUris,
    scope: client.scopes?.join(' '),
    contacts: client.contacts ?? undefined,
    tos_uri: client.tos ?? undefined,
    policy_uri: client.policy ?? undefined,
    software_id: client.softwareId ?? undefined,
    software_version: client.softwareVersion ?? undefined,
    software_statement: client.softwareStatement ?? undefined,
    post_logout_redirect_uris: client.postLogoutRedirectUris ?? undefined,
    token_endpoint_auth_method: client.tokenEndpointAuthMethod ?? undefined,
    grant_types: client.grantTypes ?? undefined,
    response_types: client.responseTypes ?? undefined,
    application_type: client.applicationType ?? undefined,
    require_pkce: client.requirePKCE ?? undefined,
    client_id_issued_at: client.createdAt
      ? Math.floor(client.createdAt.getTime() / 1000)
      : undefined,
    created_at: client.createdAt?.toISOString(),
    updated_at: client.updatedAt?.toISOString(),
    disabled: client.disabled ?? undefined,
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
            'icon',
            'contacts',
            'tos',
            'policy',
            'softwareId',
            'softwareVersion',
            'softwareStatement',
            'redirectUris',
            'postLogoutRedirectUris',
            'tokenEndpointAuthMethod',
            'scopes',
            'grantTypes',
            'responseTypes',
            'applicationType',
            'requirePKCE',
            'createdAt',
            'updatedAt',
            'disabled',
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
