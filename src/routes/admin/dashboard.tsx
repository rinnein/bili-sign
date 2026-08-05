import { ShieldCheckIcon } from 'lucide-react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'

import { AppShell } from '#/components/app-shell'
import { DeviceAuthorizationCard } from '#/components/device-authorization-card'
import { PasskeyCard } from '#/components/passkey-card'
import { OAuthClientManager } from '#/components/oauth-client-manager'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '#/components/ui/empty'
import { Skeleton } from '#/components/ui/skeleton'
import { authClient } from '#/lib/auth-client'
import { isAdminRole } from '#/lib/admin'

export const Route = createFileRoute('/admin/dashboard')({
  component: AdminDashboard,
})

function AdminDashboard() {
  const { data: session, isPending } = authClient.useSession()
  const navigate = useNavigate()

  if (isPending) {
    return (
      <AppShell>
        <div className="mx-auto grid w-full max-w-5xl flex-1 gap-6 px-4 py-12 sm:px-6 lg:px-8">
          <Skeleton className="h-10 w-56" />
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </AppShell>
    )
  }

  if (!session?.user) {
    return (
      <AppShell>
        <div className="mx-auto flex w-full max-w-xl flex-1 items-center justify-center px-4 py-8">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>请先登录管理员账户</EmptyTitle>
              <EmptyDescription>
                管理员账户使用 Passkey 或设备登录。
              </EmptyDescription>
            </EmptyHeader>
            <Button asChild>
              <Link to="/admin/login">管理员登录</Link>
            </Button>
          </Empty>
        </div>
      </AppShell>
    )
  }

  if (!isAdminRole(session.user.role)) {
    return (
      <AppShell>
        <div className="mx-auto flex w-full max-w-xl flex-1 items-center justify-center px-4 py-8">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>没有管理员权限</CardTitle>
              <CardDescription>当前账户不能访问管理员面板。</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button asChild className="ml-auto">
                <Link to="/dashboard">返回账户面板</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="mb-8">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <ShieldCheckIcon className="size-4" />
            ADMIN
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            管理员账户面板
          </h1>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
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
          <OAuthClientManager allowScopeSwitch />
        </div>
      </div>
    </AppShell>
  )
}
