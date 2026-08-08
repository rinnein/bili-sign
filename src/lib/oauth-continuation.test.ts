import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { authFetch } from '#/lib/auth-client'
import {
  continueOAuthLogin,
  inspectOAuthContinuation,
  searchToObject,
} from './oauth-continuation'

vi.mock('#/lib/auth-client', () => ({
  authFetch: vi.fn(),
}))

const originalWindow = globalThis.window
const mockedAuthFetch = vi.mocked(authFetch)

afterEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: originalWindow,
  })
})

function validQuery() {
  return new URLSearchParams({
    client_id: 'client-123',
    redirect_uri: 'https://client.example/callback',
    scope: 'openid profile',
    state: 'state-123',
    sig: 'signature',
    exp: String(Math.floor(Date.now() / 1000) + 300),
  }).toString()
}

describe('OAuth continuation', () => {
  it('accepts a current signed OAuth query and converts it for Router search', () => {
    const query = validQuery()
    const result = inspectOAuthContinuation(`?${query}`)

    expect(result).toEqual({
      kind: 'valid',
      query,
      search: searchToObject(query),
    })
    expect(result.kind === 'valid' ? result.search.state : '').toBe('state-123')
  })

  it('rejects missing and expired OAuth parameters', () => {
    expect(inspectOAuthContinuation('?client_id=client-123')).toEqual({
      kind: 'invalid',
      message: 'OAuth 授权请求缺少必要参数：redirect_uri',
    })

    const expired = new URLSearchParams(validQuery())
    expired.set('exp', String(Math.floor(Date.now() / 1000) - 1))
    expect(inspectOAuthContinuation(expired.toString())).toEqual({
      kind: 'invalid',
      message: 'OAuth 授权请求已过期，请重新发起。',
    })
  })

  it('continues the authorization request with the signed query', async () => {
    const query = validQuery()
    let redirectedTo = ''
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: {
          search: `?${query}`,
          assign: (url: string) => {
            redirectedTo = url
          },
        },
      },
    })
    mockedAuthFetch.mockResolvedValue(
      Response.json({ redirect_uri: 'https://client.example/callback?code=1' }),
    )

    await expect(continueOAuthLogin()).resolves.toBe(true)
    expect(mockedAuthFetch).toHaveBeenCalledWith(
      '/api/auth/oauth2/continue',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    )
    const requestInit = mockedAuthFetch.mock.calls[0]?.[1]
    const requestBody = requestInit?.body
    expect(
      typeof requestBody === 'string' ? JSON.parse(requestBody) : null,
    ).toEqual({
      oauth_query: query,
      created: true,
    })
    expect(redirectedTo).toBe('https://client.example/callback?code=1')
  })
})
