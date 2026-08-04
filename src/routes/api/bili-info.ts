import { BiliInfo } from 'better-auth-bili-basic/utils'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { mapBiliPublicInfo } from '#/lib/bili-public'

const requestSchema = z.object({
  mid: z.string().regex(/^\d+$/, 'MID 必须是非负十进制数字'),
})

export const Route = createFileRoute('/api/bili-info')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const body = requestSchema.parse(await request.json())
          const result = await BiliInfo(BigInt(body.mid))
          return Response.json(mapBiliPublicInfo(result))
        } catch (error) {
          const isValidationError = error instanceof z.ZodError
          const message = isValidationError
            ? error.issues.map((issue) => issue.message).join('; ')
            : error instanceof Error
              ? error.message
              : '无法获取 B 站用户信息'
          const status = isValidationError ? 400 : 502
          return Response.json({ error: message }, { status })
        }
      },
    },
  },
})
