import { afterEach, describe, expect, it } from 'vite-plus/test'

import { resolveMidInput } from './mid'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('resolveMidInput', () => {
  it('converts a non-JSON short-link response into a readable error', async () => {
    globalThis.fetch = () =>
      Promise.resolve(
        new Response('<!DOCTYPE html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
      )

    await expect(resolveMidInput('https://b23.tv/example')).rejects.toThrow(
      '短链接解析服务暂时不可用，请稍后重试',
    )
  })
})
