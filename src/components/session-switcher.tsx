import { useState } from 'react'

import { useDeviceSessionSwitcher } from '#/components/device-session-switcher'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '#/components/ui/dropdown-menu'
import { isAdminRole } from '#/lib/admin'

export default function SessionSwitcher({
  currentUserId,
}: {
  currentUserId?: string
}) {
  const [open, setOpen] = useState(false)
  const { sessions, loading, switching, error, loadSessions, switchSession } =
    useDeviceSessionSwitcher()

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>切换账户</DropdownMenuLabel>
      <DropdownMenuItem
        onSelect={(event) => {
          event.preventDefault()
          setOpen((value) => !value)
          if (!open) void loadSessions()
        }}
        disabled={loading || switching}
      >
        {loading ? '正在读取…' : '查看已登录账户'}
      </DropdownMenuItem>
      {open ? (
        <div className="max-h-48 overflow-y-auto px-1 pb-1">
          {error ? (
            <p className="px-2 py-2 text-xs text-destructive">{error}</p>
          ) : sessions.length ? (
            sessions.map((item) => (
              <button
                key={item.session.token}
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
                disabled={switching || item.user.id === currentUserId}
                onClick={() => void switchSession(item.session.token)}
              >
                <Avatar className="size-6">
                  <AvatarImage src={item.user.image ?? undefined} alt="" />
                  <AvatarFallback>{item.user.name.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate">
                  {item.user.name}
                </span>
                {isAdminRole(item.user.role) ? (
                  <span className="text-[10px] text-muted-foreground">
                    管理员
                  </span>
                ) : null}
                {item.user.id === currentUserId ? (
                  <span className="text-[10px] text-muted-foreground">
                    当前
                  </span>
                ) : null}
              </button>
            ))
          ) : (
            <p className="px-2 py-2 text-xs text-muted-foreground">
              没有其它已登录账户
            </p>
          )}
        </div>
      ) : null}
    </>
  )
}
