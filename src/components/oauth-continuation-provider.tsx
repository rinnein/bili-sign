import { LoaderCircleIcon } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'
import {
  continueOAuthLogin,
  inspectOAuthContinuation,
} from '#/lib/oauth-continuation'

type OAuthContinuationContextValue = {
  beginOAuthContinuation: (oauthQuery?: string) => boolean
  cancelOAuthContinuation: () => void
  continueOAuthLogin: (oauthQuery?: string) => Promise<boolean>
}

const OAuthContinuationContext =
  createContext<OAuthContinuationContextValue | null>(null)

export function OAuthContinuationProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [pending, setPending] = useState(false)
  const beginOAuthContinuation = useCallback((oauthQuery?: string) => {
    const continuation = inspectOAuthContinuation(
      oauthQuery ?? window.location.search,
    )
    if (continuation.kind !== 'valid') return false
    setPending(true)
    return true
  }, [])
  const cancelOAuthContinuation = useCallback(() => setPending(false), [])
  const continueWithPending = useCallback(async (oauthQuery?: string) => {
    return continueOAuthLogin(oauthQuery, {
      onPending: () => setPending(true),
      onFailure: () => setPending(false),
    })
  }, [])
  const value = useMemo(
    () => ({
      beginOAuthContinuation,
      cancelOAuthContinuation,
      continueOAuthLogin: continueWithPending,
    }),
    [beginOAuthContinuation, cancelOAuthContinuation, continueWithPending],
  )

  return (
    <OAuthContinuationContext.Provider value={value}>
      {children}
      <AlertDialog open={pending}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <LoaderCircleIcon className="animate-spin" />
            <AlertDialogTitle>正在继续 OAuth 授权</AlertDialogTitle>
            <AlertDialogDescription>
              正在跳转回第三方应用，请勿关闭或操作当前页面。
            </AlertDialogDescription>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>
    </OAuthContinuationContext.Provider>
  )
}

export function useOAuthContinuation() {
  const context = useContext(OAuthContinuationContext)
  if (!context) {
    throw new Error(
      'useOAuthContinuation 必须在 OAuthContinuationProvider 内使用',
    )
  }
  return context
}
