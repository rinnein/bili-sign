import { ShieldCheckIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  hasAcknowledgedSafetyNotice,
  acknowledgeSafetyNotice,
} from '#/lib/safety-notice'

export function SafetyNoticeButton({ onOpen }: { onOpen: () => void }) {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onOpen}>
      <ShieldCheckIcon data-icon="inline-start" />
      安全须知
    </Button>
  )
}

export function SafetyDialog({
  open,
  onOpenChange,
  onAccepted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAccepted?: () => void
}) {
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (open) setChecked(hasAcknowledgedSafetyNotice())
  }, [open])

  function accept() {
    if (!checked) return
    acknowledgeSafetyNotice()
    onOpenChange(false)
    onAccepted?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>开始前请确认</DialogTitle>
          <DialogDescription>
            这是无需输入 B 站密码的账号验证服务。已连接插件可能使用其本地 B
            站登录态代理请求；网站不会接收或保存 B 站 Cookie、CSRF、access token
            或密码，但代理响应可能包含该登录态允许读取的资料。
          </DialogDescription>
        </DialogHeader>
        <Alert>
          <ShieldCheckIcon />
          <AlertTitle>临时修改个人签名</AlertTitle>
          <AlertDescription>
            原签名只会保存在当前浏览器标签页的 sessionStorage
            中，用于验证完成后的恢复提示。请不要在公共设备上使用，并在完成后恢复原签名。
          </AlertDescription>
        </Alert>
        <label className="flex items-start gap-3 text-sm leading-6">
          <Checkbox
            checked={checked}
            onCheckedChange={(value) => setChecked(value === true)}
          />
          <span>我已阅读并理解上述须知，同意继续使用验证流程。</span>
        </label>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            稍后再说
          </Button>
          <Button type="button" disabled={!checked} onClick={accept}>
            同意并继续
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
