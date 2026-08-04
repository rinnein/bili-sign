import {
  BookOpenIcon,
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
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = authClient.useSession()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

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
              {links.map(({ to, label, icon: Icon }) => (
                <NavigationMenuItem key={to}>
                  <NavigationMenuLink asChild active={location.pathname === to}>
                    <Link to={to} className="gap-2">
                      <Icon data-icon="inline-start" />
                      {label}
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              ))}
              {session?.user && (
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
            </NavigationMenuList>
          </NavigationMenu>

          <div className="ml-auto flex items-center gap-2">
            {session?.user ? (
              <AccountMenu
                name={session.user.name}
                image={session.user.image}
              />
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link to="/login">
                  <UserRoundIcon data-icon="inline-start" />
                  登录
                </Link>
              </Button>
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
                  {links.map(({ to, label, icon: Icon }) => (
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
                  {session?.user && (
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
        <DropdownMenuItem asChild>
          <Link to="/dashboard">账户面板</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void authClient.signOut()}>
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
