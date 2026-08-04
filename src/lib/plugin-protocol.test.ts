import { describe, expect, it } from 'vite-plus/test'

import { isPluginMessage, pluginChannel } from './plugin-protocol'

describe('plugin protocol', () => {
  it('accepts a valid ready message and filters unknown capabilities', () => {
    expect(
      isPluginMessage({
        channel: pluginChannel,
        type: 'bili-sign:ready',
        protocolVersion: 1,
        nonce: 'nonce',
        plugin: {
          id: 'example',
          name: 'Example',
          version: '1.0.0',
          capabilities: ['bili.mid.read'],
        },
      }),
    ).toBe(true)
    expect(
      isPluginMessage({
        channel: pluginChannel,
        type: 'bili-sign:ready',
        nonce: 'nonce',
        plugin: {
          id: 'example',
          name: 'Example',
          version: '1.0.0',
          capabilities: ['read.cookies'],
        },
      }),
    ).toBe(false)
  })

  it('requires a nonce and the expected channel', () => {
    expect(isPluginMessage({ type: 'bili-sign:ready', nonce: 'nonce' })).toBe(
      false,
    )
    expect(
      isPluginMessage({
        channel: pluginChannel,
        type: 'bili-sign:response',
        nonce: 'nonce',
        requestId: 'request',
        ok: true,
      }),
    ).toBe(true)
  })
})
