import {
  CheckCircle2Icon,
  KeyRoundIcon,
  LoaderCircleIcon,
  PlusIcon,
  XIcon,
} from 'lucide-react'
import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'

import { AppShell } from '#/components/app-shell'
import { OAuthClientManager } from '#/components/oauth-client-manager'
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
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '#/components/ui/empty'
import { Field, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { authClient } from '#/lib/auth-client'
import { isPendingAdminRole } from '#/lib/admin'

export const Route = createFileRoute('/developer')({ component: Developer })

type RegisteredClient = {
  client_id: string
  client_secret?: string
  client_secret_expires_at?: number
  client_name?: string
  client_uri?: string
  redirect_uris?: Array<string>
  scope?: string
}

function Developer() {
  const { data: session, isPending } = authClient.useSession()
  const [clientName, setClientName] = useState('')
  const [clientUri, setClientUri] = useState('')
  const [redirectUri, setRedirectUri] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [registeredClient, setRegisteredClient] =
    useState<RegisteredClient | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)

  function openCreateForm() {
    setError('')
    setRegisteredClient(null)
    setCreateOpen(true)
  }

  async function createClient() {
    setError('')
    setRegisteredClient(null)
    const name = clientName.trim()
    const uri = clientUri.trim()
    const redirect = redirectUri.trim()
    if (!name || !uri || !redirect) {
      setError('请填写应用名称、应用主页和回调地址。')
      return
    }
    try {
      for (const value of [uri, redirect]) {
        const parsed = new URL(value)
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          throw new Error('URL 必须使用 HTTP 或 HTTPS。')
        }
      }
    } catch (validationError) {
      setError(
        validationError instanceof Error
          ? validationError.message
          : '请输入有效的 URL。',
      )
      return
    }

    setBusy(true)
    try {
      const result = await authClient.oauth2.register({
        client_name: name,
        client_uri: uri,
        redirect_uris: [redirect],
        scope: 'openid profile bili:public',
        token_endpoint_auth_method: 'client_secret_basic',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        type: 'web',
      })
      if (result.error)
        throw new Error(result.error.message ?? 'Client 创建失败。')
      setRegisteredClient(result.data)
      setRefreshKey((current) => current + 1)
      setClientName('')
      setClientUri('')
      setRedirectUri('')
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Client 创建失败。',
      )
    } finally {
      setBusy(false)
    }
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
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 lg:py-10">
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
        <OAuthClientManager refreshKey={refreshKey} />
        {createOpen ? (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRoundIcon className="size-4" />
                创建 OAuth Client
              </CardTitle>
              <CardDescription>
                Client secret 只会在创建成功后显示一次，请立即保存。
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              {error ? (
                <Alert variant="destructive">
                  <AlertTitle>创建失败</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="client-name">应用名称</FieldLabel>
                  <Input
                    id="client-name"
                    value={clientName}
                    onChange={(event) => setClientName(event.target.value)}
                    placeholder="例如：我的应用"
                    className="px-3"
                    disabled={busy}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="client-uri">应用主页 URL</FieldLabel>
                  <Input
                    id="client-uri"
                    type="url"
                    value={clientUri}
                    onChange={(event) => setClientUri(event.target.value)}
                    placeholder="https://example.com"
                    className="px-3"
                    disabled={busy}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="redirect-uri">OAuth 回调 URL</FieldLabel>
                  <Input
                    id="redirect-uri"
                    type="url"
                    value={redirectUri}
                    onChange={(event) => setRedirectUri(event.target.value)}
                    placeholder="https://example.com/oauth/callback"
                    className="px-3"
                    disabled={busy}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setCreateOpen(false)}
              >
                <XIcon data-icon="inline-start" />
                取消
              </Button>
              <Button
                type="button"
                disabled={busy}
                onClick={() => void createClient()}
              >
                {busy ? (
                  <LoaderCircleIcon
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : null}
                创建 Client
              </Button>
            </CardFooter>
          </Card>
        ) : null}
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
