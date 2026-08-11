import { ArrowLeftIcon, CircleAlertIcon } from 'lucide-react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'

import { AppShell } from '#/components/app-shell'
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

export const Route = createFileRoute('/error')({
  validateSearch: z.object({
    error: z.string().optional(),
    error_description: z.string().optional(),
  }),
  head: () => ({
    meta: [{ title: 'OAuth 授权失败 · bili-sign' }],
  }),
  component: OAuthError,
})

function OAuthError() {
  const navigate = useNavigate()
  const { error, error_description: errorDescription } = Route.useSearch()
  const description =
    errorDescription || 'OAuth 授权请求未能完成，请返回第三方应用重试。'

  function handleBack() {
    if (window.history.length > 1) {
      window.history.back()
      return
    }
    void navigate({ to: '/' })
  }

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8 sm:px-6 lg:py-10">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center bg-destructive/10 text-destructive">
                <CircleAlertIcon />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  OAUTH 2.1
                </p>
                <CardTitle className="mt-1 tracking-normal normal-case">
                  OAuth 授权失败
                </CardTitle>
              </div>
            </div>
            <CardDescription>第三方应用的授权请求未能完成。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Alert variant="destructive">
              <AlertTitle>请求未能完成</AlertTitle>
              <AlertDescription>{description}</AlertDescription>
            </Alert>
            {error ? (
              <div className="grid gap-1 border-t pt-4">
                <p className="text-xs text-muted-foreground">错误代码</p>
                <code className="break-all">{error}</code>
              </div>
            ) : null}
          </CardContent>
          <CardFooter className="border-t">
            <Button type="button" onClick={handleBack}>
              <ArrowLeftIcon data-icon="inline-start" />
              返回上一页
            </Button>
          </CardFooter>
        </Card>
      </div>
    </AppShell>
  )
}
