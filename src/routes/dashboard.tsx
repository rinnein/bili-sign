import {
  LoaderCircleIcon,
  LogOutIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  Trash2Icon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'

import { AppShell } from '#/components/app-shell'
import { BiliProfile } from '#/components/bili-profile'
import { DeviceAuthorizationCard } from '#/components/device-authorization-card'
import { PasskeyCard } from '#/components/passkey-card'
import { SessionManagerCard } from '#/components/session-manager-card'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
import { Skeleton } from '#/components/ui/skeleton'
import { authClient, authFetch } from '#/lib/auth-client'
import { displayValue, getBiliInfo } from '#/lib/bili-flow'
import type { BiliInfo } from '#/lib/bili-flow'
import { usePluginBridge } from '#/lib/plugin-bridge'
import { isPendingAdminRole } from '#/lib/admin'

export const Route = createFileRoute('/dashboard')({ component: Dashboard })

function Dashboard() {
  const { data: session, isPending, refetch } = authClient.useSession()
  const navigate = useNavigate()
  const pluginState = usePluginBridge()
  const [info, setInfo] = useState<BiliInfo | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (!session?.user || isPendingAdminRole(session.user.role)) {
      setInfo(null)
      return
    }
    void loadAccounts()
  }, [pluginState.ready, session?.user])

  async function loadAccounts() {
    const response = await authFetch('/api/auth/list-accounts', {
      credentials: 'include',
    })
    if (!response.ok) return
    const result = (await response.json()) as unknown
    if (!Array.isArray(result)) return
    const nextAccounts = result.flatMap((value) => {
      if (typeof value !== 'object' || value === null) return []
      const account = value as Record<string, unknown>
      if (account.providerId !== 'bili-basic') return []
      return [
        {
          providerId: displayValue(account.providerId),
          accountId: displayValue(account.accountId),
          userId: displayValue(account.userId),
          createdAt: displayValue(account.createdAt),
          updatedAt: displayValue(account.updatedAt),
          scope: displayValue(account.scope, '—'),
        },
      ]
    })
    const boundMid = nextAccounts[0]?.accountId
    if (boundMid)
      void getBiliInfo(boundMid)
        .then(setInfo)
        .catch(() => setInfo(null))
  }

  async function deleteAccount() {
    setBusy(true)
    setError('')
    try {
      const result = await authClient.deleteUser()
      if (result.error) throw new Error(result.error.message ?? '注销账户失败')
      setConfirmOpen(false)
      setInfo(null)
      await refetch()
      await navigate({ to: '/login' })
    } catch (revokeError) {
      setError(
        revokeError instanceof Error ? revokeError.message : '注销账户失败',
      )
    } finally {
      setBusy(false)
    }
  }

  if (isPending)
    return (
      <AppShell>
        <DashboardLoading />
      </AppShell>
    )
  if (!session?.user) {
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LogOutIcon />
              </EmptyMedia>
              <EmptyTitle>还没有登录</EmptyTitle>
              <EmptyDescription>
                完成 B 站签名验证后，这里会显示绑定资料和脱敏账户信息。
              </EmptyDescription>
            </EmptyHeader>
            <Button asChild>
              <Link to="/login">前往登录</Link>
            </Button>
          </Empty>
        </div>
      </AppShell>
    )
  }

  if (isPendingAdminRole(session.user.role)) {
    return (
      <AppShell>
        <div className="mx-auto flex w-full max-w-xl flex-1 items-center justify-center px-4 py-8">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ShieldAlertIcon />
              </EmptyMedia>
              <EmptyTitle>请先完成管理员初始化</EmptyTitle>
              <EmptyDescription>
                绑定 Passkey 后才能进入管理员账户面板。
              </EmptyDescription>
            </EmptyHeader>
            <Button asChild>
              <Link to="/init">继续初始化</Link>
            </Button>
          </Empty>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              ACCOUNT DASHBOARD
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              账户面板
            </h1>
          </div>
        </div>
        {error && (
          <Alert variant="destructive" className="mb-6">
            <ShieldAlertIcon />
            <AlertTitle>注销失败</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {info ? (
          <BiliProfile info={info} />
        ) : (
          <Card>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <RefreshCwIcon />
                </EmptyMedia>
                <EmptyTitle>没有找到 B 站绑定</EmptyTitle>
                <EmptyDescription>
                  当前用户暂时没有可展示的 B 站公开资料。
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </Card>
        )}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <PasskeyCard />
          <DeviceAuthorizationCard
            onScanned={(userCode) =>
              void navigate({
                to: '/device/confirm',
                search: { user_code: userCode },
              })
            }
          />
        </div>
        <div className="mt-6">
          <SessionManagerCard />
        </div>
        <Card className="mt-6 border-destructive/50">
          <CardHeader>
            <CardTitle>永久注销账户</CardTitle>
            <CardDescription>
              永久删除当前账户、B 站绑定和全部登录会话，无法恢复。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="destructive"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2Icon data-icon="inline-start" />
              永久注销账户
            </Button>
          </CardContent>
        </Card>
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认注销当前账户？</AlertDialogTitle>
            <AlertDialogDescription>
              这会删除 Better Auth 用户、B 站绑定和全部登录会话。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={(event) => {
                event.preventDefault()
                void deleteAccount()
              }}
            >
              {busy ? (
                <LoaderCircleIcon
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : null}
              确认注销
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  )
}

function DashboardLoading() {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-20 sm:px-6 lg:px-8">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-52 w-full" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  )
}
