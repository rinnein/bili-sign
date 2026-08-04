import { authFetch } from '#/lib/auth-client'

export async function continueOAuthLogin() {
  if (typeof window === 'undefined') return false

  const oauthQuery = window.location.search.slice(1)
  if (!oauthQuery.includes('client_id=') || !oauthQuery.includes('sig=')) {
    return false
  }

  const response = await authFetch('/api/auth/oauth2/continue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ oauth_query: oauthQuery, created: true }),
  })
  const result = (await response.json()) as {
    redirect_uri?: string
    error?: string
  }
  if (!response.ok || !result.redirect_uri) {
    throw new Error(result.error ?? '无法继续授权，请重新发起登录。')
  }

  window.location.assign(result.redirect_uri)
  return true
}
