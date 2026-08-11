import { pluginBridge } from '#/lib/plugin-bridge'

export type BiliApiProxyRequest = {
  url: string
  method: 'GET' | 'POST'
  body?: string
  csrf?: boolean
}

export type BiliApiProxyResponse = {
  status: number
  body: unknown
}

export async function requestBiliApi(
  request: BiliApiProxyRequest,
): Promise<unknown> {
  const response = await pluginBridge.request<unknown>(
    'bili.api.proxy',
    'bili.api.request',
    request,
  )
  if (
    typeof response !== 'object' ||
    response === null ||
    typeof (response as { status?: unknown }).status !== 'number' ||
    !('body' in response)
  ) {
    throw new Error('插件返回的 B 站代理响应格式无效')
  }
  const typedResponse = response as BiliApiProxyResponse
  if (typedResponse.status < 200 || typedResponse.status >= 300) {
    const body = typedResponse.body
    const message =
      body && typeof body === 'object' && 'message' in body
        ? (body as { message?: unknown }).message
        : undefined
    throw new Error(
      typeof message === 'string'
        ? message
        : `B 站 API 请求失败（${typedResponse.status}）`,
    )
  }
  return typedResponse.body
}

export function isBiliApiSuccess(value: unknown): value is { code: 0 } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    (value as { code?: unknown }).code === 0
  )
}

export function readBiliApiMessage(value: unknown) {
  if (typeof value !== 'object' || value === null || !('message' in value)) {
    return ''
  }
  const message = (value as { message?: unknown }).message
  return typeof message === 'string' ? message : ''
}

export function parseBiliNavMid(value: unknown) {
  if (!isBiliApiSuccess(value)) {
    throw new Error(readBiliApiMessage(value) || '当前 B 站账号未登录')
  }
  const data = (value as { data?: unknown }).data
  if (
    typeof data !== 'object' ||
    data === null ||
    (data as { isLogin?: unknown }).isLogin !== true
  ) {
    throw new Error(readBiliApiMessage(value) || '当前 B 站账号未登录')
  }
  const mid = (data as { mid?: unknown }).mid
  if (typeof mid !== 'string' && typeof mid !== 'number') {
    throw new Error('B 站当前账号 MID 无效')
  }
  return String(mid)
}
