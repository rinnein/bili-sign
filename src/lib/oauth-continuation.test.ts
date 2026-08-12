import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { authClient } from '#/lib/auth-client'
import {
  continueOAuthLogin,
  inspectOAuthContinuation,
  searchToObject,
} from './oauth-continuation'

vi.mock('#/lib/auth-client', () => ({
  authClient: {
    oauth2: {
      continue: vi.fn(),
    },
  },
}))

const originalWindow = globalThis.window
const mockedOAuthContinue = vi.mocked(authClient.oauth2.continue)

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
    mockedOAuthContinue.mockResolvedValue({
      data: {
        redirect: true,
        url: 'https://client.example/callback?code=1',
      },
      error: null,
    })

    await expect(continueOAuthLogin()).resolves.toBe(true)
    expect(mockedOAuthContinue).toHaveBeenCalledWith({
      oauth_query: query,
      created: true,
    })
    expect(redirectedTo).toBe('https://client.example/callback?code=1')
  })

  it('notifies the caller before continuation and clears its pending state on failure', async () => {
    const query = validQuery()
    const onPending = vi.fn()
    const onFailure = vi.fn()
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { location: { search: `?${query}`, assign: vi.fn() } },
    })
    mockedOAuthContinue.mockResolvedValue({
      data: null,
      error: { message: '授权已失效' },
    })

    await expect(
      continueOAuthLogin(undefined, { onPending, onFailure }),
    ).rejects.toThrow('授权已失效')
    expect(onPending).toHaveBeenCalledTimes(1)
    expect(onFailure).toHaveBeenCalledTimes(1)
  })
})
