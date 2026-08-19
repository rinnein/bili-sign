import { describe, expect, it } from 'vite-plus/test'

import {
  normalizeOAuthGrantTypes,
  parseOAuthClientLines,
  toOAuthClientRequestValues,
  validateOAuthClientFormValues,
} from './oauth-client-form'
import type { OAuthClientFormValues } from './oauth-client-form'

const baseValues: OAuthClientFormValues = {
  client_name: 'Example',
  client_uri: 'https://example.com',
  logo_uri: '',
  redirect_uris: 'https://example.com/callback\n\n https://example.com/other ',
  scope: 'openid profile bili:public',
  contacts: '',
  tos_uri: '',
  policy_uri: '',
  software_id: '',
  software_version: '',
  software_statement: '',
  post_logout_redirect_uris: '',
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  application_type: 'web',
  token_endpoint_auth_method: 'none',
}

describe('OAuth client form helpers', () => {
  it('parses non-empty array values one per line', () => {
    expect(parseOAuthClientLines(' one\n\n two ')).toEqual(['one', 'two'])
  })

  it('requires a redirect URI and code response type', () => {
    expect(
      validateOAuthClientFormValues(
        { ...baseValues, redirect_uris: '' },
        'edit',
      ),
    ).toBe('至少需要填写一个 OAuth 回调 URL。')
    expect(
      validateOAuthClientFormValues(
        { ...baseValues, response_types: [] },
        'edit',
      ),
    ).toBe('当前 OAuth provider 必须保留 code response type。')
  })

  it('validates URLs and omits empty optional arrays', () => {
    expect(
      validateOAuthClientFormValues(
        { ...baseValues, client_uri: 'javascript:alert(1)' },
        'edit',
      ),
    ).toBe('应用主页 URL必须使用 HTTP 或 HTTPS。')

    const request = toOAuthClientRequestValues(baseValues, 'edit')
    expect(request.redirect_uris).toEqual([
      'https://example.com/callback',
      'https://example.com/other',
    ])
    expect(request.contacts).toBeUndefined()
    expect(request.post_logout_redirect_uris).toBeUndefined()
    expect(request.application_type).toBe('web')
  })

  it('uses a native client for HTTP loopback redirects', () => {
    const values = {
      ...baseValues,
      redirect_uris: 'http://localhost:3000/callback',
    }
    expect(validateOAuthClientFormValues(values, 'create')).toBeNull()
    expect(toOAuthClientRequestValues(values, 'create').application_type).toBe(
      'native',
    )
  })

  it('keeps public authentication independent from application type', () => {
    const values = {
      ...baseValues,
      token_endpoint_auth_method: 'none' as const,
    }
    expect(validateOAuthClientFormValues(values, 'create')).toBeNull()
    expect(values.token_endpoint_auth_method).toBe('none')
    expect(toOAuthClientRequestValues(values, 'create').application_type).toBe(
      'web',
    )
  })

  it('removes unsupported grant types from legacy client data', () => {
    expect(
      normalizeOAuthGrantTypes([
        'authorization_code',
        'client_credentials',
        'refresh_token',
      ]),
    ).toEqual(['authorization_code', 'refresh_token'])
  })
})
