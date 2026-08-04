import { ScanLineIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Button } from '#/components/ui/button'
import { extractDeviceUserCodeFromQr } from '#/lib/device-auth'

type DeviceCodeScannerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScanned: (userCode: string) => void
}

export function DeviceCodeScanner({
  open,
  onOpenChange,
  onScanned,
}: DeviceCodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return

    let cancelled = false
    let controls: { stop: () => void } | undefined
    setError('')

    async function startScanner() {
      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser')
        if (cancelled || !videoRef.current) return

        const reader = new BrowserQRCodeReader()
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } } },
          videoRef.current,
          (result) => {
            if (cancelled || !result) return
            const userCode = extractDeviceUserCodeFromQr(result.getText())
            if (!userCode) {
              setError('请扫描本网站生成的设备登录二维码。')
              return
            }
            cancelled = true
            controls?.stop()
            onScanned(userCode)
            onOpenChange(false)
          },
        )
      } catch {
        if (!cancelled) {
          setError('无法打开摄像头，请检查浏览器权限或改为手动输入。')
        }
      }
    }

    void startScanner()
    return () => {
      cancelled = true
      controls?.stop()
    }
  }, [onOpenChange, onScanned, open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>扫码登录</DialogTitle>
          <DialogDescription>
            对准其它设备显示的设备登录二维码。
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-hidden border bg-black">
          <video
            ref={videoRef}
            className="aspect-video w-full object-cover"
            autoPlay
            muted
            playsInline
          />
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ScanDeviceCodeButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="secondary" onClick={onClick}>
      <ScanLineIcon data-icon="inline-start" />
      扫码登录
    </Button>
  )
}
