import { describe, expect, it } from 'vite-plus/test'

import { createOAuthProviderPlugin } from './auth-client'

describe('OAuth provider client configuration', () => {
  it('does not register the global OAuth query injection plugin', () => {
    const plugin = createOAuthProviderPlugin()

    expect(plugin).not.toHaveProperty('fetchPlugins')
    expect(plugin.id).toBe('oauth-provider-client')
    expect(plugin.$InferServerPlugin).toBeDefined()
  })
})
