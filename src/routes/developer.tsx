import { CheckCircle2Icon, PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'

import { AppShell } from '#/components/app-shell'
import { OAuthClientManager } from '#/components/oauth-client-manager'
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
  EmptyTitle,
} from '#/components/ui/empty'
import { authClient } from '#/lib/auth-client'
import { isPendingAdminRole } from '#/lib/admin'
import type { RegisteredOAuthClient } from '#/components/oauth-client-form-dialog'

export const Route = createFileRoute('/developer')({ component: Developer })

function Developer() {
  const { data: session, isPending } = authClient.useSession()
  const [registeredClient, setRegisteredClient] =
    useState<RegisteredOAuthClient | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)

  function openCreateForm() {
    setRegisteredClient(null)
    setCreateOpen(true)
  }

  if (isPending) {
    return (
      <AppShell>
        <div className="mx-auto flex flex-1 items-center justify-center px-4 text-sm text-muted-foreground">
          正在检查登录状态…
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
              <EmptyTitle>请先登录</EmptyTitle>
              <EmptyDescription>
                登录后才能创建 OAuth 应用 Client。
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
              <EmptyTitle>请先完成管理员初始化</EmptyTitle>
              <EmptyDescription>
                完成 Passkey 绑定后才能使用开发者设置。
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
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              DEVELOPER
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              开发者设置
            </h1>
          </div>
          <Button type="button" onClick={openCreateForm}>
            <PlusIcon data-icon="inline-start" />
            创建 Client
          </Button>
        </div>
        <OAuthClientManager
          refreshKey={refreshKey}
          createOpen={createOpen}
          onCreateOpenChange={setCreateOpen}
          onCreated={(client) => {
            setRegisteredClient(client)
            setRefreshKey((current) => current + 1)
          }}
        />
        {registeredClient ? (
          <Card className="mt-6 border-success/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2Icon className="size-4 text-success" />
                Client 创建成功
              </CardTitle>
              <CardDescription>
                请妥善保存下面的 client secret，离开页面后不会再次显示。
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm">
              <Credential
                label="Client ID"
                value={registeredClient.client_id}
              />
              <Credential
                label="Client secret"
                value={registeredClient.client_secret ?? '未返回'}
                secret
              />
              <Credential
                label="允许的 scope"
                value={registeredClient.scope ?? 'openid profile bili:public'}
              />
              <Credential
                label="回调 URL"
                value={registeredClient.redirect_uris?.join(', ') ?? '—'}
              />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AppShell>
  )
}

function Credential({
  label,
  value,
  secret = false,
}: {
  label: string
  value: string
  secret?: boolean
}) {
  return (
    <div className="grid gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <code className={secret ? 'break-all select-all' : 'break-all'}>
        {value}
      </code>
    </div>
  )
}
