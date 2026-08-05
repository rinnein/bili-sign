import { ArrowRightIcon, BookOpenIcon } from 'lucide-react'
import { Link, createFileRoute } from '@tanstack/react-router'

import { AppShell } from '#/components/app-shell'
import { Button } from '#/components/ui/button'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <AppShell>
      <div className="mx-auto flex min-h-[calc(100svh-9rem)] w-full max-w-3xl flex-col justify-center px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          BILI-SIGN
        </p>
        <h1 className="mt-5 text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">
          使用 B 站账号登录
        </h1>
        <p className="mt-5 max-w-xl text-base text-muted-foreground">
          完成一次签名验证，即可登录本服务或继续第三方授权。
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/login">
              登录
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/verify">注册</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/docs">
              <BookOpenIcon data-icon="inline-start" />
              查看文档
            </Link>
          </Button>
        </div>
      </div>
    </AppShell>
  )
}
