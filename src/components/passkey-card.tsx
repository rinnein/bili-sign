import { KeyRoundIcon, LoaderCircleIcon } from 'lucide-react'
import { getAuthenticatorName } from '@better-auth/passkey'
import { useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
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
import { authClient } from '#/lib/auth-client'
import { deviceAuthErrorMessage } from '#/lib/device-auth'

export function PasskeyCard({
  onPasskeyAdded,
}: {
  onPasskeyAdded?: () => void
}) {
  const [passkeyName, setPasskeyName] = useState('')
  const [pendingPasskey, setPendingPasskey] = useState<{
    id: string
    defaultName: string
  } | null>(null)
  const [passkeyNameOpen, setPasskeyNameOpen] = useState(false)
  const [passkeyBusy, setPasskeyBusy] = useState(false)
  const [passkeyNameBusy, setPasskeyNameBusy] = useState(false)
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
      setPendingPasskey({ id: result.data.id, defaultName })
      setPasskeyName(defaultName)
      setPasskeyNameOpen(true)
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
    } catch (nameError) {
      setPasskeyError(
        deviceAuthErrorMessage(nameError, 'Passkey 已创建，但名称保存失败。'),
      )
    } finally {
      setPasskeyNameBusy(false)
    }
  }

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
              <AlertTitle>绑定失败</AlertTitle>
              <AlertDescription>{passkeyError}</AlertDescription>
            </Alert>
          ) : null}
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
            <DialogTitle>给 Passkey 起个名字</DialogTitle>
            <DialogDescription>
              Passkey 已创建。名称可留空，将使用自动名称。
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
    </>
  )
}
