import { useEffect, useState } from 'react'

import {
  isPluginMessage,
  pluginChannel,
  pluginProtocolVersion,
} from '#/lib/plugin-protocol'
import type { PluginCapability, PluginDescriptor } from '#/lib/plugin-protocol'

type PluginState = {
  descriptor: PluginDescriptor | null
  ready: boolean
}

type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
  abortCleanup?: () => void
}

function createId() {
  try {
    return globalThis.crypto.randomUUID()
  } catch {
    return Math.random().toString(36).slice(2)
  }
}

export class PluginBridge {
  private readonly nonce = createId()
  private started = false
  private attempts = 0
  private state: PluginState = { descriptor: null, ready: false }
  private readonly pending = new Map<string, PendingRequest>()
  private readonly listeners = new Set<(state: PluginState) => void>()

  private readonly onMessage = (event: MessageEvent) => {
    if (event.source !== window || !isPluginMessage(event.data)) return
    const message = event.data
    if (message.nonce !== this.nonce) return

    if (message.type === 'bili-sign:ready') {
      this.state = { descriptor: message.plugin, ready: true }
      this.listeners.forEach((listener) => listener(this.state))
      return
    }

    if (message.type === 'bili-sign:response') {
      const pending = this.pending.get(message.requestId)
      if (!pending) return
      clearTimeout(pending.timer)
      pending.abortCleanup?.()
      this.pending.delete(message.requestId)
      if (message.ok) pending.resolve(message.data)
      else pending.reject(new Error(message.error ?? '插件请求失败'))
    }
  }

  start() {
    if (typeof window === 'undefined' || this.started) return
    this.started = true
    window.addEventListener('message', this.onMessage)
    this.sendHello()
  }

  private sendHello() {
    if (this.state.ready || this.attempts >= 3) return
    this.attempts += 1
    window.postMessage(
      {
        channel: pluginChannel,
        type: 'bili-sign:hello',
        protocolVersion: pluginProtocolVersion,
        nonce: this.nonce,
      },
      window.location.origin,
    )
    window.setTimeout(() => this.sendHello(), 800)
  }

  subscribe(listener: (state: PluginState) => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getState() {
    return this.state
  }

  hasCapability(capability: PluginCapability) {
    return this.state.descriptor?.capabilities.includes(capability) ?? false
  }

  request<T>(
    capability: PluginCapability,
    method: string,
    payload: unknown,
    timeout = 12_000,
    signal?: AbortSignal,
  ) {
    if (!this.hasCapability(capability)) {
      return Promise.reject(new Error('未检测到支持该功能的插件'))
    }
    const requestId = createId()
    return new Promise<T>((resolve, reject) => {
      const cancel = () => {
        const pending = this.pending.get(requestId)
        if (!pending) return
        clearTimeout(pending.timer)
        pending.abortCleanup?.()
        this.pending.delete(requestId)
        reject(new Error('插件请求已取消'))
      }
      if (signal?.aborted) {
        reject(new Error('插件请求已取消'))
        return
      }
      const timer = setTimeout(() => {
        this.pending.delete(requestId)
        signal?.removeEventListener('abort', cancel)
        reject(new Error('插件响应超时'))
      }, timeout)
      signal?.addEventListener('abort', cancel, { once: true })
      this.pending.set(requestId, {
        resolve: (value) => resolve(value as T),
        reject,
        timer,
        abortCleanup: () => signal?.removeEventListener('abort', cancel),
      })
      window.postMessage(
        {
          channel: pluginChannel,
          type: 'bili-sign:request',
          nonce: this.nonce,
          requestId,
          capability,
          method,
          payload,
        },
        window.location.origin,
      )
    })
  }

  notify(event: string, flowId: string, payload: unknown) {
    if (!this.state.ready) return
    window.postMessage(
      {
        channel: pluginChannel,
        type: 'bili-sign:event',
        nonce: this.nonce,
        event,
        flowId,
        payload,
      },
      window.location.origin,
    )
  }
}

export const pluginBridge = new PluginBridge()

export function usePluginBridge() {
  const [state, setState] = useState(pluginBridge.getState())
  useEffect(() => {
    pluginBridge.start()
    return pluginBridge.subscribe(setState)
  }, [])
  return state
}
