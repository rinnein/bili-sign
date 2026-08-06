import {
  CircleHelpIcon,
  LaptopIcon,
  LoaderCircleIcon,
  LogOutIcon,
  MonitorIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  TabletSmartphoneIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Bowser from 'bowser'
import { useEffect, useState } from 'react'

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
import { Badge } from '#/components/ui/badge'
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
import { Separator } from '#/components/ui/separator'
import { Skeleton } from '#/components/ui/skeleton'
import { authClient } from '#/lib/auth-client'
import { deviceAuthErrorMessage } from '#/lib/device-auth'

type ManagedSession = {
  id: string
  token: string
  createdAt: Date | string
  updatedAt: Date | string
  expiresAt: Date | string
  ipAddress?: string | null
  userAgent?: string | null
}

export function SessionManagerCard() {
  const { data: currentSession } = authClient.useSession()
  const [sessions, setSessions] = useState<Array<ManagedSession>>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyToken, setBusyToken] = useState('')
  const [revokeOthersBusy, setRevokeOthersBusy] = useState(false)
  const [error, setError] = useState('')
  const [pendingRevoke, setPendingRevoke] = useState<ManagedSession | null>(
    null,
  )
  const [revokeOthersOpen, setRevokeOthersOpen] = useState(false)

  useEffect(() => {
    if (!currentSession?.session.token) {
      setSessions([])
      setLoading(false)
      return
    }
    void loadSessions()
  }, [currentSession?.session.token])

  async function loadSessions() {
    setError('')
    setLoading(true)
    try {
      const result = await authClient.listSessions()
      if (result.error) {
        setSessions([])
        setError(deviceAuthErrorMessage(result.error, '暂时无法读取登录会话。'))
      } else {
        setSessions(result.data)
      }
    } catch (loadError) {
      setSessions([])
      setError(deviceAuthErrorMessage(loadError, '暂时无法读取登录会话。'))
    } finally {
      setLoading(false)
    }
  }

  async function refreshSessions() {
    setRefreshing(true)
    await loadSessions()
    setRefreshing(false)
  }

  async function revokeSession() {
    if (!pendingRevoke) return
    const token = pendingRevoke.token
    setBusyToken(token)
    setError('')
    try {
      const result = await authClient.revokeSession({ token })
      if (result.error) {
        throw new Error(deviceAuthErrorMessage(result.error, '会话撤销失败'))
      }
      setPendingRevoke(null)
      await loadSessions()
    } catch (revokeError) {
      setError(deviceAuthErrorMessage(revokeError, '会话撤销失败，请重试。'))
    } finally {
      setBusyToken('')
    }
  }

  async function revokeOtherSessions() {
    setRevokeOthersBusy(true)
    setError('')
    try {
      const result = await authClient.revokeOtherSessions()
      if (result.error) {
        throw new Error(
          deviceAuthErrorMessage(result.error, '其它会话撤销失败'),
        )
      }
      setRevokeOthersOpen(false)
      await loadSessions()
    } catch (revokeError) {
      setError(
        deviceAuthErrorMessage(revokeError, '其它会话撤销失败，请重试。'),
      )
    } finally {
      setRevokeOthersBusy(false)
    }
  }

  const currentToken = currentSession?.session.token
  const otherSessionCount = sessions.filter(
    (session) => session.token !== currentToken,
  ).length
  const sortedSessions = [...sessions].sort(
    (left, right) =>
      getTimestamp(right.createdAt) - getTimestamp(left.createdAt),
  )

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheckIcon className="size-4" />
                登录会话
              </CardTitle>
              <CardDescription>
                查看当前账户的登录设备，并撤销不再使用的会话。
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="刷新登录会话"
              title="刷新"
              disabled={loading || refreshing || revokeOthersBusy}
              onClick={() => void refreshSessions()}
            >
              <RefreshCwIcon
                className={refreshing ? 'animate-spin' : undefined}
              />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>会话操作失败</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {loading ? (
            <div className="grid gap-3" aria-label="正在读取登录会话">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : sessions.length ? (
            <div className="grid max-h-80 gap-3 overflow-y-auto pr-2">
              {sortedSessions.map((session, index) => {
                const isCurrent = session.token === currentToken
                const displayName = session.userAgent?.trim() || '未知设备'
                const DeviceIcon = getDeviceIcon(session.userAgent)

                return (
                  <div key={session.id}>
                    {index > 0 ? <Separator className="mb-3" /> : null}
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="grid size-9 shrink-0 place-items-center bg-muted">
                        {isCurrent ? (
                          <ShieldCheckIcon className="size-4" />
                        ) : (
                          <DeviceIcon className="size-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="break-all text-sm font-medium">
                            {displayName}
                          </p>
                          {isCurrent ? (
                            <Badge variant="secondary">当前会话</Badge>
                          ) : null}
                        </div>
                        <dl className="mt-1 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                          <div className="min-w-0">
                            <dt className="inline">IP： </dt>
                            <dd className="inline break-all">
                              {session.ipAddress || '未知'}
                            </dd>
                          </div>
                          <div className="min-w-0">
                            <dt className="inline">创建： </dt>
                            <dd className="inline">
                              {formatDateTime(session.createdAt)}
                            </dd>
                          </div>
                          <div className="min-w-0">
                            <dt className="inline">最近活动： </dt>
                            <dd className="inline">
                              {formatDateTime(session.updatedAt)}
                            </dd>
                          </div>
                          <div className="min-w-0">
                            <dt className="inline">过期： </dt>
                            <dd className="inline">
                              {formatDateTime(session.expiresAt)}
                            </dd>
                          </div>
                        </dl>
                      </div>
                      {isCurrent ? null : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`撤销 ${displayName} 的登录会话`}
                          title="撤销会话"
                          disabled={Boolean(busyToken) || revokeOthersBusy}
                          onClick={() => setPendingRevoke(session)}
                        >
                          {busyToken === session.token ? (
                            <LoaderCircleIcon className="animate-spin" />
                          ) : (
                            <LogOutIcon />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <Empty className="border border-dashed p-6">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ShieldCheckIcon />
                </EmptyMedia>
                <EmptyTitle>没有活动会话</EmptyTitle>
                <EmptyDescription>
                  当前账户没有可管理的登录会话。
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={
              loading || refreshing || !otherSessionCount || revokeOthersBusy
            }
            onClick={() => setRevokeOthersOpen(true)}
          >
            <LogOutIcon data-icon="inline-start" />
            撤销其它全部会话
          </Button>
        </CardContent>
      </Card>
      <AlertDialog
        open={Boolean(pendingRevoke)}
        onOpenChange={(open) => {
          if (!open && !busyToken) setPendingRevoke(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>撤销这个登录会话？</AlertDialogTitle>
            <AlertDialogDescription>
              该设备将立即退出当前账户。
              {pendingRevoke?.ipAddress
                ? ` IP：${pendingRevoke.ipAddress}。`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(busyToken)}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={Boolean(busyToken)}
              onClick={(event) => {
                event.preventDefault()
                void revokeSession()
              }}
            >
              {busyToken ? (
                <LoaderCircleIcon
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <LogOutIcon data-icon="inline-start" />
              )}
              撤销会话
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={revokeOthersOpen} onOpenChange={setRevokeOthersOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>撤销其它全部会话？</AlertDialogTitle>
            <AlertDialogDescription>
              将退出其它 {otherSessionCount}{' '}
              个登录设备，当前会话会继续保持登录。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeOthersBusy}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={revokeOthersBusy}
              onClick={(event) => {
                event.preventDefault()
                void revokeOtherSessions()
              }}
            >
              {revokeOthersBusy ? (
                <LoaderCircleIcon
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <LogOutIcon data-icon="inline-start" />
              )}
              全部撤销
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function formatDateTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('zh-CN')
}

function getTimestamp(value: Date | string) {
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function getDeviceIcon(userAgent?: string | null): LucideIcon {
  if (!userAgent?.trim()) return CircleHelpIcon

  const platformType = Bowser.getParser(userAgent).getPlatformType()
  if (platformType === 'mobile') return SmartphoneIcon
  if (platformType === 'tablet') return TabletSmartphoneIcon
  if (platformType === 'smarttv' || platformType === 'console') {
    return MonitorIcon
  }
  if (platformType === 'desktop') return LaptopIcon
  return CircleHelpIcon
}
