import { CheckIcon, ShieldCheckIcon, XIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { AppShell } from '#/components/app-shell'
import { useDeviceSessionSwitcher } from '#/components/device-session-switcher'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { authClient } from '#/lib/auth-client'
import { isAdminRole } from '#/lib/admin'
import { inspectOAuthContinuation } from '#/lib/oauth-continuation'

export const Route = createFileRoute('/oauth/consent')({
  component: OAuthConsent,
})

function OAuthConsent() {
  const { data: session, isPending } = authClient.useSession()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientName, setClientName] = useState('第三方应用')
  const [clientUri, setClientUri] = useState('')
  const [scopes, setScopes] = useState<Array<string>>([])
  const [error, setError] = useState('')
  const [oauthError, setOAuthError] = useState('')
  const [queryReady, setQueryReady] = useState(false)
  const [redirectingToLogin, setRedirectingToLogin] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [sessionListOpen, setSessionListOpen] = useState(false)
  const {
    sessions,
    loading: sessionsLoading,
    switching: sessionSwitching,
    error: sessionError,
    loadSessions,
    switchSession,
  } = useDeviceSessionSwitcher()
  const redirectStarted = useRef(false)

  useEffect(() => {
    const continuation = inspectOAuthContinuation(window.location.search)
    if (continuation.kind === 'valid') {
      const params = new URLSearchParams(continuation.query)
      setQuery(continuation.query)
      const requestedClientId = params.get('client_id') ?? ''
      setClientId(requestedClientId)
      setScopes((params.get('scope') ?? '').split(' ').filter(Boolean))
      void authClient.oauth2
        .publicClient({
          query: { client_id: requestedClientId },
        })
        .then((result) => {
          if (result.error) return
          setClientName(result.data.client_name || '第三方应用')
          setClientUri(result.data.client_uri || '')
        })
        .catch(() => {})
    } else {
      setOAuthError(
        continuation.kind === 'invalid'
          ? continuation.message
          : 'OAuth 授权请求缺少必要参数。',
      )
    }
    setQueryReady(true)
  }, [])

  useEffect(() => {
    const continuation = inspectOAuthContinuation(window.location.search)
    if (
      isPending ||
      session?.user ||
      !queryReady ||
      continuation.kind !== 'valid' ||
      redirectStarted.current
    ) {
      return
    }

    redirectStarted.current = true
    setRedirectingToLogin(true)
    void navigate({
      to: '/login',
      search: continuation.search,
      replace: true,
    }).catch(() => {
      redirectStarted.current = false
      setRedirectingToLogin(false)
      setOAuthError('无法打开登录页面，请重试。')
    })
  }, [isPending, navigate, queryReady, session?.user])

  async function submit(accept: boolean) {
    setSubmitting(true)
    setError('')
    try {
      const result = await authClient.oauth2.consent({
        accept,
        scope: scopes.join(' '),
        oauth_query: query,
      })
      if (result.error)
        throw new Error(result.error.message ?? '授权请求处理失败')
      window.location.assign(result.data.url)
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : '授权请求处理失败',
      )
      setSubmitting(false)
    }
  }

  if (isPending)
    return (
      <AppShell>
        <div className="mx-auto max-w-xl px-4 py-12 text-center text-sm text-muted-foreground">
          正在检查登录状态…
        </div>
      </AppShell>
    )
  if (!queryReady || redirectingToLogin)
    return (
      <AppShell>
        <div className="mx-auto max-w-xl px-4 py-12 text-center text-sm text-muted-foreground">
          正在准备登录…
        </div>
      </AppShell>
    )
  if (oauthError || !session?.user)
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6 lg:py-10">
          <Alert variant="destructive">
            <AlertTitle>授权请求无效</AlertTitle>
            <AlertDescription>
              {oauthError || '当前账号尚未登录。'}
            </AlertDescription>
          </Alert>
        </div>
      </AppShell>
    )

  const isAdmin = isAdminRole(session.user.role)
  const toggleSessionList = () => {
    setSessionListOpen((open) => !open)
    if (!sessionListOpen) void loadSessions()
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6 lg:py-10">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center bg-muted">
                <ShieldCheckIcon />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  OAUTH 2.1
                </p>
                <CardTitle className="mt-1 tracking-normal normal-case">
                  允许应用访问你的身份？
                </CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="grid gap-4 border-y py-5 text-sm">
              <div>
                <p className="text-muted-foreground">客户端</p>
                <p className="mt-1 break-all font-medium">{clientName}</p>
                {clientUri ? (
                  <a
                    className="mt-1 block break-all text-xs text-muted-foreground underline"
                    href={clientUri}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {clientUri}
                  </a>
                ) : null}
                <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                  {clientId}
                </p>
              </div>
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-muted-foreground">当前授权用户</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={sessionsLoading || sessionSwitching || submitting}
                    onClick={toggleSessionList}
                  >
                    {sessionsLoading ? '正在读取…' : '切换用户'}
                  </Button>
                </div>
                <p className="mt-1 font-medium">{session.user.name}</p>
                {isAdmin ? (
                  <Alert className="mt-3" variant="destructive">
                    <AlertTitle>当前账号不能授权</AlertTitle>
                    <AlertDescription>
                      管理员账户不能授权第三方应用。请切换到普通用户后继续，或直接拒绝本次请求。
                    </AlertDescription>
                  </Alert>
                ) : null}
                {sessionListOpen ? (
                  <div className="mt-3 grid gap-1 border-y py-2">
                    {sessionError ? (
                      <p className="text-xs text-destructive">{sessionError}</p>
                    ) : sessions.length ? (
                      sessions.map((item) => (
                        <button
                          key={item.session.token}
                          type="button"
                          className="flex items-center gap-2 px-2 py-2 text-left text-sm outline-none hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                          disabled={
                            sessionSwitching || item.user.id === session.user.id
                          }
                          onClick={() => void switchSession(item.session.token)}
                        >
                          <Avatar className="size-6">
                            <AvatarImage
                              src={item.user.image ?? undefined}
                              alt=""
                            />
                            <AvatarFallback>
                              {item.user.name.slice(0, 1)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="min-w-0 flex-1 truncate">
                            {item.user.name}
                          </span>
                          {isAdminRole(item.user.role) ? (
                            <span className="text-[10px] text-muted-foreground">
                              管理员
                            </span>
                          ) : null}
                          {item.user.id === session.user.id ? (
                            <span className="text-[10px] text-muted-foreground">
                              当前
                            </span>
                          ) : null}
                        </button>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        没有其它已登录账户
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium">请求的 scope</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {scopes.map((scope) => (
                  <Badge key={scope} variant="outline">
                    {scope}
                  </Badge>
                ))}
              </div>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                只有请求 `bili:public` 时，应用才能获得当前绑定的公开 B 站 MID。
              </p>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertTitle>授权失败</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="flex-wrap gap-2 border-t">
            <Button
              type="button"
              disabled={submitting || isAdmin}
              onClick={() => void submit(true)}
            >
              <CheckIcon data-icon="inline-start" />
              同意并继续
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => void submit(false)}
            >
              <XIcon data-icon="inline-start" />
              拒绝
            </Button>
          </CardFooter>
        </Card>
      </div>
    </AppShell>
  )
}
