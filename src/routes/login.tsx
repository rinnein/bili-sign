import {
  ArrowRightIcon,
  CheckIcon,
  CopyIcon,
  KeyRoundIcon,
  LoaderCircleIcon,
  SmartphoneIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { AppShell } from '#/components/app-shell'
import { DeviceQrCode } from '#/components/device-qr-code'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { authClient, setDeviceSessionToken } from '#/lib/auth-client'
import {
  DEVICE_AUTH_CLIENT_ID,
  DEVICE_AUTH_GRANT_TYPE,
  DEVICE_AUTH_SCOPE,
  deviceAuthErrorCode,
  deviceAuthErrorMessage,
} from '#/lib/device-auth'
import { continueOAuthLogin } from '#/lib/oauth-continuation'

export const Route = createFileRoute('/login')({ component: Login })

type LoginAction = 'passkey' | 'device' | null

type PendingDeviceAuth = {
  deviceCode: string
  userCode: string
  verificationUriComplete: string
  interval: number
  expiresAt: number
}

type CancellationToken = { cancelled: boolean }

function isCancelled(token: CancellationToken) {
  return token.cancelled
}

function Login() {
  const {
    data: session,
    isPending: sessionPending,
    refetch,
  } = authClient.useSession()
  const navigate = useNavigate()
  const [action, setAction] = useState<LoginAction>(null)
  const [pendingDeviceAuth, setPendingDeviceAuth] =
    useState<PendingDeviceAuth | null>(null)
  const [deviceRemaining, setDeviceRemaining] = useState(0)
  const [deviceCopied, setDeviceCopied] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!pendingDeviceAuth) return

    const cancellation: CancellationToken = { cancelled: false }
    let timer: number | undefined
    let pollingInterval = Math.max(1, pendingDeviceAuth.interval) * 1000

    const stop = () => {
      setPendingDeviceAuth(null)
      setDeviceRemaining(0)
      setDeviceCopied(false)
      setAction(null)
    }

    const poll = async () => {
      if (isCancelled(cancellation)) return
      const remaining = Math.max(
        0,
        Math.ceil((pendingDeviceAuth.expiresAt - Date.now()) / 1000),
      )
      setDeviceRemaining(remaining)
      if (!remaining) {
        setError('设备登录码已过期，请重新生成。')
        stop()
        return
      }

      try {
        const result = await authClient.device.token({
          grant_type: DEVICE_AUTH_GRANT_TYPE,
          device_code: pendingDeviceAuth.deviceCode,
          client_id: DEVICE_AUTH_CLIENT_ID,
        })

        if (isCancelled(cancellation)) return
        if (!result.error) {
          const accessToken = result.data.access_token
          if (typeof accessToken === 'string' && accessToken) {
            setDeviceSessionToken(accessToken)
          }
          stop()
          await refetch({ query: { disableCookieCache: true } })
          if (await continueOAuthLogin()) return
          await navigate({ to: '/dashboard' })
          return
        }

        const code = deviceAuthErrorCode(result.error)
        if (code === 'authorization_pending') {
          timer = window.setTimeout(() => void poll(), pollingInterval)
          return
        }
        if (code === 'slow_down') {
          pollingInterval += 5000
          timer = window.setTimeout(() => void poll(), pollingInterval)
          return
        }

        setError(
          code === 'access_denied'
            ? '设备登录已被拒绝。'
            : code === 'expired_token'
              ? '设备登录码已过期，请重新生成。'
              : '设备登录码无效，请重新生成。',
        )
        stop()
      } catch (pollError) {
        if (isCancelled(cancellation)) return
        setError(deviceAuthErrorMessage(pollError, '设备登录失败，请重试。'))
        stop()
      }
    }

    timer = window.setTimeout(() => void poll(), pollingInterval)
    const countdown = window.setInterval(() => {
      if (!isCancelled(cancellation)) {
        setDeviceRemaining(
          Math.max(
            0,
            Math.ceil((pendingDeviceAuth.expiresAt - Date.now()) / 1000),
          ),
        )
      }
    }, 1000)

    return () => {
      cancellation.cancelled = true
      if (timer) window.clearTimeout(timer)
      window.clearInterval(countdown)
    }
  }, [navigate, pendingDeviceAuth, refetch])

  function continueWithBili() {
    window.location.assign(`/verify${window.location.search}`)
  }

  async function signInWithPasskey() {
    setAction('passkey')
    setError('')
    try {
      const result = await authClient.signIn.passkey()
      if (result.error) {
        throw new Error(
          deviceAuthErrorMessage(result.error, 'Passkey 登录失败'),
        )
      }
      await refetch()
      if (await continueOAuthLogin()) return
      await navigate({ to: '/dashboard' })
    } catch (loginError) {
      setError(
        deviceAuthErrorMessage(
          loginError,
          'Passkey 登录失败，请使用其他方式登录。',
        ),
      )
    } finally {
      setAction(null)
    }
  }

  async function createDeviceCode() {
    setAction('device')
    setError('')
    setPendingDeviceAuth(null)
    setDeviceRemaining(0)
    setDeviceCopied(false)
    let waiting = false
    try {
      const result = await authClient.device.code({
        client_id: DEVICE_AUTH_CLIENT_ID,
        scope: DEVICE_AUTH_SCOPE,
      })
      if (result.error) {
        throw new Error(
          deviceAuthErrorMessage(result.error, '设备登录码生成失败。'),
        )
      }

      setPendingDeviceAuth({
        deviceCode: result.data.device_code,
        userCode: result.data.user_code,
        verificationUriComplete: result.data.verification_uri_complete,
        interval: result.data.interval,
        expiresAt: Date.now() + result.data.expires_in * 1000,
      })
      setDeviceRemaining(result.data.expires_in)
      waiting = true
    } catch (deviceError) {
      setError(
        deviceAuthErrorMessage(deviceError, '设备登录码生成失败，请重试。'),
      )
    } finally {
      if (!waiting) setAction(null)
    }
  }

  async function copyDeviceCode() {
    if (!pendingDeviceAuth) return
    try {
      await navigator.clipboard.writeText(pendingDeviceAuth.userCode)
      setDeviceCopied(true)
      window.setTimeout(() => setDeviceCopied(false), 1600)
    } catch {
      setError('复制失败，请手动输入设备码。')
    }
  }

  function cancelDeviceAuth() {
    setPendingDeviceAuth(null)
    setDeviceRemaining(0)
    setDeviceCopied(false)
    setAction(null)
    setError('')
  }

  if (sessionPending) {
    return (
      <AppShell>
        <div className="mx-auto flex w-full max-w-md flex-1 items-center justify-center px-4 py-12 text-center text-sm text-muted-foreground">
          正在准备登录…
        </div>
      </AppShell>
    )
  }

  if (session?.user) {
    return (
      <AppShell>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8 sm:px-6 lg:py-10">
          <Card>
            <CardHeader>
              <CardTitle>你已经登录</CardTitle>
              <CardDescription>当前设备已登录 bili-sign。</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button
                className="ml-auto"
                onClick={() => void navigate({ to: '/dashboard' })}
              >
                进入账户面板
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </CardFooter>
          </Card>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8 sm:px-6 lg:py-10">
        <Card>
          <CardHeader>
            <CardTitle>登录 bili-sign</CardTitle>
            <CardDescription>选择一种登录方式继续。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {error ? (
              <Alert variant="destructive" className="mb-2">
                <AlertTitle>登录失败</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <Button
              type="button"
              size="lg"
              disabled={action !== null}
              onClick={continueWithBili}
            >
              使用 B 站账号 注册 / 登录
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={action !== null}
              onClick={() => void signInWithPasskey()}
            >
              {action === 'passkey' ? (
                <LoaderCircleIcon
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <KeyRoundIcon data-icon="inline-start" />
              )}
              使用 Passkey 登录
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={action !== null}
              onClick={() => void createDeviceCode()}
            >
              {action === 'device' ? (
                <LoaderCircleIcon
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <SmartphoneIcon data-icon="inline-start" />
              )}
              扫码登录 / 快速连接（Device Auth）
            </Button>
            {pendingDeviceAuth ? (
              <div className="grid gap-5 rounded-lg border bg-muted/40 p-4 sm:grid-cols-[auto_1fr] sm:items-center">
                <DeviceQrCode
                  value={pendingDeviceAuth.verificationUriComplete}
                />
                <div className="text-center sm:text-left">
                  <p className="text-sm text-muted-foreground">
                    用已登录设备扫码，或在账户面板输入设备码
                  </p>
                  <div className="mt-3 flex items-center justify-center gap-2 sm:justify-start">
                    <p className="font-mono text-2xl font-semibold tracking-[0.2em]">
                      {pendingDeviceAuth.userCode}
                    </p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => void copyDeviceCode()}
                          aria-label={
                            deviceCopied ? '已复制设备码' : '复制设备码'
                          }
                        >
                          {deviceCopied ? (
                            <CheckIcon data-icon="inline-start" />
                          ) : (
                            <CopyIcon data-icon="inline-start" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {deviceCopied ? '已复制' : '复制设备码'}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {deviceRemaining > 0
                      ? `等待确认，${deviceRemaining} 秒后失效`
                      : '设备登录码已失效'}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={cancelDeviceAuth}
                  >
                    取消
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
