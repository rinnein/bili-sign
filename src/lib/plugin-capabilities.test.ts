import { describe, expect, it } from 'vite-plus/test'

import {
  getPluginCapabilityLabels,
  pluginCapabilityLabels,
} from './plugin-capabilities'

describe('plugin capability labels', () => {
  it('maps every protocol capability to a user-facing label', () => {
    expect(Object.keys(pluginCapabilityLabels)).toEqual([
      'bili.mid.read',
      'bili.api.proxy',
      'bili.direct-login',
    ])
  })

  it('preserves the descriptor capability order', () => {
    expect(
      getPluginCapabilityLabels(['bili.api.proxy', 'bili.mid.read']),
    ).toEqual(['代理 B 站请求（优先覆盖登录与资料功能）', '读取当前 B 站 MID'])
  })

  it('explains an empty capability declaration', () => {
    expect(getPluginCapabilityLabels([])).toEqual(['未声明可用能力'])
  })
})
