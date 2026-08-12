import {
  ArrowRightIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  LoaderCircleIcon,
  RotateCcwIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

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
import { requestBiliApi } from '#/lib/bili-api-proxy'
import { useBiliVerification } from '#/features/bili-verification/use-bili-verification'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import {
  getEffectivePluginLoginMode,
  getPluginCapabilityLabels,
} from '#/lib/plugin-capabilities'
import { readPluginMid } from '#/lib/plugin-mid'
import { pluginBridge, usePluginBridge } from '#/lib/plugin-bridge'
import { cn } from '#/lib/utils'
import {
  getVerificationNextCooldownRemaining,
  startVerificationNextCooldown,
} from '#/lib/verification-next-cooldown'

export const Route = createFileRoute('/verify')({ component: Verify })

function Verify() {
  const { isPending, refetch } = authClient.useSession()
  const navigate = useNavigate()
  const pluginState = usePluginBridge()
  const [agreementChecked, setAgreementChecked] = useState(false)
  const [safetyOpen, setSafetyOpen] = useState(false)
  const [pendingNext, setPendingNext] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const [nextWaitRemaining, setNextWaitRemaining] = useState(() =>
    getVerificationNextCooldownRemaining(),
  )
  const requestedPluginMid = useRef(false)
  const errorRef = useRef<HTMLDivElement>(null)
  const flow = useBiliVerification({
    refetch,
    onSessionSwitched: navigateToDashboard,
  })

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
    if (requestedPluginMid.current || flow.mid || !pluginState.descriptor) {
      return
    }
    requestedPluginMid.current = true
    const capabilities = pluginState.descriptor.capabilities
    void readPluginMid({
      capabilities,
      readWithMid: () =>
        pluginBridge.request<{ mid: string }>('bili.mid.read', 'mid.get', {}),
      readWithProxy: () =>
        requestBiliApi({
          url: 'https://api.bilibili.com/x/web-interface/nav',
          method: 'GET',
        }),
    }).then((value) => {
      if (value) flow.setMid(value)
    })
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

  async function navigateToDashboard() {
    setIsNavigating(true)
    try {
      await navigate({ to: '/dashboard' })
      flow.clearCache()
    } catch (error) {
      setIsNavigating(false)
      throw error
    }
  }

  async function loginWithPlugin() {
    const success = await flow.loginWithPlugin()
    if (!success) return
    try {
      await navigateToDashboard()
    } catch {}
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

  const pluginLoginMode = getEffectivePluginLoginMode(
    pluginState.descriptor?.capabilities,
  )
  const directLogin = pluginLoginMode !== null
  const steps = directLogin
    ? ['账号', '插件登录']
    : ['账号', '签名验证', '完成']
  const currentStep = directLogin
    ? flow.challenge
      ? 2
      : 1
    : flow.challenge
      ? 2
      : flow.verificationCompleted
        ? 3
        : 1

  function goToStep(step: number) {
    if (flow.busy || step >= currentStep) return
    if (step === 1 || step === 2) flow.returnToAccount()
  }

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <nav aria-label="验证步骤" className="mb-8">
          <ol className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
            {steps.map((label, index) => {
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
                  {step < steps.length ? (
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
          <div className="mt-4 flex justify-center text-center text-xs text-muted-foreground">
            <span>已连接插件：</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="underline decoration-dotted underline-offset-4"
                  aria-label={`查看 ${pluginState.descriptor.name} 的启用能力`}
                >
                  {pluginState.descriptor.name}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" align="center" sideOffset={6}>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">已启用能力</span>
                  <ul className="list-disc pl-4">
                    {getPluginCapabilityLabels(
                      pluginState.descriptor.capabilities,
                    ).map((label) => (
                      <li key={label}>{label}</li>
                    ))}
                    <li>
                      当前 MID 来源：
                      {pluginState.descriptor.capabilities.includes(
                        'bili.mid.read',
                      )
                        ? '读取当前 B 站 MID'
                        : pluginState.descriptor.capabilities.includes(
                              'bili.api.proxy',
                            )
                          ? '代理 B 站当前会话'
                          : '手动输入'}
                    </li>
                    <li>
                      当前登录方式：
                      {pluginLoginMode === 'proxy'
                        ? '代理 B 站请求'
                        : pluginLoginMode === 'direct'
                          ? '快捷签名登录'
                          : '手动签名验证'}
                    </li>
                  </ul>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
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
              isNavigating={isNavigating}
              onConfirm={() => void confirmVerification()}
              onPluginLogin={() => void loginWithPlugin()}
            />
          </Card>
        )}
        {flow.info && flow.verificationCompleted && flow.originalSign && (
          <RestoreCard
            sign={flow.originalSign}
            mid={flow.info.mid}
            onRestore={() => {
              void navigateToDashboard().catch(() => {})
            }}
            isNavigating={isNavigating}
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
        {flow.continuationError && (
          <Alert variant="destructive" className="mt-6">
            <AlertTitle>OAuth 授权未继续</AlertTitle>
            <AlertDescription>{flow.continuationError}</AlertDescription>
          </Alert>
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
  isNavigating,
  onConfirm,
  onPluginLogin,
}: {
  challenge: string
  mid: string
  busy: boolean
  confirmCooldownRemaining: number
  directLogin: boolean | undefined
  pluginName?: string
  isNavigating: boolean
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
          disabled={busy || isNavigating || confirmCooldownRemaining > 0}
          onClick={directLogin ? onPluginLogin : onConfirm}
        >
          {busy || isNavigating ? (
            <LoaderCircleIcon
              className="animate-spin"
              data-icon="inline-start"
            />
          ) : (
            <CheckCircle2Icon data-icon="inline-start" />
          )}
          {confirmCooldownRemaining > 0
            ? `请等待 ${confirmCooldownRemaining} 秒`
            : isNavigating
              ? '跳转中…'
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
  isNavigating,
}: {
  sign: string
  mid: string
  onRestore: () => void
  isNavigating: boolean
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
        <Button
          type="button"
          className="ml-auto"
          disabled={isNavigating}
          onClick={onRestore}
        >
          {isNavigating ? (
            <LoaderCircleIcon
              className="animate-spin"
              data-icon="inline-start"
            />
          ) : (
            <RotateCcwIcon data-icon="inline-start" />
          )}
          {isNavigating ? '跳转中…' : '我已恢复'}
        </Button>
      </CardFooter>
    </Card>
  )
}
