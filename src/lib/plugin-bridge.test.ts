import { beforeEach, describe, expect, it } from 'vite-plus/test'

import { PluginBridge } from './plugin-bridge'
import { pluginChannel } from './plugin-protocol'

type MessageListener = (event: MessageEvent) => void

function installWindow() {
  const messages: Array<Record<string, unknown>> = []
  const listeners: Array<MessageListener> = []
  const fakeWindow = {
    location: { origin: 'http://localhost' },
    addEventListener: (_type: string, listener: MessageListener) => {
      listeners.push(listener)
    },
    postMessage: (message: Record<string, unknown>) => {
      messages.push(message)
    },
    setTimeout,
  }
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: fakeWindow,
  })
  return { fakeWindow, messages, listeners }
}

describe('plugin bridge', () => {
  beforeEach(() => {
    installWindow()
  })

  it('uses the hello nonce for ready messages and request responses', async () => {
    const { fakeWindow, messages, listeners } = installWindow()
    const bridge = new PluginBridge()
    bridge.start()

    const hello = messages[0]
    listeners[0]({
      source: fakeWindow,
      data: {
        channel: pluginChannel,
        type: 'bili-sign:ready',
        protocolVersion: 1,
        nonce: hello.nonce,
        plugin: {
          id: 'example',
          name: 'Example',
          version: '1.0.0',
          capabilities: ['bili.mid.read'],
        },
      },
    } as unknown as MessageEvent)

    const resultPromise = bridge.request<{ mid: string }>(
      'bili.mid.read',
      'mid.get',
      {},
    )
    const request = messages.at(-1)!
    listeners[0]({
      source: fakeWindow,
      data: {
        channel: pluginChannel,
        type: 'bili-sign:response',
        nonce: hello.nonce,
        requestId: request.requestId,
        ok: true,
        data: { mid: '123456' },
      },
    } as unknown as MessageEvent)

    await expect(resultPromise).resolves.toEqual({ mid: '123456' })
  })

  it('waits for the handshake before exposing plugin capabilities', async () => {
    const { fakeWindow, messages, listeners } = installWindow()
    const bridge = new PluginBridge()
    const readyPromise = bridge.waitUntilReady(100)
    const hello = messages[0]

    listeners[0]({
      source: fakeWindow,
      data: {
        channel: pluginChannel,
        type: 'bili-sign:ready',
        protocolVersion: 1,
        nonce: hello.nonce,
        plugin: {
          id: 'example',
          name: 'Example',
          version: '1.0.0',
          capabilities: ['bili.api.proxy'],
        },
      },
    } as unknown as MessageEvent)

    await expect(readyPromise).resolves.toMatchObject({
      capabilities: ['bili.api.proxy'],
    })
  })

  it('rejects unsupported capabilities and timed out requests', async () => {
    const { fakeWindow, messages, listeners } = installWindow()
    const bridge = new PluginBridge()
    bridge.start()
    const hello = messages[0]
    listeners[0]({
      source: fakeWindow,
      data: {
        channel: pluginChannel,
        type: 'bili-sign:ready',
        protocolVersion: 1,
        nonce: hello.nonce,
        plugin: {
          id: 'example',
          name: 'Example',
          version: '1.0.0',
          capabilities: ['bili.mid.read'],
        },
      },
    } as unknown as MessageEvent)

    await expect(
      bridge.request('bili.api.proxy', 'bili.public-info.get', {}),
    ).rejects.toThrow('未检测到支持该功能的插件')
    await expect(
      bridge.request('bili.mid.read', 'mid.get', {}, 1),
    ).rejects.toThrow('插件响应超时')
  })

  it('cancels an in-flight request with AbortSignal', async () => {
    const { fakeWindow, messages, listeners } = installWindow()
    const bridge = new PluginBridge()
    bridge.start()
    const hello = messages[0]
    listeners[0]({
      source: fakeWindow,
      data: {
        channel: pluginChannel,
        type: 'bili-sign:ready',
        protocolVersion: 1,
        nonce: hello.nonce,
        plugin: {
          id: 'example',
          name: 'Example',
          version: '1.0.0',
          capabilities: ['bili.mid.read'],
        },
      },
    } as unknown as MessageEvent)

    const controller = new AbortController()
    const request = bridge.request(
      'bili.mid.read',
      'mid.get',
      {},
      10_000,
      controller.signal,
    )
    controller.abort()

    await expect(request).rejects.toThrow('插件请求已取消')
  })
})
