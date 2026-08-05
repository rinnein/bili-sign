import {
  BookOpenIcon,
  Code2Icon,
  LayoutDashboardIcon,
  MenuIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  UserRoundIcon,
  BadgeCheckIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from '@tanstack/react-router'

import { authClient } from '#/lib/auth-client'
import { isAdminRole, isPendingAdminRole } from '#/lib/admin'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from '#/components/ui/navigation-menu'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '#/components/ui/sheet'
import { cn } from '#/lib/utils'

const links = [
  { to: '/verify' as const, label: '验证账号', icon: BadgeCheckIcon },
  { to: '/abuse' as const, label: '账户被冒用？', icon: ShieldAlertIcon },
  { to: '/docs' as const, label: '文档', icon: BookOpenIcon },
  { to: '/developer' as const, label: '开发者设置', icon: Code2Icon },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = authClient.useSession()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const pendingAdmin = isPendingAdminRole(session?.user.role)
  const visibleLinks = pendingAdmin
    ? links.filter(({ to }) => to === '/docs')
    : links

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 shrink-0 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="flex items-center gap-2 font-semibold tracking-tight"
            aria-label="bili-sign 首页"
          >
            <span className="grid size-7 place-items-center bg-foreground text-background">
              <ShieldCheckIcon className="size-4" />
            </span>
            bili-sign
          </Link>

          <NavigationMenu className="hidden md:flex" viewport={false}>
            <NavigationMenuList>
              {visibleLinks.map(({ to, label, icon: Icon }) => (
                <NavigationMenuItem key={to}>
                  <NavigationMenuLink asChild active={location.pathname === to}>
                    <Link to={to} className="gap-2">
                      <Icon data-icon="inline-start" />
                      {label}
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              ))}
              {session?.user && !pendingAdmin && (
                <NavigationMenuItem>
                  <NavigationMenuLink
                    asChild
                    active={location.pathname === '/dashboard'}
                  >
                    <Link to="/dashboard" className="gap-2">
                      <LayoutDashboardIcon data-icon="inline-start" />
                      账户面板
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              )}
              {session?.user && isAdminRole(session.user.role) && (
                <NavigationMenuItem>
                  <NavigationMenuLink
                    asChild
                    active={location.pathname.startsWith('/admin')}
                  >
                    <Link to="/admin/dashboard" className="gap-2">
                      <ShieldCheckIcon data-icon="inline-start" />
                      管理员
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              )}
            </NavigationMenuList>
          </NavigationMenu>

          <div className="ml-auto flex items-center gap-2">
            {session?.user ? (
              <AccountMenu
                name={session.user.name}
                image={session.user.image}
              />
            ) : (
              <div className="flex items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/verify">注册</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/login">
                    <UserRoundIcon data-icon="inline-start" />
                    登录
                  </Link>
                </Button>
              </div>
            )}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="md:hidden"
                  aria-label="打开导航菜单"
                >
                  <MenuIcon />
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle>导航</SheetTitle>
                  <SheetDescription>选择服务功能或查看文档。</SheetDescription>
                </SheetHeader>
                <nav className="flex flex-col gap-1 px-8">
                  {visibleLinks.map(({ to, label, icon: Icon }) => (
                    <SheetClose asChild key={to}>
                      <Link
                        to={to}
                        aria-current={
                          location.pathname === to ? 'page' : undefined
                        }
                        className={cn(
                          'flex items-center gap-3 border-b px-3 py-4 text-sm font-medium',
                          location.pathname === to &&
                            'bg-accent text-accent-foreground',
                        )}
                      >
                        <Icon className="size-4" />
                        {label}
                      </Link>
                    </SheetClose>
                  ))}
                  {session?.user && !pendingAdmin && (
                    <SheetClose asChild>
                      <Link
                        to="/dashboard"
                        aria-current={
                          location.pathname === '/dashboard'
                            ? 'page'
                            : undefined
                        }
                        className={cn(
                          'flex items-center gap-3 border-b px-3 py-4 text-sm font-medium',
                          location.pathname === '/dashboard' &&
                            'bg-accent text-accent-foreground',
                        )}
                      >
                        <LayoutDashboardIcon className="size-4" />
                        账户面板
                      </Link>
                    </SheetClose>
                  )}
                  {session?.user && isAdminRole(session.user.role) && (
                    <SheetClose asChild>
                      <Link
                        to="/admin/dashboard"
                        aria-current={
                          location.pathname.startsWith('/admin')
                            ? 'page'
                            : undefined
                        }
                        className={cn(
                          'flex items-center gap-3 border-b px-3 py-4 text-sm font-medium',
                          location.pathname.startsWith('/admin') &&
                            'bg-accent text-accent-foreground',
                        )}
                      >
                        <ShieldCheckIcon className="size-4" />
                        管理员
                      </Link>
                    </SheetClose>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      <footer className="shrink-0 border-t">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-6 text-xs text-muted-foreground sm:px-6 lg:px-8">
          <span>只使用 B 站公开资料，不接触登录凭证。</span>
          <Link to="/docs" className="underline underline-offset-4">
            查看说明
          </Link>
        </div>
      </footer>
    </div>
  )
}

function AccountMenu({ name, image }: { name: string; image?: string | null }) {
  const { data: session } = authClient.useSession()
  const pendingAdmin = isPendingAdminRole(session?.user.role)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="gap-2 px-2">
          <Avatar className="size-7">
            <AvatarImage src={image ?? undefined} alt="" />
            <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-28 truncate sm:inline">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>{name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {pendingAdmin ? (
          <DropdownMenuItem asChild>
            <Link to="/init">完成管理员初始化</Link>
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem asChild>
              <Link to="/dashboard">账户面板</Link>
            </DropdownMenuItem>
            <SessionSwitcher currentUserId={session?.user.id} />
          </>
        )}
        <DropdownMenuItem onClick={() => void authClient.signOut()}>
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

type DeviceSession = {
  session: {
    token: string
    userId: string
  }
  user: {
    id: string
    name: string
    image?: string | null
    role?: string | null
  }
}

function SessionSwitcher({ currentUserId }: { currentUserId?: string }) {
  const [open, setOpen] = useState(false)
  const [sessions, setSessions] = useState<Array<DeviceSession>>([])
  const [loading, setLoading] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState('')

  async function loadSessions() {
    setLoading(true)
    setError('')
    const result = await authClient.multiSession.listDeviceSessions()
    if (result.error) {
      setError('暂时无法读取已登录账户。')
      setSessions([])
    } else {
      setSessions(result.data)
    }
    setLoading(false)
  }

  async function switchSession(sessionToken: string) {
    setSwitching(true)
    setError('')
    const result = await authClient.multiSession.setActive({ sessionToken })
    if (result.error) {
      setError('切换账户失败，请重试。')
      setSwitching(false)
      return
    }
    window.location.reload()
  }

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
