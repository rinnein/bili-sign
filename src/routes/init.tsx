import {
  CheckCircle2Icon,
  LoaderCircleIcon,
  ShieldCheckIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'

import { AppShell } from '#/components/app-shell'
import { PasskeyCard } from '#/components/passkey-card'
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
import { authClient, authFetch } from '#/lib/auth-client'

export const Route = createFileRoute('/init')({ component: Init })

type InitState = {
  initialized: boolean
  canInitialize: boolean
  hasPasskey: boolean
  registrationAvailable: boolean
}

function Init() {
  const {
    data: session,
    isPending: sessionPending,
    refetch,
  } = authClient.useSession()
  const navigate = useNavigate()
  const [state, setState] = useState<InitState | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void authFetch('/api/admin/init')
      .then(async (response) => {
        const result = (await response.json()) as InitState
        if (!cancelled) setState(result)
      })
      .catch(() => {
        if (!cancelled) setError('无法读取管理员初始化状态。')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [session?.user.id])

  async function initialize() {
    setBusy(true)
    setError('')
    try {
      const response = await authFetch('/api/admin/init', {
        method: 'POST',
        credentials: 'include',
      })
      const result = (await response.json()) as { message?: string }
      if (!response.ok) throw new Error(result.message ?? '管理员初始化失败。')
      await refetch({ query: { disableCookieCache: true } })
      await navigate({ to: '/admin/dashboard' })
    } catch (initError) {
      setError(initError instanceof Error ? initError.message : '初始化失败。')
      setBusy(false)
    }
  }

  async function startRegistration() {
    setBusy(true)
    setError('')
    try {
      const response = await authFetch('/api/auth/admin/bootstrap', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const result = (await response.json()) as { message?: string }
      if (!response.ok) {
        throw new Error(result.message ?? '管理员注册暂时无法开始。')
      }
      await refetch()
    } catch (registrationError) {
      setError(
        registrationError instanceof Error
          ? registrationError.message
          : '管理员注册暂时无法开始。',
      )
    } finally {
      setBusy(false)
    }
  }

  if (sessionPending || loading) {
    return (
      <AppShell>
        <div className="mx-auto flex flex-1 items-center justify-center px-4 text-sm text-muted-foreground">
          正在准备初始化…
        </div>
      </AppShell>
    )
  }

  if (state?.initialized) {
    return (
      <AppShell>
        <div className="mx-auto flex w-full max-w-xl flex-1 items-center justify-center px-4 py-8">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>管理员已完成初始化</CardTitle>
              <CardDescription>管理员入口已启用。</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button asChild className="ml-auto">
                <Link to="/admin/login">管理员登录</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </AppShell>
    )
  }

  if (!session?.user) {
    return (
      <AppShell>
        <div className="mx-auto flex w-full max-w-xl flex-1 items-center justify-center px-4 py-8">
          {state?.registrationAvailable ? (
            <Card className="w-full">
              <CardHeader>
                <CardTitle>注册管理员账户</CardTitle>
                <CardDescription>
                  这是独立的管理员账户，不会绑定 B 站账号。开始后请立即添加
                  Passkey。
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button
                  type="button"
                  className="ml-auto"
                  disabled={busy}
                  onClick={() => void startRegistration()}
                >
                  {busy ? (
                    <LoaderCircleIcon
                      className="animate-spin"
                      data-icon="inline-start"
                    />
                  ) : null}
                  开始注册
                </Button>
              </CardFooter>
              {error ? (
                <CardContent className="pt-0">
                  <Alert variant="destructive">
                    <AlertTitle>注册未开始</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                </CardContent>
              ) : null}
            </Card>
          ) : (
            <Alert variant="destructive">
              <ShieldCheckIcon />
              <AlertTitle>管理员注册正在进行中</AlertTitle>
              <AlertDescription>
                请在发起注册的设备上继续，或联系管理员完成初始化。
              </AlertDescription>
            </Alert>
          )}
        </div>
      </AppShell>
    )
  }

  if (!state?.canInitialize) {
    return (
      <AppShell>
        <div className="mx-auto flex w-full max-w-xl flex-1 items-center justify-center px-4 py-8">
          <Alert variant="destructive">
            <ShieldCheckIcon />
            <AlertTitle>无法初始化管理员</AlertTitle>
            <AlertDescription>当前账户不能完成管理员注册。</AlertDescription>
          </Alert>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="mx-auto grid w-full max-w-2xl flex-1 content-center gap-6 px-4 py-8 sm:px-6 lg:py-10">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            INITIAL SETUP
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            初始化管理员账户
          </h1>
        </div>
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>初始化未完成</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <PasskeyCard
          onPasskeyAdded={() =>
            setState((current) => current && { ...current, hasPasskey: true })
          }
        />
        <Card>
          <CardHeader>
            <CardTitle>完成初始化</CardTitle>
            <CardDescription>
              必须先为这个账户绑定 Passkey，才能获得管理员权限。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {state.hasPasskey ? (
              <p className="flex items-center gap-2 text-sm text-success">
                <CheckCircle2Icon className="size-4" />
                已检测到 Passkey
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                尚未检测到 Passkey
              </p>
            )}
          </CardContent>
          <CardFooter>
            <Button
              type="button"
              className="ml-auto"
              disabled={!state.hasPasskey || busy}
              onClick={() => void initialize()}
            >
              {busy ? (
                <LoaderCircleIcon
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : null}
              完成初始化
            </Button>
          </CardFooter>
        </Card>
      </div>
    </AppShell>
  )
}
