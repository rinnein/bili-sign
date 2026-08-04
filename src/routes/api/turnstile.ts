import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import {
  isLocalDevelopmentRequest,
  turnstileServerEnabled,
  verifyTurnstileToken,
} from '#/lib/turnstile-server'

const requestSchema = z.object({
  token: z.string().min(1).max(4096),
})

export const Route = createFileRoute('/api/turnstile')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        if (!turnstileServerEnabled || isLocalDevelopmentRequest(request)) {
          return Response.json({ success: true, skipped: true })
        }

        let token: string
        try {
          token = requestSchema.parse(await request.json()).token
        } catch {
          return Response.json(
            { success: false, error: '安全验证信息无效，请重试。' },
            { status: 400 },
          )
        }

        try {
          const result = await verifyTurnstileToken(request, token)
          if (!result.configured) {
            return Response.json(
              { success: false, error: '安全验证服务尚未配置。' },
              { status: 503 },
            )
          }
          if (!result.success) {
            return Response.json(
              { success: false, error: '安全验证未通过，请重试。' },
              { status: 403 },
            )
          }

          return Response.json({ success: true })
        } catch {
          return Response.json(
            { success: false, error: '安全验证服务暂时不可用，请稍后重试。' },
            { status: 403 },
          )
        }
      },
    },
  },
})
