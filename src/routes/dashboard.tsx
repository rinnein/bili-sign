import {
  KeyRoundIcon,
  LoaderCircleIcon,
  LogOutIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
} from 'lucide-react'
import { getAuthenticatorName } from '@better-auth/passkey'
import { useEffect, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'

import { AppShell } from '#/components/app-shell'
import { BiliProfile } from '#/components/bili-profile'
import { DeviceAuthorizationCard } from '#/components/device-authorization-card'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
import { Field, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Skeleton } from '#/components/ui/skeleton'
import { authClient, authFetch } from '#/lib/auth-client'
import { displayValue, getBiliInfo } from '#/lib/bili-flow'
import type { BiliInfo } from '#/lib/bili-flow'
import { deviceAuthErrorMessage } from '#/lib/device-auth'
import { usePluginBridge } from '#/lib/plugin-bridge'

export const Route = createFileRoute('/dashboard')({ component: Dashboard })

function Dashboard() {
  const { data: session, isPending, refetch } = authClient.useSession()
  const navigate = useNavigate()
  const pluginState = usePluginBridge()
  const [info, setInfo] = useState<BiliInfo | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [passkeyName, setPasskeyName] = useState('')
  const [pendingPasskey, setPendingPasskey] = useState<{
    id: string
    defaultName: string
  } | null>(null)
  const [passkeyNameOpen, setPasskeyNameOpen] = useState(false)
  const [passkeyBusy, setPasskeyBusy] = useState(false)
  const [passkeyNameBusy, setPasskeyNameBusy] = useState(false)
  const [passkeyError, setPasskeyError] = useState('')

  useEffect(() => {
    if (!session?.user) {
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

  async function addPasskey() {
    setPasskeyBusy(true)
    setPasskeyError('')
    try {
      const result = await authClient.passkey.addPasskey()
      if (result.error) {
        throw new Error(
          deviceAuthErrorMessage(result.error, 'Passkey 绑定失败'),
        )
      }
      const defaultName =
        result.data.name?.trim() ||
        getAuthenticatorName(result.data.aaguid) ||
        '此设备 Passkey'
      setPendingPasskey({ id: result.data.id, defaultName })
      setPasskeyName(defaultName)
      setPasskeyNameOpen(true)
    } catch (passkeyAddError) {
      setPasskeyError(
        deviceAuthErrorMessage(passkeyAddError, 'Passkey 绑定失败，请重试。'),
      )
    } finally {
      setPasskeyBusy(false)
    }
  }

  async function savePasskeyName() {
    if (!pendingPasskey) return
    setPasskeyNameBusy(true)
    setPasskeyError('')
    try {
      const name = passkeyName.trim() || pendingPasskey.defaultName
      const result = await authClient.passkey.updatePasskey({
        id: pendingPasskey.id,
        name,
      })
      if (result.error) {
        throw new Error(
          deviceAuthErrorMessage(result.error, 'Passkey 名称保存失败'),
        )
      }
      setPasskeyNameOpen(false)
      setPendingPasskey(null)
      setPasskeyName('')
    } catch (nameError) {
      setPasskeyError(
        deviceAuthErrorMessage(nameError, 'Passkey 已创建，但名称保存失败。'),
      )
    } finally {
      setPasskeyNameBusy(false)
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRoundIcon className="size-4" />
                Passkey
              </CardTitle>
              <CardDescription>为当前账户添加设备解锁登录。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {passkeyError ? (
                <Alert variant="destructive">
                  <AlertTitle>绑定失败</AlertTitle>
                  <AlertDescription>{passkeyError}</AlertDescription>
                </Alert>
              ) : null}
              <Button
                type="button"
                disabled={passkeyBusy}
                onClick={() => void addPasskey()}
              >
                {passkeyBusy ? (
                  <LoaderCircleIcon
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : (
                  <KeyRoundIcon data-icon="inline-start" />
                )}
                添加 Passkey
              </Button>
            </CardContent>
          </Card>
          <DeviceAuthorizationCard
            onScanned={(userCode) =>
              void navigate({
                to: '/device/confirm',
                search: { user_code: userCode },
              })
            }
          />
        </div>
        <Card className="mt-6 border-destructive/30">
          <CardHeader>
            <CardTitle>注销账户</CardTitle>
            <CardDescription>
              注销后将删除当前账户、B 站绑定和全部登录会话，且无法恢复。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="destructive"
              onClick={() => setConfirmOpen(true)}
            >
              <ShieldAlertIcon data-icon="inline-start" />
              注销账户
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
      <Dialog open={passkeyNameOpen} onOpenChange={setPasskeyNameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>给 Passkey 起个名字</DialogTitle>
            <DialogDescription>
              Passkey 已创建。名称可留空，将使用自动名称。
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="passkey-name">名称</FieldLabel>
            <Input
              id="passkey-name"
              value={passkeyName}
              onChange={(event) => setPasskeyName(event.target.value)}
              placeholder="例如：我的手机"
              disabled={passkeyNameBusy}
            />
          </Field>
          {passkeyError ? (
            <Alert variant="destructive">
              <AlertTitle>名称保存失败</AlertTitle>
              <AlertDescription>{passkeyError}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              onClick={() => void savePasskeyName()}
              disabled={passkeyNameBusy}
            >
              {passkeyNameBusy ? (
                <LoaderCircleIcon
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : null}
              完成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
