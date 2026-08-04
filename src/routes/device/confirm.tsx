import { Link, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { DeviceAuthorizationCard } from '#/components/device-authorization-card'
import { AppShell } from '#/components/app-shell'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { authClient } from '#/lib/auth-client'

export const Route = createFileRoute('/device/confirm')({
  validateSearch: z.object({
    user_code: z.string().optional(),
  }),
  component: DeviceConfirm,
})

function DeviceConfirm() {
  const { data: session, isPending } = authClient.useSession()
  const { user_code: userCode } = Route.useSearch()

  if (isPending) {
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-md px-4 py-12 text-center text-sm text-muted-foreground">
          正在准备确认页面…
        </div>
      </AppShell>
    )
  }

  if (!session?.user) {
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-md px-4 py-8 sm:px-6 lg:py-10">
          <Card>
            <CardHeader>
              <CardTitle>请先登录</CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/login">前往登录</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-lg px-4 py-8 sm:px-6 lg:py-10">
        <DeviceAuthorizationCard initialUserCode={userCode} />
      </div>
    </AppShell>
  )
}
