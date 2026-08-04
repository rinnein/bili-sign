export const pluginChannel = 'bili-sign/plugin'
export const pluginProtocolVersion = 1

export type PluginCapability =
  | 'bili.mid.read'
  | 'bili.api.proxy'
  | 'bili.direct-login'

export type PluginDescriptor = {
  id: string
  name: string
  version: string
  capabilities: Array<PluginCapability>
}

const capabilities = new Set<PluginCapability>([
  'bili.mid.read',
  'bili.api.proxy',
  'bili.direct-login',
])

export function isPluginDescriptor(value: unknown): value is PluginDescriptor {
  if (typeof value !== 'object' || value === null) return false
  const descriptor = value as Record<string, unknown>
  return (
    typeof descriptor.id === 'string' &&
    typeof descriptor.name === 'string' &&
    typeof descriptor.version === 'string' &&
    Array.isArray(descriptor.capabilities) &&
    descriptor.capabilities.every(
      (capability) =>
        typeof capability === 'string' &&
        capabilities.has(capability as PluginCapability),
    )
  )
}

export type PluginMessage =
  | {
      channel: typeof pluginChannel
      type: 'bili-sign:hello'
      protocolVersion: number
      nonce: string
    }
  | {
      channel: typeof pluginChannel
      type: 'bili-sign:ready'
      protocolVersion: number
      nonce: string
      plugin: PluginDescriptor
    }
  | {
      channel: typeof pluginChannel
      type: 'bili-sign:request'
      nonce: string
      requestId: string
      capability: PluginCapability
      method: string
      payload: unknown
    }
  | {
      channel: typeof pluginChannel
      type: 'bili-sign:response'
      nonce: string
      requestId: string
      ok: boolean
      data?: unknown
      error?: string
    }
  | {
      channel: typeof pluginChannel
      type: 'bili-sign:event'
      nonce: string
      event: string
      flowId?: string
      payload?: unknown
    }

export function isPluginMessage(value: unknown): value is PluginMessage {
  if (typeof value !== 'object' || value === null) return false
  const message = value as Record<string, unknown>
  if (
    message.channel === pluginChannel &&
    typeof message.type === 'string' &&
    message.type.startsWith('bili-sign:') &&
    typeof message.nonce === 'string'
  ) {
    if (message.type === 'bili-sign:ready') {
      return isPluginDescriptor(message.plugin)
    }
    if (message.type === 'bili-sign:response') {
      return (
        typeof message.requestId === 'string' && typeof message.ok === 'boolean'
      )
    }
    return true
  }
  return false
}
