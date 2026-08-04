import {
  ArrowRightIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  LoaderCircleIcon,
  RotateCcwIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'

import { AppShell } from '#/components/app-shell'
import { BiliProfile } from '#/components/bili-profile'
import { CopyField } from '#/components/copy-field'
import { SafetyDialog } from '#/components/safety-dialog'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Checkbox } from '#/components/ui/checkbox'
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { authClient } from '#/lib/auth-client'
import { hasAcknowledgedSafetyNotice } from '#/lib/safety-notice'
import { openBiliSettings } from '#/lib/bili-flow'
import { useBiliVerification } from '#/features/bili-verification/use-bili-verification'
import { pluginBridge, usePluginBridge } from '#/lib/plugin-bridge'
import { cn } from '#/lib/utils'
import {
  getVerificationNextCooldownRemaining,
  startVerificationNextCooldown,
} from '#/lib/verification-next-cooldown'

export const Route = createFileRoute('/verify')({ component: Verify })

function Verify() {
  const { data: session, isPending, refetch } = authClient.useSession()
  const flow = useBiliVerification({ session, refetch })
  const pluginState = usePluginBridge()
  const [agreementChecked, setAgreementChecked] = useState(false)
  const [safetyOpen, setSafetyOpen] = useState(false)
  const [pendingNext, setPendingNext] = useState(false)
  const [nextWaitRemaining, setNextWaitRemaining] = useState(() =>
    getVerificationNextCooldownRemaining(),
  )
  const requestedPluginMid = useRef(false)
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setAgreementChecked(hasAcknowledgedSafetyNotice())
  }, [])

  useEffect(() => {
    const updateNextCooldown = () =>
      setNextWaitRemaining(getVerificationNextCooldownRemaining())

    updateNextCooldown()
    const interval = window.setInterval(updateNextCooldown, 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!flow.error) return
    errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [flow.error])

  useEffect(() => {
    if (
      requestedPluginMid.current ||
      flow.mid ||
      !pluginState.descriptor?.capabilities.includes('bili.mid.read')
    ) {
      return
    }
    requestedPluginMid.current = true
    void pluginBridge
      .request<{ mid: string }>('bili.mid.read', 'mid.get', {})
      .then((result) => {
        if (/^\d+$/.test(result.mid)) flow.setMid(result.mid)
      })
      .catch(() => {})
  }, [flow, pluginState.descriptor])

  async function proceedToLookup(ignorePending = false) {
    if ((!ignorePending && pendingNext) || flow.busy) return
    const cooldownRemaining = getVerificationNextCooldownRemaining()
    if (cooldownRemaining > 0) {
      setNextWaitRemaining(cooldownRemaining)
      return
    }
    const until = startVerificationNextCooldown()
    setPendingNext(true)
    setNextWaitRemaining(Math.ceil((until - Date.now()) / 1000))
    try {
      await flow.lookup()
    } finally {
      setPendingNext(false)
    }
  }

  function next() {
    if (!agreementChecked) {
      setPendingNext(true)
      setSafetyOpen(true)
      return
    }
    void proceedToLookup()
  }

  async function confirmVerification() {
    return await flow.confirmVerification()
  }

  async function loginWithPlugin() {
    return await flow.loginWithPlugin()
  }

  if (isPending) {
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-xl px-4 py-20 text-center text-sm text-muted-foreground">
          正在准备验证…
        </div>
      </AppShell>
    )
  }

  const directLogin =
    pluginState.descriptor?.capabilities.includes('bili.direct-login')
  const currentStep = flow.challenge ? 2 : flow.verificationCompleted ? 3 : 1

  function goToStep(step: number) {
    if (flow.busy || step >= currentStep) return
    if (step === 1 || step === 2) flow.returnToAccount()
  }

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <nav aria-label="验证步骤" className="mb-8">
          <ol className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
            {['账号', '签名验证', '完成'].map((label, index) => {
              const step = index + 1
              return (
                <li
                  key={label}
                  className={cn(step <= currentStep && 'text-foreground')}
                >
                  {step < currentStep ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={flow.busy}
                      className="h-auto px-0 py-0 text-xs font-medium tracking-normal"
                      onClick={() => goToStep(step)}
                    >
                      {step}. {label}
                    </Button>
                  ) : (
                    <span>
                      {step}. {label}
                    </span>
                  )}
                  {step < 3 ? (
                    <span className="ml-3 text-border">/</span>
                  ) : null}
                </li>
              )
            })}
          </ol>
        </nav>

        {(!flow.info || (!flow.challenge && !flow.verificationCompleted)) && (
          <Card>
            <CardHeader>
              <CardTitle>使用 B 站账号登录</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="verify-mid">B 站账号</FieldLabel>
                  <Input
                    id="verify-mid"
                    inputMode="text"
                    placeholder="输入 MID 或粘贴 B 站空间链接"
                    className="h-11 border-input bg-background px-3 shadow-none"
                    disabled={pendingNext || flow.busy}
                    value={flow.mid}
                    onChange={(event) => flow.setMid(event.target.value)}
                  />
                </Field>
                <Field orientation="horizontal" className="items-start gap-3">
                  <Checkbox
                    id="verify-agreement"
                    checked={agreementChecked}
                    onCheckedChange={(value) =>
                      setAgreementChecked(value === true)
                    }
                  />
                  <FieldContent className="flex-row flex-wrap items-center gap-1">
                    <FieldLabel
                      htmlFor="verify-agreement"
                      className="text-sm font-normal normal-case tracking-normal"
                    >
                      我已阅读并同意
                    </FieldLabel>
                    <button
                      type="button"
                      className="text-sm text-primary underline underline-offset-4"
                      onClick={() => setSafetyOpen(true)}
                    >
                      《安全须知》
                    </button>
                  </FieldContent>
                </Field>
              </FieldGroup>
            </CardContent>
            <CardFooter className="border-t">
              <Button
                type="button"
                className="ml-auto"
                disabled={flow.busy || pendingNext || nextWaitRemaining > 0}
                onClick={next}
              >
                {flow.busy || pendingNext ? (
                  <LoaderCircleIcon
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : (
                  <ArrowRightIcon data-icon="inline-end" />
                )}
                {nextWaitRemaining > 0
                  ? `请等待 ${nextWaitRemaining} 秒`
                  : pendingNext
                    ? '验证中…'
                    : '下一步'}
              </Button>
            </CardFooter>
          </Card>
        )}

        {pluginState.descriptor && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            已连接插件：{pluginState.descriptor.name}
          </p>
        )}

        {flow.info && flow.challenge && (
          <Card className="mt-8 gap-0 py-0">
            <BiliProfile info={flow.info} embedded />
            <ChallengeContent
              challenge={flow.challenge.signInstruction}
              mid={flow.info.mid}
              busy={flow.busy}
              confirmCooldownRemaining={flow.confirmCooldownRemaining}
              directLogin={directLogin}
              pluginName={pluginState.descriptor?.name}
              onConfirm={() => void confirmVerification()}
              onPluginLogin={() => void loginWithPlugin()}
            />
          </Card>
        )}
        {flow.info && flow.verificationCompleted && flow.originalSign && (
          <RestoreCard
            sign={flow.originalSign}
            mid={flow.info.mid}
            onRestore={flow.clearCache}
          />
        )}
        {flow.error && (
          <div ref={errorRef} className="mt-6 scroll-mt-24">
            <Alert variant="destructive">
              <AlertTitle>验证失败</AlertTitle>
              <AlertDescription>{flow.error}</AlertDescription>
            </Alert>
          </div>
        )}
        {flow.notice && (
          <Alert className="mt-6">
            <CheckCircle2Icon />
            <AlertTitle>验证完成</AlertTitle>
            <AlertDescription>{flow.notice}</AlertDescription>
          </Alert>
        )}
      </div>
      <SafetyDialog
        open={safetyOpen}
        onOpenChange={(open) => {
          setSafetyOpen(open)
          if (!open) setPendingNext(false)
        }}
        onAccepted={() => {
          setAgreementChecked(true)
          if (pendingNext) {
            setPendingNext(false)
            void proceedToLookup(true)
          }
        }}
      />
    </AppShell>
  )
}

function ChallengeContent({
  challenge,
  mid,
  busy,
  confirmCooldownRemaining,
  directLogin,
  pluginName,
  onConfirm,
  onPluginLogin,
}: {
  challenge: string
  mid: string
  busy: boolean
  confirmCooldownRemaining: number
  directLogin: boolean | undefined
  pluginName?: string
  onConfirm: () => void
  onPluginLogin: () => void
}) {
  return (
    <>
      <CardHeader className="border-t pt-8">
        <CardTitle>{directLogin ? '通过插件登录' : '修改签名'}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 pt-6 pb-8">
        {directLogin ? (
          <p className="text-sm text-muted-foreground">
            使用「{pluginName}」完成签名验证，结束后会自动恢复原签名。
          </p>
        ) : (
          <>
            <p className="text-sm leading-6 text-muted-foreground">
              将B站个人签名临时修改为以下内容。
            </p>
            <CopyField value={challenge} label="复制签名内容" />
          </>
        )}
      </CardContent>
      <CardFooter className="flex-wrap gap-2 border-t pt-8 pb-8">
        {!directLogin && (
          <Button
            type="button"
            variant="outline"
            onClick={() => openBiliSettings(mid)}
          >
            <ExternalLinkIcon data-icon="inline-start" />
            打开B站个人空间
          </Button>
        )}
        <Button
          type="button"
          className="ml-auto"
          disabled={busy || confirmCooldownRemaining > 0}
          onClick={directLogin ? onPluginLogin : onConfirm}
        >
          {busy ? (
            <LoaderCircleIcon
              className="animate-spin"
              data-icon="inline-start"
            />
          ) : (
            <CheckCircle2Icon data-icon="inline-start" />
          )}
          {confirmCooldownRemaining > 0
            ? `请等待 ${confirmCooldownRemaining} 秒`
            : directLogin
              ? '通过插件登录'
              : '我已修改'}
        </Button>
      </CardFooter>
    </>
  )
}

function RestoreCard({
  sign,
  mid,
  onRestore,
}: {
  sign: string
  mid: string
  onRestore: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>恢复原签名</CardTitle>
      </CardHeader>
      <CardContent>
        <CopyField value={sign} label="复制原签名" />
      </CardContent>
      <CardFooter className="flex-wrap gap-2 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => openBiliSettings(mid)}
        >
          <ExternalLinkIcon data-icon="inline-start" />
          打开B站个人空间
        </Button>
        <Button type="button" className="ml-auto" onClick={onRestore}>
          <RotateCcwIcon data-icon="inline-start" />
          我已恢复
        </Button>
      </CardFooter>
    </Card>
  )
}
