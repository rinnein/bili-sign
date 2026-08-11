import type { PluginCapability } from './plugin-protocol'

export const pluginCapabilityLabels: Record<PluginCapability, string> = {
  'bili.mid.read': '读取当前 B 站 MID',
  'bili.api.proxy': '代理 B 站请求（优先覆盖登录与资料功能）',
  'bili.direct-login': '快捷签名登录',
}

export type EffectivePluginLoginMode = 'proxy' | 'direct' | null

export function getEffectivePluginLoginMode(
  capabilities: ReadonlyArray<PluginCapability> | null | undefined,
): EffectivePluginLoginMode {
  if (capabilities?.includes('bili.api.proxy')) return 'proxy'
  if (capabilities?.includes('bili.direct-login')) return 'direct'
  return null
}

export function getPluginCapabilityLabels(
  capabilities: ReadonlyArray<PluginCapability>,
): Array<string> {
  if (capabilities.length === 0) return ['未声明可用能力']
  return capabilities.map((capability) => pluginCapabilityLabels[capability])
}
