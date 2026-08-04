export const lastMidStorageKey = 'bili-sign:last-mid'

const spaceMidPattern = /(?:https?:\/\/)?space\.bilibili\.com\/(\d+)/i
const mobileSpaceMidPattern = /(?:https?:\/\/)?m\.bilibili\.com\/space\/(\d+)/i
const b23Pattern = /(?:https?:\/\/)?b23\.tv\/[A-Za-z0-9_-]+(?:\?[^\s]*)?/gi

export function extractB23Links(value: string) {
  return [...value.matchAll(b23Pattern)].map(([match]) =>
    match.startsWith('http') ? match : `https://${match}`,
  )
}

export function extractMid(value: string): string | null {
  const input = value.trim()
  if (/^\d+$/.test(input)) return input
  return (
    input.match(spaceMidPattern)?.[1] ??
    input.match(mobileSpaceMidPattern)?.[1] ??
    null
  )
}

export function isValidMid(value: string) {
  return /^\d+$/.test(value)
}

export function readLastMid() {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(lastMidStorageKey) ?? ''
}

export function rememberMid(mid: string) {
  if (typeof window !== 'undefined' && isValidMid(mid)) {
    window.localStorage.setItem(lastMidStorageKey, mid)
  }
}

export async function resolveMidInput(value: string) {
  const input = value.trim()
  const b23Links = extractB23Links(input)
  if (b23Links.length) {
    const response = await fetch('/api/resolve-b23', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: input }),
    })
    let result: { text?: string; error?: string }
    try {
      result = (await response.json()) as { text?: string; error?: string }
    } catch {
      throw new Error('短链接解析服务暂时不可用，请稍后重试')
    }
    if (!response.ok || !result.text) {
      throw new Error(result.error ?? '无法解析 B 站短链接')
    }

    const mid = extractMid(result.text)
    if (!mid) throw new Error('链接中没有找到有效的 B 站账号')
    return { mid, value: result.text }
  }

  const directMid = extractMid(input)
  if (!directMid) {
    throw new Error('请输入 B 站 MID 或个人空间链接')
  }
  return { mid: directMid, value: input }
}
