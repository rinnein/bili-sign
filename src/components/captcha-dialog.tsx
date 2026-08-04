import { useEffect, useState } from 'react'
import { TurnstileWidget } from '#/components/turnstile-widget'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { turnstileEnabled, turnstileSiteKey } from '#/lib/turnstile-client'
import {
  cancelCaptchaPrompt,
  captchaRequiredEvent,
  completeCaptchaPrompt,
} from '#/lib/captcha-prompt'

export function CaptchaDialog() {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const handleRequired = () => {
      setError('')
      setOpen(true)
    }
    window.addEventListener(captchaRequiredEvent, handleRequired)
    return () =>
      window.removeEventListener(captchaRequiredEvent, handleRequired)
  }, [])

  if (!turnstileEnabled) return null

  function close(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) cancelCaptchaPrompt()
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>完成安全验证</DialogTitle>
          <DialogDescription>
            请完成验证，完成后会自动继续刚才的操作。
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-[90px] flex-col items-center gap-3">
          <TurnstileWidget
            siteKey={turnstileSiteKey}
            onToken={(token) => {
              if (completeCaptchaPrompt(token)) setOpen(false)
            }}
            onError={() => setError('安全验证暂时不可用，请重试。')}
          />
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
