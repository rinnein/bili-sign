import {
  AlertTriangleIcon,
  ExternalLinkIcon,
  LoaderCircleIcon,
  SearchIcon,
  ShieldAlertIcon,
} from 'lucide-react'
import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'

import { AppShell } from '#/components/app-shell'
import { BiliProfile } from '#/components/bili-profile'
import { CopyField } from '#/components/copy-field'
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
import { Field, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'
import { authClient } from '#/lib/auth-client'
import { getBiliInfo, openBiliSettings } from '#/lib/bili-flow'
import type { BiliInfo } from '#/lib/bili-flow'
import { readLastMid, rememberMid, resolveMidInput } from '#/lib/mid'
import { usePluginBridge } from '#/lib/plugin-bridge'

export const Route = createFileRoute('/abuse')({ component: Abuse })

function Abuse() {
  const [mid, setMid] = useState(readLastMid)
  const [info, setInfo] = useState<BiliInfo | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  usePluginBridge()

  async function lookup() {
    setError('')
    setNotice('')
    setInfo(null)
    setBusy(true)
    try {
      const normalized = await resolveMidInput(mid)
      const targetMid = normalized.mid
      setMid(targetMid)
      setInfo(await getBiliInfo(targetMid))
      rememberMid(targetMid)
    } catch (lookupError) {
      setError(
        lookupError instanceof Error
          ? lookupError.message
          : '查询失败，请稍后重试',
      )
    } finally {
      setBusy(false)
    }
  }

  async function revoke() {
    if (!info) return
    setBusy(true)
    setError('')
    try {
      const result = await authClient.biliBasic.revoke({ mid: info.mid })
      if (result.error)
        throw new Error(result.error.message ?? '解除绑定失败，请检查签名')
      setInfo(null)
      setMid('')
      setNotice(
        '已验证撤销签名。对应绑定已解除，自动注册的账户和会话也已注销。',
      )
      setConfirmOpen(false)
    } catch (revokeError) {
      setError(
        revokeError instanceof Error ? revokeError.message : '解除绑定失败',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="mb-10">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            ACCOUNT RECOVERY
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            账户被冒用？
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            不需要登录。查询公开资料确认目标账号后，将撤销指令写入该账号签名，即可解除可能被冒用的绑定。
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>查询 B 站账号</CardTitle>
            <CardDescription>
              查询只用于防止误操作，不会读取隐私资料。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="abuse-mid">B 站 MID</FieldLabel>
                <Input
                  id="abuse-mid"
                  inputMode="text"
                  placeholder="输入 MID 或粘贴 B 站空间链接"
                  className="h-11 border-input bg-background px-3 shadow-none"
                  value={mid}
                  onChange={(event) => setMid(event.target.value)}
                />
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="border-t">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void lookup()}
            >
              {busy ? (
                <LoaderCircleIcon
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <SearchIcon data-icon="inline-start" />
              )}
              查询公开资料
            </Button>
          </CardFooter>
        </Card>

        {error && (
          <Alert variant="destructive" className="mt-6">
            <AlertTriangleIcon />
            <AlertTitle>操作未完成</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {notice && (
          <Alert className="mt-6">
            <ShieldAlertIcon />
            <AlertTitle>处理完成</AlertTitle>
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}
        {info && (
          <div className="mt-6 flex flex-col gap-6">
            <BiliProfile info={info} compact />
            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle>验证撤销权限</CardTitle>
                <CardDescription>
                  请将下面的值写入 MID {info.mid} 的 B 站个人签名，再执行撤销。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CopyField value="bauth::revoke" label="复制撤销指令" />
              </CardContent>
              <CardFooter className="flex-wrap gap-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => openBiliSettings(info.mid)}
                >
                  <ExternalLinkIcon data-icon="inline-start" />
                  打开B站个人空间
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => setConfirmOpen(true)}
                >
                  <ShieldAlertIcon data-icon="inline-start" />
                  执行撤销
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认解除该绑定？</AlertDialogTitle>
            <AlertDialogDescription>
              只有在你已经把 `bauth::revoke`
              写入目标账号签名后继续。撤销成功后，自动注册账户的登录会话也会被删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={(event) => {
                event.preventDefault()
                void revoke()
              }}
            >
              {busy ? (
                <LoaderCircleIcon
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : null}
              确认撤销
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  )
}
