import { describe, expect, it } from 'vite-plus/test'

import { resolveB23Text, resolveB23Url } from './b23-resolver'

function response(status: number, location?: string) {
  return new Response(null, {
    status,
    headers: location ? { location } : undefined,
  })
}

describe('b23 resolver', () => {
  it('follows redirects and returns a Bilibili space URL', async () => {
    const requested: Array<string> = []
    const result = await resolveB23Url('https://b23.tv/short', {
      fetcher: (url) => {
        requested.push(url)
        return requested.length === 1
          ? response(302, 'https://space.bilibili.com/123456')
          : response(200)
      },
    })

    expect(result).toBe('https://space.bilibili.com/123456')
    expect(requested).toEqual([
      'https://b23.tv/short',
      'https://space.bilibili.com/123456',
    ])
  })

  it('replaces a short link after it redirects to a space page', async () => {
    let requestCount = 0
    const result = await resolveB23Text('账号：https://b23.tv/short', {
      fetcher: () => {
        requestCount += 1
        return requestCount === 1
          ? response(302, 'https://space.bilibili.com/123456')
          : response(200)
      },
    })

    expect(result.text).toContain('https://space.bilibili.com/123456')
    expect(result.links[0]?.target).toBe('https://space.bilibili.com/123456')
  })

  it('rejects a redirect to an unrelated host', async () => {
    await expect(
      resolveB23Url('https://b23.tv/short', {
        fetcher: () => response(302, 'https://example.com/elsewhere'),
      }),
    ).rejects.toThrow('短链接跳转目标不是 B 站页面')
  })

  it('converts an aborted request into a readable timeout error', async () => {
    await expect(
      resolveB23Url('https://b23.tv/short', {
        timeout: 1,
        fetcher: (_url, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              const error = new Error('aborted')
              error.name = 'AbortError'
              reject(error)
            })
          }),
      }),
    ).rejects.toThrow('短链接解析超时')
  })

  it('rejects requests without a b23 link', async () => {
    await expect(resolveB23Text('123456')).rejects.toThrow(
      '请输入 b23.tv 短链接',
    )
  })
})
