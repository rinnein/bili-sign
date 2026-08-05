import { useEffect, useState } from 'react'

import { authClient, authFetch } from '#/lib/auth-client'
import type { BiliChallenge, BiliInfo } from '#/lib/bili-flow'
import {
  clearVerificationCache,
  friendlyVerificationError,
  getBiliInfo,
  isChallengeUsable,
  readVerificationCache,
  writeVerificationCache,
} from '#/lib/bili-flow'
import { readLastMid, rememberMid, resolveMidInput } from '#/lib/mid'
import { pluginBridge } from '#/lib/plugin-bridge'
import {
  getVerificationCooldownRemaining,
  startVerificationCooldown,
} from '#/lib/verification-cooldown'

type SessionData = NonNullable<ReturnType<typeof authClient.useSession>['data']>

export function useBiliVerification({
  session,
  refetch,
}: {
  session: SessionData | null | undefined
  refetch: () => Promise<unknown>
}) {
  const [mid, setMid] = useState(() => {
    const cache = readVerificationCache()
    return cache?.mid || readLastMid()
  })
  const [info, setInfo] = useState<BiliInfo | null>(null)
  const [challenge, setChallenge] = useState<BiliChallenge | null>(null)
  const [verificationCompleted, setVerificationCompleted] = useState(false)
  const [originalSign, setOriginalSign] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [signInFallback, setSignInFallback] = useState(false)
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
    setSignInFallback(cache.signInFallback)
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
    setNotice('')

    setBusy(true)
    try {
      const normalized = await resolveMidInput(mid)
      const targetMid = normalized.mid
      const cached = readVerificationCache()
      const cachedChallenge =
        cached?.mid === targetMid && isChallengeUsable(cached.challenge)
          ? cached.challenge
          : null
      if (targetMid !== cached?.mid) setSignInFallback(false)
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
        signInFallback: targetMid === cached?.mid ? undefined : false,
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

  async function confirmVerification() {
    if (!challenge || !mid) return false
    if (!beginConfirmation()) return false
    setBusy(true)
    setError('')
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
    let success = false
    let failure = ''
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await pluginBridge.request('bili.direct-login', 'direct-login.start', {
        flowId,
        mid,
        identifier: challenge.identifier,
        signInstruction: challenge.signInstruction,
      })
      success = await completeVerification()
      return success
    } catch (pluginError) {
      failure =
        pluginError instanceof Error ? pluginError.message : '插件登录失败'
      setError(friendlyVerificationError(pluginError, '插件登录失败'))
      return false
    } finally {
      pluginBridge.notify('direct-login.finish', flowId, {
        success,
        error: failure || undefined,
      })
      setBusy(false)
    }
  }

  async function completeVerification() {
    if (!challenge || !mid) return false
    const result = session?.user
      ? await authClient.biliBasic.link({
          mid,
          identifier: challenge.identifier,
        })
      : signInFallback
        ? await authClient.signIn.biliBasic({
            mid,
            identifier: challenge.identifier,
          })
        : await authClient.signUp.biliBasic({
            mid,
            identifier: challenge.identifier,
          })

    if (
      !session?.user &&
      !signInFallback &&
      result.error?.message?.toLowerCase().includes('already bound')
    ) {
      setSignInFallback(true)
      writeVerificationCache({ signInFallback: true })
      throw new Error('该 B 站账号已绑定，请等待冷却后重新验证登录。')
    }
    if (result.error) {
      throw new Error(result.error.message ?? '验证失败，请检查签名后重试')
    }

    await refetch()
    setChallenge(null)
    setSignInFallback(false)
    writeVerificationCache({
      challenge: null,
      completed: true,
      signInFallback: false,
    })
    setVerificationCompleted(true)
    setNotice('验证成功。请将下面缓存的原签名恢复到 B 站账号。')
    await continueOAuth()
    const returnTo = new URLSearchParams(window.location.search).get(
      'return_to',
    )
    if (returnTo?.startsWith('/') && !returnTo.startsWith('//')) {
      window.location.assign(returnTo)
    }
    return true
  }

  function returnToAccount() {
    writeVerificationCache({ completed: false })
    setInfo(null)
    setChallenge(null)
    setVerificationCompleted(false)
    setError('')
    setNotice('')
  }

  async function continueOAuth() {
    const oauthQuery = window.location.search.slice(1)
    if (!oauthQuery.includes('client_id=') || !oauthQuery.includes('sig='))
      return
    const response = await authFetch('/api/auth/oauth2/continue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ oauth_query: oauthQuery, created: true }),
    })
    const result = (await response.json()) as { redirect_uri?: string }
    if (response.ok && result.redirect_uri)
      window.location.assign(result.redirect_uri)
  }

  function clearCache() {
    clearVerificationCache()
    setInfo(null)
    setChallenge(null)
    setVerificationCompleted(false)
    setOriginalSign('')
    setMid('')
    setSignInFallback(false)
    setError('')
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
