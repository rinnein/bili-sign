import { authClient } from '#/lib/auth-client'

export type OAuthSearch = Record<string, string>

export type OAuthContinuation =
  | {
      kind: 'none'
    }
  | {
      kind: 'valid'
      query: string
      search: OAuthSearch
    }
  | {
      kind: 'invalid'
      message: string
    }

function queryFromSearch(search: string) {
  return search.startsWith('?') ? search.slice(1) : search
}

export function searchToObject(search: string): OAuthSearch {
  return Object.fromEntries(new URLSearchParams(queryFromSearch(search)))
}

export function inspectOAuthContinuation(search: string): OAuthContinuation {
  const query = queryFromSearch(search)
  if (!query) return { kind: 'none' }

  const params = new URLSearchParams(query)
  const requiredParameters = [
    'client_id',
    'redirect_uri',
    'sig',
    'exp',
  ] as const
  const hasOAuthParameter = requiredParameters.some((name) => params.has(name))
  if (!hasOAuthParameter) return { kind: 'none' }

  const missingParameter = requiredParameters.find((name) => !params.get(name))
  if (missingParameter) {
    return {
      kind: 'invalid',
      message: `OAuth 授权请求缺少必要参数：${missingParameter}`,
    }
  }

  const expiresAt = Number(params.get('exp')) * 1000
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return { kind: 'invalid', message: 'OAuth 授权请求已过期，请重新发起。' }
  }

  return {
    kind: 'valid',
    query,
    search: searchToObject(query),
  }
}

export async function continueOAuthLogin(oauthQuery?: string) {
  if (typeof window === 'undefined' && oauthQuery === undefined) return false

  const continuation = inspectOAuthContinuation(
    oauthQuery ?? window.location.search,
  )
  if (continuation.kind === 'none') return false
  if (continuation.kind === 'invalid') throw new Error(continuation.message)

  const result = await authClient.oauth2.continue({
    oauth_query: continuation.query,
    created: true,
  })
  if (result.error) {
    throw new Error(result.error.message ?? '无法继续授权，请重新发起登录。')
  }

  window.location.assign(result.data.url)
  return true
}
