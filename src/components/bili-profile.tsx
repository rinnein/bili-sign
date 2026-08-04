import { ExternalLinkIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Badge } from '#/components/ui/badge'
import { CopyField } from '#/components/copy-field'
import type { BiliInfo } from '#/lib/bili-flow'
import { openBiliSettings } from '#/lib/bili-flow'
import { isPublicBiliInfo } from '#/lib/bili-public'
import { pluginBridge } from '#/lib/plugin-bridge'
import { cn } from '#/lib/utils'

export function BiliProfile({
  info,
  compact = false,
  embedded = false,
}: {
  info: BiliInfo
  compact?: boolean
  embedded?: boolean
}) {
  const [avatarSrc, setAvatarSrc] = useState(info.face)
  const [avatarFallbackAttempted, setAvatarFallbackAttempted] = useState(false)

  useEffect(() => {
    setAvatarSrc(info.face)
    setAvatarFallbackAttempted(false)
  }, [info.face, info.mid])

  async function handleAvatarError() {
    if (avatarFallbackAttempted) {
      setAvatarSrc('')
      return
    }
    setAvatarFallbackAttempted(true)
    if (!pluginBridge.hasCapability('bili.api.proxy')) {
      setAvatarSrc('')
      return
    }
    try {
      const result = await pluginBridge.request<unknown>(
        'bili.api.proxy',
        'bili.public-info.get',
        { mid: info.mid },
      )
      if (isPublicBiliInfo(result) && result.face) {
        setAvatarSrc(result.face)
      } else {
        setAvatarSrc('')
      }
    } catch {
      setAvatarSrc('')
    }
  }

  const header = (
    <CardHeader className={cn('border-b', embedded && 'pt-8')}>
      <div className="flex items-center gap-3">
        <Avatar className={compact ? 'size-10' : 'size-14'}>
          <AvatarImage
            src={avatarSrc || undefined}
            alt={`${info.name} 的头像`}
            onError={() => void handleAvatarError()}
          />
          <AvatarFallback>{info.name.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <CardTitle className="truncate text-base tracking-normal normal-case">
            {info.name}
          </CardTitle>
          <p className="text-sm text-muted-foreground">MID {info.mid}</p>
        </div>
        <Badge variant={info.ban ? 'destructive' : 'secondary'}>
          {info.ban ? '已封禁' : '公开资料'}
        </Badge>
      </div>
    </CardHeader>
  )

  const content = (
    <CardContent className="flex flex-col gap-5 pt-6 pb-8">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          签名
        </p>
        <div className="mt-1">
          <CopyField value={info.sign || '未设置'} label="复制签名" />
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <ProfileMetric label="粉丝" value={info.fans.toLocaleString()} />
        <ProfileMetric
          label="等级 / 大会员"
          value={`LV${info.level} / ${info.vip > 0 ? '已开通' : '未开通'}`}
        />
      </div>
    </CardContent>
  )

  if (embedded)
    return (
      <>
        {header}
        {content}
      </>
    )

  return (
    <Card>
      {header}
      {content}
      {!compact && (
        <div className="flex flex-wrap gap-2 border-t px-6 py-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openBiliSettings(info.mid)}
          >
            <ExternalLinkIcon data-icon="inline-start" />
            打开B站个人空间
          </Button>
        </div>
      )}
    </Card>
  )
}

function ProfileMetric({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-medium" title={value}>
        {value}
      </p>
    </div>
  )
}
