import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

type DeviceQrCodeProps = {
  value: string
}

export function DeviceQrCode({ value }: DeviceQrCodeProps) {
  const [source, setSource] = useState('')

  useEffect(() => {
    let active = true
    setSource('')
    void QRCode.toDataURL(value, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 256,
    }).then((nextSource) => {
      if (active) setSource(nextSource)
    })

    return () => {
      active = false
    }
  }, [value])

  return (
    <div className="flex aspect-square w-full max-w-64 items-center justify-center bg-white p-3">
      {source ? (
        <img src={source} alt="设备登录二维码" className="size-full" />
      ) : (
        <div className="text-center text-xs text-muted-foreground">
          正在生成二维码
        </div>
      )}
    </div>
  )
}
