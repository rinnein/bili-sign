import { extractB23Links, extractMid } from '#/lib/mid'

const allowedHosts = new Set(['b23.tv', 'www.b23.tv'])
const timeoutMs = 5000
const maxRedirects = 5

type Fetcher = (
  input: string,
  init?: RequestInit,
) => Response | Promise<Response>

function isBilibiliHost(hostname: string) {
  return hostname === 'bilibili.com' || hostname.endsWith('.bilibili.com')
}

function normalizeB23Url(value: string) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname)) {
    throw new Error('只支持 HTTPS b23.tv 短链接')
  }
  return url.toString()
}

export async function resolveB23Url(
  value: string,
  options: { fetcher?: Fetcher; timeout?: number } = {},
) {
  const fetcher = options.fetcher ?? fetch
  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(),
    options.timeout ?? timeoutMs,
  )
  let current = normalizeB23Url(value)

  try {
    for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
      const response = await fetcher(current, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
      })
      const location = response.headers.get('location')
      if (location && response.status >= 300 && response.status < 400) {
        const next = new URL(location, current)
        if (
          !allowedHosts.has(next.hostname) &&
          !isBilibiliHost(next.hostname)
        ) {
          throw new Error('短链接跳转目标不是 B 站页面')
        }
        current = next.toString()
        continue
      }
      if (!response.ok) throw new Error('B 站短链接暂时无法访问')
      const finalUrl = new URL(current)
      if (
        !isBilibiliHost(finalUrl.hostname) ||
        !extractMid(finalUrl.toString())
      ) {
        throw new Error('短链接没有跳转到 B 站空间页面')
      }
      return finalUrl.toString()
    }
    throw new Error('短链接跳转次数过多')
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('短链接解析超时')
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export async function resolveB23Text(
  text: string,
  options: { fetcher?: Fetcher; timeout?: number } = {},
) {
  const links = extractB23Links(text)
  if (!links.length) throw new Error('请输入 b23.tv 短链接')
  const resolved = await Promise.all(
    links.map(async (source) => ({
      source,
      target: await resolveB23Url(source, options),
    })),
  )
  const resolvedText = resolved.reduce(
    (value, item) => value.replaceAll(item.source, item.target),
    text,
  )
  if (!extractMid(resolvedText))
    throw new Error('链接中没有找到有效的 B 站账号')
  return { text: resolvedText, links: resolved }
}
