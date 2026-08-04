import { LogOutIcon } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import { authClient } from '#/lib/auth-client'

export default function BetterAuthHeader() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) return <Skeleton className="size-8" />
  if (!session?.user) return null

  return (
    <div className="flex items-center gap-2">
      <Avatar className="size-8">
        <AvatarImage src={session.user.image ?? undefined} alt="" />
        <AvatarFallback>{session.user.name.slice(0, 1)}</AvatarFallback>
      </Avatar>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void authClient.signOut()}
      >
        <LogOutIcon data-icon="inline-start" />
        退出登录
      </Button>
    </div>
  )
}
