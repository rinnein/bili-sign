import { Turnstile } from '@marsidev/react-turnstile'

import { turnstileAction, turnstileEnabled } from '#/lib/turnstile-client'

export function TurnstileWidget({
  siteKey,
  onToken,
  onError,
}: {
  siteKey: string
  onToken: (token: string) => void
  onError: () => void
}) {
  if (!turnstileEnabled) return null

  return (
    <Turnstile
      siteKey={siteKey}
      className="min-h-[65px]"
      options={{
        action: turnstileAction,
        language: 'zh-CN',
        refreshExpired: 'auto',
      }}
      onSuccess={onToken}
      onExpire={() => onToken('')}
      onError={() => {
        onToken('')
        onError()
      }}
    />
  )
}
