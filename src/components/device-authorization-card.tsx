import {
  ClipboardPasteIcon,
  KeyRoundIcon,
  LoaderCircleIcon,
  SmartphoneIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import {
  DeviceCodeScanner,
  ScanDeviceCodeButton,
} from '#/components/device-code-scanner'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Field, FieldLabel } from '#/components/ui/field'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '#/components/ui/input-otp'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { authClient } from '#/lib/auth-client'
import {
  DEVICE_AUTH_USER_CODE_LENGTH,
  deviceAuthErrorMessage,
  normalizeDeviceUserCode,
} from '#/lib/device-auth'
import { cn } from '#/lib/utils'

type AttemptStatus = 'idle' | 'success' | 'error'

type DeviceAuthorizationCardProps = {
  initialUserCode?: string
  onScanned?: (userCode: string) => void
}

export function DeviceAuthorizationCard({
  initialUserCode = '',
  onScanned,
}: DeviceAuthorizationCardProps) {
  const [userCode, setUserCode] = useState(initialUserCode)
  const [busy, setBusy] = useState(false)
  const [attemptStatus, setAttemptStatus] = useState<AttemptStatus>('idle')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [notice, setNotice] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const attemptedCodeRef = useRef('')
  const statusTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const normalizedCode = normalizeDeviceUserCode(initialUserCode).slice(
      0,
      DEVICE_AUTH_USER_CODE_LENGTH,
    )
    setUserCode(normalizedCode)
    attemptedCodeRef.current = ''
    setAttemptStatus('idle')
  }, [initialUserCode])

  useEffect(
    () => () => {
      if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current)
    },
    [],
  )

  useEffect(() => {
    if (
      userCode.length !== DEVICE_AUTH_USER_CODE_LENGTH ||
      busy ||
      attemptedCodeRef.current === userCode
    ) {
      return
    }
    attemptedCodeRef.current = userCode
    void approveDeviceLogin(userCode)
  }, [busy, userCode])

  function updateUserCode(value: string) {
    const normalizedCode = normalizeDeviceUserCode(value).slice(
      0,
      DEVICE_AUTH_USER_CODE_LENGTH,
    )
    setUserCode(normalizedCode)
    setAttemptStatus('idle')
    setNotice(null)
    attemptedCodeRef.current = ''
  }

  async function approveDeviceLogin(code = userCode) {
    const normalizedCode = normalizeDeviceUserCode(code)
    if (!normalizedCode) {
      setNotice({ type: 'error', message: '请输入或扫描设备登录码。' })
      return
    }

    setBusy(true)
    setAttemptStatus('idle')
    setNotice(null)
    try {
      const pending = await authClient.device({
        query: { user_code: normalizedCode },
      })
      if (pending.error) {
        throw new Error(
          deviceAuthErrorMessage(pending.error, '设备登录码无效或已过期。'),
        )
      }
      if (pending.data.status !== 'pending') {
        throw new Error('这个设备登录码已经使用过了，请让其它设备重新生成。')
      }

      const approved = await authClient.device.approve({
        userCode: normalizedCode,
      })
      if (approved.error) {
        throw new Error(
          deviceAuthErrorMessage(approved.error, '设备登录授权失败。'),
        )
      }

      setAttemptStatus('success')
      setNotice({
        type: 'success',
        message: '设备已授权，登录页会自动完成登录。',
      })
      if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current)
      statusTimerRef.current = window.setTimeout(
        () => setAttemptStatus('idle'),
        1600,
      )
    } catch (error) {
      setAttemptStatus('error')
      setNotice({
        type: 'error',
        message: deviceAuthErrorMessage(
          error,
          '设备登录授权失败，请检查登录码。',
        ),
      })
    } finally {
      setBusy(false)
    }
  }

  function handleScanned(scannedCode: string) {
    const normalizedCode = normalizeDeviceUserCode(scannedCode)
    updateUserCode(normalizedCode)
    onScanned?.(normalizedCode)
  }

  async function pasteDeviceCode() {
    try {
      const pastedValue = await navigator.clipboard.readText()
      const normalizedCode = normalizeDeviceUserCode(pastedValue).slice(
        0,
        DEVICE_AUTH_USER_CODE_LENGTH,
      )
      if (!normalizedCode) {
        setNotice({ type: 'error', message: '剪贴板中没有可用的设备码。' })
        return
      }
      updateUserCode(normalizedCode)
    } catch {
      setNotice({
        type: 'error',
        message: '无法读取剪贴板，请手动输入设备码。',
      })
    }
  }

  const slotClassName = cn(
    attemptStatus === 'success' &&
      'border-b-success bg-success/10 text-success',
    attemptStatus === 'error' &&
      'border-b-destructive bg-destructive/10 text-destructive',
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SmartphoneIcon className="size-4" />
          授权其它设备
        </CardTitle>
        <CardDescription>
          输入或扫描其它设备登录页显示的设备登录码。
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {notice ? (
          <Alert variant={notice.type === 'error' ? 'destructive' : 'default'}>
            <AlertTitle>
              {notice.type === 'error' ? '授权失败' : '授权成功'}
            </AlertTitle>
            <AlertDescription>{notice.message}</AlertDescription>
          </Alert>
        ) : null}
        <Field>
          <FieldLabel htmlFor="device-user-code">设备登录码</FieldLabel>
          <div className="flex items-center gap-2">
            <InputOTP
              id="device-user-code"
              maxLength={DEVICE_AUTH_USER_CODE_LENGTH}
              value={userCode}
              onChange={updateUserCode}
              autoComplete="one-time-code"
              disabled={busy}
              aria-label="设备登录码"
              containerClassName="min-w-0 flex-1"
            >
              <InputOTPGroup className="w-full gap-0">
                {Array.from(
                  { length: DEVICE_AUTH_USER_CODE_LENGTH },
                  (_, index) => (
                    <InputOTPSlot
                      key={index}
                      index={index}
                      className={cn('size-9 sm:size-10', slotClassName)}
                    />
                  ),
                )}
              </InputOTPGroup>
            </InputOTP>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 px-2 sm:px-3"
                  disabled={busy}
                  onClick={() => void pasteDeviceCode()}
                  aria-label="粘贴设备码"
                >
                  <ClipboardPasteIcon data-icon="inline-start" />
                  <span className="hidden sm:inline">粘贴</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>粘贴设备码</TooltipContent>
            </Tooltip>
          </div>
        </Field>
        <div className="flex flex-wrap gap-2">
          <ScanDeviceCodeButton onClick={() => setScannerOpen(true)} />
          <Button
            type="button"
            disabled={busy || attemptStatus === 'success'}
            onClick={() => void approveDeviceLogin()}
          >
            {busy ? (
              <LoaderCircleIcon
                className="animate-spin"
                data-icon="inline-start"
              />
            ) : (
              <KeyRoundIcon data-icon="inline-start" />
            )}
            确认跨设备登录
          </Button>
        </div>
      </CardContent>
      <DeviceCodeScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScanned={handleScanned}
      />
    </Card>
  )
}
