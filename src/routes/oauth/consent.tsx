import { CheckIcon, ShieldCheckIcon, XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'

import { AppShell } from '#/components/app-shell'
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
import { authClient, authFetch } from '#/lib/auth-client'

export const Route = createFileRoute('/oauth/consent')({
  component: OAuthConsent,
})

function OAuthConsent() {
  const { data: session, isPending } = authClient.useSession()
  const [query, setQuery] = useState('')
  const [clientId, setClientId] = useState('')
  const [scopes, setScopes] = useState<Array<string>>([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const currentQuery = window.location.search.slice(1)
    const params = new URLSearchParams(currentQuery)
    setQuery(currentQuery)
    setClientId(params.get('client_id') ?? '第三方应用')
    setScopes((params.get('scope') ?? '').split(' ').filter(Boolean))
  }, [])

  async function submit(accept: boolean) {
    setSubmitting(true)
    setError('')
    try {
      const response = await authFetch('/api/auth/oauth2/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          accept,
          scope: scopes.join(' '),
          oauth_query: query,
        }),
      })
      const result = (await response.json()) as {
        redirect_uri?: string
        message?: string
      }
      if (!response.ok || !result.redirect_uri)
        throw new Error(result.message ?? '授权请求处理失败')
      window.location.assign(result.redirect_uri)
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
  if (!session?.user)
    return (
      <AppShell>
        <OAuthLoginRedirect query={query} />
      </AppShell>
    )

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
                <p className="mt-1 break-all font-mono text-xs">{clientId}</p>
              </div>
              <div>
                <p className="text-muted-foreground">当前账号</p>
                <p className="mt-1 font-medium">{session.user.name}</p>
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
              disabled={submitting}
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

function OAuthLoginRedirect({ query }: { query: string }) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6 lg:py-10">
      <Card>
        <CardHeader>
          <CardTitle>需要先验证 B 站账号</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-7 text-muted-foreground">
            完成账号验证后，返回此页面继续授权。原始 state 和 OAuth 参数会保留。
          </p>
        </CardContent>
        <CardFooter className="border-t">
          <Button
            type="button"
            onClick={() =>
              window.location.assign(query ? `/verify?${query}` : '/verify')
            }
          >
            返回账号验证
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
