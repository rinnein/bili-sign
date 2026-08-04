import { turnstileEnabled } from '#/lib/turnstile-client'

export const captchaRequiredEvent = 'bili-sign:captcha-required'

type CaptchaPromptDetail = {
  resolve: (token: string) => void
  reject: (error: Error) => void
}

let pendingPrompt: Promise<string> | null = null
let pendingDetail: CaptchaPromptDetail | null = null

export function requestCaptchaToken() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('安全验证只能在浏览器中完成。'))
  }
  if (pendingPrompt) return pendingPrompt

  pendingPrompt = new Promise<string>((resolve, reject) => {
    pendingDetail = { resolve, reject }
    window.dispatchEvent(new CustomEvent(captchaRequiredEvent))
  }).finally(() => {
    pendingPrompt = null
    pendingDetail = null
  })

  return pendingPrompt
}

export function completeCaptchaPrompt(token: string) {
  if (!token || !pendingDetail) return false
  pendingDetail.resolve(token)
  return true
}

export function cancelCaptchaPrompt() {
  if (!pendingDetail) return false
  pendingDetail.reject(new Error('用户取消了安全验证。'))
  return true
}

type CaptchaResponseKind = 'missing' | 'expired' | null

async function getCaptchaResponseKind(
  response: Response,
): Promise<CaptchaResponseKind> {
  if (response.status !== 400 && response.status !== 403) return null

  try {
    const body = (await response.clone().json()) as unknown
    if (!body || typeof body !== 'object') return null
    const record = body as Record<string, unknown>
    const error =
      record.error && typeof record.error === 'object'
        ? (record.error as Record<string, unknown>)
        : null
    const codeValue = record.code ?? error?.code
    const messageValue = record.message ?? error?.message
    const code = typeof codeValue === 'string' ? codeValue : ''
    const message = typeof messageValue === 'string' ? messageValue : ''
    if (
      code === 'MISSING_RESPONSE' ||
      message.toLowerCase().includes('missing captcha response')
    ) {
      return 'missing'
    }
    if (
      code === 'VERIFICATION_FAILED' ||
      message.toLowerCase().includes('captcha verification failed')
    ) {
      return 'expired'
    }
  } catch {
    return null
  }
  return null
}

export async function isCaptchaRequiredResponse(response: Response) {
  return (await getCaptchaResponseKind(response)) === 'missing'
}

export async function isCaptchaExpiredResponse(response: Response) {
  return (await getCaptchaResponseKind(response)) === 'expired'
}

export async function captchaAwareFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const request = new Request(input, init)
  const headers = new Headers(request.headers)
  const requestInit: RequestInit = {
    headers,
    credentials: request.credentials,
    cache: request.cache,
    mode: request.mode,
    redirect: request.redirect,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
    integrity: request.integrity,
    keepalive: request.keepalive,
    signal: request.signal,
  }
  let response = await fetch(new Request(request.clone(), requestInit))

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (!turnstileEnabled) return response
    const kind = await getCaptchaResponseKind(response)
    const hasToken = headers.has('x-captcha-response')
    const needsPrompt = kind === 'missing' || (hasToken && kind === 'expired')
    if (!needsPrompt) return response

    const token = await requestCaptchaToken()
    headers.set('x-captcha-response', token)
    response = await fetch(new Request(request.clone(), requestInit))
  }

  return response
}
