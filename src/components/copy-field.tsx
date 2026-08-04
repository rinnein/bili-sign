import { CheckIcon, CopyIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'

export function CopyField({
  value,
  label = '复制内容',
}: {
  value: string
  label?: string
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="flex min-w-0 items-center border border-input bg-muted/30 pl-3">
      <Input
        readOnly
        value={value}
        aria-label={label}
        className="border-0 px-0 font-mono"
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => void copy()}
          >
            {copied ? (
              <CheckIcon data-icon="inline-start" />
            ) : (
              <CopyIcon data-icon="inline-start" />
            )}
            <span className="sr-only">{copied ? '已复制' : label}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{copied ? '已复制' : label}</TooltipContent>
      </Tooltip>
    </div>
  )
}
