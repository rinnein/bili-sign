import { describe, expect, it, vi } from 'vite-plus/test'

import { readPluginMid } from './plugin-mid'

describe('plugin MID fallback order', () => {
  it('prefers bili.mid.read over the API proxy', async () => {
    const readWithMid = vi.fn().mockResolvedValue({ mid: '123456' })
    const readWithProxy = vi.fn()

    await expect(
      readPluginMid({
        capabilities: ['bili.mid.read', 'bili.api.proxy'],
        readWithMid,
        readWithProxy,
      }),
    ).resolves.toBe('123456')
    expect(readWithMid).toHaveBeenCalledOnce()
    expect(readWithProxy).not.toHaveBeenCalled()
  })

  it('falls back to the current Bilibili session through the API proxy', async () => {
    const readWithMid = vi.fn().mockRejectedValue(new Error('mid unavailable'))
    const readWithProxy = vi.fn().mockResolvedValue({
      code: 0,
      data: { isLogin: true, mid: 654321 },
    })

    await expect(
      readPluginMid({
        capabilities: ['bili.mid.read', 'bili.api.proxy'],
        readWithMid,
        readWithProxy,
      }),
    ).resolves.toBe('654321')
    expect(readWithMid).toHaveBeenCalledOnce()
    expect(readWithProxy).toHaveBeenCalledOnce()
  })
})
