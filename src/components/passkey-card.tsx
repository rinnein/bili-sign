import {
  KeyRoundIcon,
  LoaderCircleIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react'
import { getAuthenticatorName } from '@better-auth/passkey'
import { useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
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
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Field, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { Separator } from '#/components/ui/separator'
import { Skeleton } from '#/components/ui/skeleton'
import { authClient } from '#/lib/auth-client'
import { deviceAuthErrorMessage } from '#/lib/device-auth'

export function PasskeyCard({
  onPasskeyAdded,
}: {
  onPasskeyAdded?: () => void
}) {
  const {
    data: passkeys,
    error: passkeyListError,
    isPending: passkeysPending,
    refetch: refetchPasskeys,
  } = authClient.useListPasskeys()
  const [passkeyName, setPasskeyName] = useState('')
  const [pendingPasskey, setPendingPasskey] = useState<{
    id: string
    defaultName: string
    isNew: boolean
  } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{
    id: string
    name: string
  } | null>(null)
  const [passkeyNameOpen, setPasskeyNameOpen] = useState(false)
  const [passkeyBusy, setPasskeyBusy] = useState(false)
  const [passkeyNameBusy, setPasskeyNameBusy] = useState(false)
  const [passkeyDeleteBusy, setPasskeyDeleteBusy] = useState(false)
  const [passkeyError, setPasskeyError] = useState('')

  async function addPasskey() {
    setPasskeyBusy(true)
    setPasskeyError('')
    try {
      const result = await authClient.passkey.addPasskey()
      if (result.error) {
        throw new Error(
          deviceAuthErrorMessage(result.error, 'Passkey 绑定失败'),
        )
      }
      const defaultName =
        result.data.name?.trim() ||
        getAuthenticatorName(result.data.aaguid) ||
        '此设备 Passkey'
      setPendingPasskey({ id: result.data.id, defaultName, isNew: true })
      setPasskeyName(defaultName)
      setPasskeyNameOpen(true)
      await refetchPasskeys()
      onPasskeyAdded?.()
    } catch (passkeyAddError) {
      setPasskeyError(
        deviceAuthErrorMessage(passkeyAddError, 'Passkey 绑定失败，请重试。'),
      )
    } finally {
      setPasskeyBusy(false)
    }
  }

  async function savePasskeyName() {
    if (!pendingPasskey) return
    setPasskeyNameBusy(true)
    setPasskeyError('')
    try {
      const name = passkeyName.trim() || pendingPasskey.defaultName
      const result = await authClient.passkey.updatePasskey({
        id: pendingPasskey.id,
        name,
      })
      if (result.error) {
        throw new Error(
          deviceAuthErrorMessage(result.error, 'Passkey 名称保存失败'),
        )
      }
      setPasskeyNameOpen(false)
      setPendingPasskey(null)
      setPasskeyName('')
      await refetchPasskeys()
    } catch (nameError) {
      setPasskeyError(
        deviceAuthErrorMessage(nameError, 'Passkey 已创建，但名称保存失败。'),
      )
    } finally {
      setPasskeyNameBusy(false)
    }
  }

  async function deletePasskey() {
    if (!pendingDelete) return
    setPasskeyDeleteBusy(true)
    setPasskeyError('')
    try {
      const result = await authClient.passkey.deletePasskey({
        id: pendingDelete.id,
      })
      if (result.error) {
        throw new Error(
          deviceAuthErrorMessage(result.error, 'Passkey 删除失败'),
        )
      }
      setPendingDelete(null)
      await refetchPasskeys()
    } catch (deleteError) {
      setPasskeyError(
        deviceAuthErrorMessage(deleteError, 'Passkey 删除失败，请重试。'),
      )
    } finally {
      setPasskeyDeleteBusy(false)
    }
  }

  function editPasskey(id: string, name: string) {
    setPasskeyError('')
    setPendingPasskey({ id, defaultName: name, isNew: false })
    setPasskeyName(name)
    setPasskeyNameOpen(true)
  }

  const listError = passkeyListError?.message ?? ''
  const sortedPasskeys = [...(passkeys ?? [])].sort(
    (left, right) =>
      getTimestamp(right.createdAt) - getTimestamp(left.createdAt),
  )

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRoundIcon className="size-4" />
            Passkey
          </CardTitle>
          <CardDescription>为当前账户添加设备解锁登录。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {passkeyError ? (
            <Alert variant="destructive">
              <AlertTitle>Passkey 操作失败</AlertTitle>
              <AlertDescription>{passkeyError}</AlertDescription>
            </Alert>
          ) : null}
          {listError ? (
            <Alert variant="destructive">
              <AlertTitle>Passkey 列表读取失败</AlertTitle>
              <AlertDescription>{listError}</AlertDescription>
            </Alert>
          ) : null}
          {passkeysPending ? (
            <div className="grid gap-3" aria-label="正在读取 Passkey">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : passkeys?.length ? (
            <div className="grid max-h-80 gap-3 overflow-y-auto pr-2">
              {sortedPasskeys.map((passkey, index) => {
                const name =
                  passkey.name?.trim() ||
                  getAuthenticatorName(passkey.aaguid) ||
                  '此设备 Passkey'
                const authenticator =
                  getAuthenticatorName(passkey.aaguid) ??
                  (passkey.deviceType === 'multiDevice'
                    ? '可同步 Passkey'
                    : '设备 Passkey')

                return (
                  <div key={passkey.id}>
                    {index > 0 ? <Separator className="mb-3" /> : null}
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid size-9 shrink-0 place-items-center bg-muted">
                        <KeyRoundIcon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {authenticator} · 创建于{' '}
                          {formatDate(passkey.createdAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`修改 ${name} 的名称`}
                          title="修改名称"
                          disabled={passkeyNameBusy || passkeyDeleteBusy}
                          onClick={() => editPasskey(passkey.id, name)}
                        >
                          <PencilIcon />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`删除 ${name}`}
                          title="删除 Passkey"
                          disabled={passkeyNameBusy || passkeyDeleteBusy}
                          onClick={() =>
                            setPendingDelete({ id: passkey.id, name })
                          }
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <Empty className="border border-dashed p-6">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <KeyRoundIcon />
                </EmptyMedia>
                <EmptyTitle>还没有 Passkey</EmptyTitle>
                <EmptyDescription>
                  添加 Passkey 后，可以使用设备解锁快速登录。
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          <Button
            type="button"
            disabled={passkeyBusy}
            onClick={() => void addPasskey()}
          >
            {passkeyBusy ? (
              <LoaderCircleIcon
                className="animate-spin"
                data-icon="inline-start"
              />
            ) : (
              <KeyRoundIcon data-icon="inline-start" />
            )}
            添加 Passkey
          </Button>
        </CardContent>
      </Card>
      <Dialog open={passkeyNameOpen} onOpenChange={setPasskeyNameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingPasskey?.isNew
                ? '给 Passkey 起个名字'
                : '修改 Passkey 名称'}
            </DialogTitle>
            <DialogDescription>
              {pendingPasskey?.isNew
                ? 'Passkey 已创建。名称可留空，将使用自动名称。'
                : '修改后会立即更新当前账户中的 Passkey 名称。'}
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="passkey-name">名称</FieldLabel>
            <Input
              id="passkey-name"
              value={passkeyName}
              onChange={(event) => setPasskeyName(event.target.value)}
              placeholder="例如：我的手机"
              disabled={passkeyNameBusy}
            />
          </Field>
          {passkeyError ? (
            <Alert variant="destructive">
              <AlertTitle>名称保存失败</AlertTitle>
              <AlertDescription>{passkeyError}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              onClick={() => void savePasskeyName()}
              disabled={passkeyNameBusy}
            >
              {passkeyNameBusy ? (
                <LoaderCircleIcon
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : null}
              完成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open && !passkeyDeleteBusy) setPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这个 Passkey？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后无法使用该设备解锁登录。
              {pendingDelete?.name
                ? ` 当前 Passkey：${pendingDelete.name}。`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={passkeyDeleteBusy}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={passkeyDeleteBusy}
              onClick={(event) => {
                event.preventDefault()
                void deletePasskey()
              }}
            >
              {passkeyDeleteBusy ? (
                <LoaderCircleIcon
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <Trash2Icon data-icon="inline-start" />
              )}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('zh-CN')
}

function getTimestamp(value: Date | string) {
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value)
  return Number.isNaN(timestamp) ? 0 : timestamp
}
