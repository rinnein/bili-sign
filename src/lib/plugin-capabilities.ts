import type { PluginCapability } from './plugin-protocol'

export const pluginCapabilityLabels: Record<PluginCapability, string> = {
  'bili.mid.read': '读取 B 站 MID',
  'bili.api.proxy': '代理 B 站公开资料请求',
  'bili.direct-login': '快捷签名登录',
}

export function getPluginCapabilityLabels(
  capabilities: ReadonlyArray<PluginCapability>,
): Array<string> {
  if (capabilities.length === 0) return ['未声明可用能力']
  return capabilities.map((capability) => pluginCapabilityLabels[capability])
}
