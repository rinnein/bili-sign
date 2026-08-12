import { useEffect, useRef, useState } from 'react'

import { authClient } from '#/lib/auth-client'
import type { BiliChallenge, BiliInfo } from '#/lib/bili-flow'
import {
  clearVerificationCache,
  friendlyVerificationError,
  getBiliInfo,
  isChallengeUsable,
  readVerificationCache,
  writeVerificationCache,
} from '#/lib/bili-flow'
import {
  isBiliApiSuccess,
  readBiliApiMessage,
  requestBiliApi,
} from '#/lib/bili-api-proxy'
import { readLastMid, rememberMid, resolveMidInput } from '#/lib/mid'
import { useOAuthContinuation } from '#/components/oauth-continuation-provider'
import { pluginBridge } from '#/lib/plugin-bridge'
import { getEffectivePluginLoginMode } from '#/lib/plugin-capabilities'
import {
  getVerificationCooldownRemaining,
  startVerificationCooldown,
} from '#/lib/verification-cooldown'

const SIGNATURE_PROPAGATION_ATTEMPTS = 6
const SIGNATURE_PROPAGATION_DELAY_MS = 500
const SIGNATURE_TIMEOUT_MS = 2 * 60_000

type ProxyPendingSignature = {
  mid: string
  sign: string
  restoring: boolean
  restoreTimer?: number
  restorePromise?: Promise<void>
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readProxyMid(value: unknown) {
  const root = asRecord(value)
  const data = asRecord(root?.data)
  if (
    !isBiliApiSuccess(value) ||
    data?.isLogin !== true ||
    (typeof data.mid !== 'string' && typeof data.mid !== 'number')
  ) {
    throw new Error(readBiliApiMessage(value) || '当前 B 站账号未登录')
  }
  return String(data.mid)
}

function readProxySign(value: unknown, expectedMid: string) {
  const root = asRecord(value)
  const data = asRecord(root?.data)
  const card = asRecord(data?.card)
  if (
    !isBiliApiSuccess(value) ||
    (typeof card?.mid !== 'string' && typeof card?.mid !== 'number') ||
    typeof card.sign !== 'string' ||
    String(card.mid) !== expectedMid
  ) {
    throw new Error(readBiliApiMessage(value) || 'B 站公开资料格式无效')
  }
  return card.sign
}

export function useBiliVerification({
  refetch,
  onSessionSwitched,
}: {
  refetch: () => Promise<unknown>
  onSessionSwitched?: () => Promise<void> | void
}) {
  const {
    beginOAuthContinuation,
    cancelOAuthContinuation,
    continueOAuthLogin,
  } = useOAuthContinuation()
  const [mid, setMid] = useState(() => {
    const cache = readVerificationCache()
    return cache?.mid || readLastMid()
  })
  const [info, setInfo] = useState<BiliInfo | null>(null)
  const [challenge, setChallenge] = useState<BiliChallenge | null>(null)
  const [verificationCompleted, setVerificationCompleted] = useState(false)
  const [originalSign, setOriginalSign] = useState('')
  const [error, setError] = useState('')
  const [continuationError, setContinuationError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const proxyPendingRef = useRef<ProxyPendingSignature | null>(null)
  const [confirmCooldownRemaining, setConfirmCooldownRemaining] = useState(() =>
    getVerificationCooldownRemaining(),
  )

  useEffect(() => {
    const updateCooldown = () =>
      setConfirmCooldownRemaining(getVerificationCooldownRemaining())

    updateCooldown()
    const interval = window.setInterval(updateCooldown, 1000)
    return () => window.clearInterval(interval)
  }, [])

  function beginConfirmation() {
    const currentRemaining = getVerificationCooldownRemaining()
    if (currentRemaining > 0) {
      setConfirmCooldownRemaining(currentRemaining)
      setError(`请等待 ${currentRemaining} 秒后再确认。`)
      return false
    }

    const until = startVerificationCooldown()
    setConfirmCooldownRemaining(Math.ceil((until - Date.now()) / 1000))
    return true
  }

  async function proxyRequest(
    url: string,
    method: 'GET' | 'POST',
    body?: string,
    csrf = false,
  ) {
    return requestBiliApi({ url, method, body, csrf })
  }

  async function readProxyProfile(targetMid: string) {
    return readProxySign(
      await proxyRequest(
        `https://api.bilibili.com/x/web-interface/card?mid=${encodeURIComponent(targetMid)}`,
        'GET',
      ),
      targetMid,
    )
  }

  async function updateProxySign(targetMid: string, sign: string) {
    const result = await proxyRequest(
      'https://api.bilibili.com/x/member/web/sign/update',
      'POST',
      `user_sign=${encodeURIComponent(sign)}`,
      true,
    )
    if (!isBiliApiSuccess(result)) {
      throw new Error(readBiliApiMessage(result) || '更新 B 站签名失败')
    }
    return targetMid
  }

  async function waitForProxySignature(
    targetMid: string,
    expected: string,
    exact: boolean,
  ) {
    let lastError: unknown
    for (
      let attempt = 0;
      attempt < SIGNATURE_PROPAGATION_ATTEMPTS;
      attempt += 1
    ) {
      try {
        const sign = await readProxyProfile(targetMid)
        if (exact ? sign === expected : sign.includes(expected)) return
      } catch (signatureError) {
        lastError = signatureError
      }
      await new Promise((resolve) =>
        window.setTimeout(resolve, SIGNATURE_PROPAGATION_DELAY_MS),
      )
    }
    if (lastError instanceof Error) throw lastError
    throw new Error('B 站签名更新后未检测到验证码')
  }

  async function restoreProxySignature() {
    const pending = proxyPendingRef.current
    if (!pending) return
    if (pending.restorePromise) return pending.restorePromise
    pending.restoring = true
    if (pending.restoreTimer !== undefined) {
      window.clearTimeout(pending.restoreTimer)
      pending.restoreTimer = undefined
    }
    const restorePromise = (async () => {
      try {
        await updateProxySign(pending.mid, pending.sign)
        await waitForProxySignature(pending.mid, pending.sign, true)
        proxyPendingRef.current = null
      } catch (restoreError) {
        pending.restoring = false
        pending.restorePromise = undefined
        pending.restoreTimer = window.setTimeout(() => {
          void restoreProxySignature().catch(() => {})
        }, SIGNATURE_PROPAGATION_DELAY_MS)
        throw restoreError
      }
    })()
    pending.restorePromise = restorePromise
    return restorePromise
  }

  async function startProxySignature(
    targetMid: string,
    signInstruction: string,
  ) {
    const currentMid = readProxyMid(
      await proxyRequest('https://api.bilibili.com/x/web-interface/nav', 'GET'),
    )
    if (currentMid !== targetMid) {
      throw new Error('插件当前 B 站账号与验证账号不一致')
    }
    const savedSign = await readProxyProfile(targetMid)
    const pending: ProxyPendingSignature = {
      mid: targetMid,
      sign: savedSign,
      restoring: false,
    }
    proxyPendingRef.current = pending
    pending.restoreTimer = window.setTimeout(() => {
      void restoreProxySignature().catch(() => {})
    }, SIGNATURE_TIMEOUT_MS)
    try {
      await updateProxySign(targetMid, signInstruction)
      await waitForProxySignature(targetMid, signInstruction, false)
      return savedSign
    } catch (proxyError) {
      try {
        await restoreProxySignature()
      } catch {
        // Keep the pending state and retry timer for a later recovery attempt.
      }
      throw proxyError
    }
  }

  useEffect(() => {
    const handlePageHide = () => {
      void restoreProxySignature().catch(() => {})
    }
    window.addEventListener('pagehide', handlePageHide)
    return () => window.removeEventListener('pagehide', handlePageHide)
  })

  useEffect(() => {
    const cache = readVerificationCache()
    if (!cache) return
    const cachedChallenge = isChallengeUsable(cache.challenge)
      ? cache.challenge
      : null
    setOriginalSign(cache.sign)
    setMid(cache.mid || readLastMid())
    setChallenge(cachedChallenge)
    setVerificationCompleted(cache.completed)
    if (cache.challenge && !cachedChallenge) {
      writeVerificationCache({ challenge: null })
    }
    if (cache.mid)
      void getBiliInfo(cache.mid)
        .then(setInfo)
        .catch(() => {})
  }, [])

  async function lookup() {
    setError('')
    setContinuationError('')
    setNotice('')

    setBusy(true)
    try {
      const normalized = await resolveMidInput(mid)
      const targetMid = normalized.mid
      if (await switchToMatchingSession(targetMid)) {
        await onSessionSwitched?.()
        return true
      }
      const cached = readVerificationCache()
      const cachedChallenge =
        cached?.mid === targetMid && isChallengeUsable(cached.challenge)
          ? cached.challenge
          : null
      setMid(targetMid)
      const result = await getBiliInfo(targetMid)
      const reusableChallenge = isChallengeUsable(cachedChallenge)
      const preservedSign =
        targetMid === cached?.mid
          ? cached.sign || originalSign || result.sign
          : result.sign
      setInfo(result)
      setOriginalSign(preservedSign)
      rememberMid(targetMid)
      writeVerificationCache({
        sign: preservedSign,
        mid: targetMid,
        challenge: reusableChallenge ? undefined : null,
        completed: false,
        signInFallback: false,
      })
      setChallenge(reusableChallenge ? cachedChallenge : null)
      setVerificationCompleted(false)

      if (reusableChallenge) {
        return true
      }

      const sent = (await authClient.biliBasic.send({
        mid: targetMid,
      })) as unknown as {
        data: { data: BiliChallenge } | null
        error: { message?: string } | null
      }
      if (sent.error || !sent.data) {
        throw new Error(sent.error?.message ?? '验证码生成失败')
      }

      setChallenge(sent.data.data)
      writeVerificationCache({ challenge: sent.data.data })
      return true
    } catch (lookupError) {
      setError(friendlyVerificationError(lookupError, '查询失败，请稍后重试'))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function switchToMatchingSession(targetMid: string) {
    try {
      const sessionsResult = await authClient.multiSession.listDeviceSessions()
      if (sessionsResult.error) return false

      for (const deviceSession of sessionsResult.data) {
        const accountsResponse = await authClient.listAccounts({
          fetchOptions: {
            headers: {
              Authorization: `Bearer ${deviceSession.session.token}`,
            },
          },
        })
        if (accountsResponse.error) continue

        const accounts = accountsResponse.data as unknown
        const matched =
          Array.isArray(accounts) &&
          accounts.some((account) => {
            if (!account || typeof account !== 'object') return false
            const value = account as Record<string, unknown>
            return (
              value.providerId === 'bili-basic' && value.accountId === targetMid
            )
          })
        if (!matched) continue

        const switched = await authClient.multiSession.setActive({
          sessionToken: deviceSession.session.token,
        })
        if (switched.error) return false
        await refetch()
        return true
      }
    } catch {
      return false
    }
    return false
  }

  async function confirmVerification() {
    if (!challenge || !mid) return false
    if (!beginConfirmation()) return false
    setBusy(true)
    setError('')
    setContinuationError('')
    setNotice('')
    try {
      return await completeVerification()
    } catch (confirmError) {
      setError(friendlyVerificationError(confirmError))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function loginWithPlugin() {
    if (!challenge || !mid) return false
    if (!beginConfirmation()) return false
    let flowId: string
    try {
      flowId = globalThis.crypto.randomUUID()
    } catch {
      flowId = Math.random().toString(36).slice(2)
    }
    const loginMode = getEffectivePluginLoginMode(
      pluginBridge.getState().descriptor?.capabilities,
    )
    if (!loginMode) {
      setError('未检测到可用的插件登录能力')
      return false
    }
    let success = false
    let failure = ''
    let directLoginStarted = false
    let directLoginFinished = false
    setBusy(true)
    setError('')
    setContinuationError('')
    setNotice('')
    try {
      if (loginMode === 'proxy') {
        await startProxySignature(mid, challenge.signInstruction)
      } else {
        await pluginBridge.request('bili.direct-login', 'direct-login.start', {
          flowId,
          mid,
          identifier: challenge.identifier,
          signInstruction: challenge.signInstruction,
        })
        directLoginStarted = true
      }
      success = await completePluginVerification()
      if (loginMode === 'proxy') {
        await restoreProxySignature()
      } else {
        await finishDirectLogin(flowId, true)
        directLoginFinished = true
      }
      try {
        await continueOAuthLogin()
      } catch (continuationFailure) {
        setContinuationError(
          continuationFailure instanceof Error
            ? continuationFailure.message
            : '验证已完成，但无法继续 OAuth 授权。',
        )
      }
      return success
    } catch (pluginError) {
      failure =
        pluginError instanceof Error ? pluginError.message : '插件登录失败'
      if (
        loginMode === 'proxy' &&
        !proxyPendingRef.current &&
        pluginBridge.hasCapability('bili.direct-login')
      ) {
        try {
          await pluginBridge.request(
            'bili.direct-login',
            'direct-login.start',
            {
              flowId,
              mid,
              identifier: challenge.identifier,
              signInstruction: challenge.signInstruction,
            },
          )
          directLoginStarted = true
          success = await completePluginVerification()
          await finishDirectLogin(flowId, true)
          directLoginFinished = true
          try {
            await continueOAuthLogin()
          } catch (continuationFailure) {
            setContinuationError(
              continuationFailure instanceof Error
                ? continuationFailure.message
                : '验证已完成，但无法继续 OAuth 授权。',
            )
          }
          return success
        } catch (fallbackError) {
          failure =
            fallbackError instanceof Error
              ? fallbackError.message
              : '插件登录失败'
        }
      }
      if (loginMode === 'proxy' && proxyPendingRef.current) {
        try {
          await restoreProxySignature()
        } catch (restoreError) {
          failure = `${failure}；原签名恢复失败：${
            restoreError instanceof Error ? restoreError.message : '请稍后重试'
          }`
        }
      }
      if (directLoginStarted && !directLoginFinished) {
        try {
          await finishDirectLogin(flowId, false, failure)
          directLoginFinished = true
        } catch (restoreError) {
          failure = `${failure}；原签名恢复失败：${
            restoreError instanceof Error ? restoreError.message : '请稍后重试'
          }`
        }
      }
      setError(friendlyVerificationError(new Error(failure), '插件登录失败'))
      return false
    } finally {
      if (directLoginStarted && !directLoginFinished) {
        pluginBridge.notify('direct-login.finish', flowId, {
          success,
          error: failure || undefined,
        })
      }
      setBusy(false)
    }
  }

  async function finishDirectLogin(
    flowId: string,
    success: boolean,
    failureMessage?: string,
  ) {
    const result = await pluginBridge.request<{ restored: boolean }>(
      'bili.direct-login',
      'direct-login.finish',
      { flowId, success, error: failureMessage || undefined },
    )
    if (result.restored !== true) {
      throw new Error('插件未确认 B 站原签名已恢复')
    }
  }

  async function completePluginVerification() {
    if (!challenge || !mid) return false
    const result = await authClient.signIn.biliBasic({
      mid,
      identifier: challenge.identifier,
    })

    if (result.error) {
      throw new Error(result.error.message ?? '验证失败，请检查签名后重试')
    }

    const oauthPending = beginOAuthContinuation()
    try {
      await refetch()
    } catch (refetchError) {
      if (oauthPending) cancelOAuthContinuation()
      throw refetchError
    }
    setChallenge(null)
    writeVerificationCache({
      challenge: null,
      completed: false,
      signInFallback: false,
    })
    return true
  }

  async function completeVerification() {
    if (!challenge || !mid) return false
    const result = await authClient.signIn.biliBasic({
      mid,
      identifier: challenge.identifier,
    })

    if (result.error) {
      throw new Error(result.error.message ?? '验证失败，请检查签名后重试')
    }

    const oauthPending = beginOAuthContinuation()
    try {
      await refetch()
    } catch (refetchError) {
      if (oauthPending) cancelOAuthContinuation()
      throw refetchError
    }
    setChallenge(null)
    writeVerificationCache({
      challenge: null,
      completed: true,
      signInFallback: false,
    })
    setVerificationCompleted(true)
    setNotice('验证已完成。请先恢复 B 站原签名，再点击上方的“我已恢复”。')
    try {
      await continueOAuthLogin()
    } catch (continuationFailure) {
      setContinuationError(
        continuationFailure instanceof Error
          ? continuationFailure.message
          : '验证已完成，但无法继续 OAuth 授权。',
      )
    }
    return true
  }

  function returnToAccount() {
    writeVerificationCache({ completed: false })
    setInfo(null)
    setChallenge(null)
    setVerificationCompleted(false)
    setError('')
    setContinuationError('')
    setNotice('')
  }

  function clearCache() {
    clearVerificationCache()
    setInfo(null)
    setChallenge(null)
    setVerificationCompleted(false)
    setOriginalSign('')
    setMid('')
    setError('')
    setContinuationError('')
    setNotice('')
  }

  return {
    mid,
    setMid,
    info,
    challenge,
    verificationCompleted,
    originalSign,
    error,
    continuationError,
    notice,
    busy,
    confirmCooldownRemaining,
    lookup,
    confirmVerification,
    returnToAccount,
    loginWithPlugin,
    clearCache,
  }
}
