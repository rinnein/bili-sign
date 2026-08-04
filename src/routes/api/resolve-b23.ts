import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { resolveB23Text } from '#/lib/b23-resolver'

const requestSchema = z.object({ text: z.string().min(1).max(2000) })

export const Route = createFileRoute('/api/resolve-b23')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const body = requestSchema.parse(await request.json())
          return Response.json(await resolveB23Text(body.text))
        } catch (error) {
          const isValidationError = error instanceof z.ZodError
          const message = isValidationError
            ? error.issues.map((issue) => issue.message).join('; ')
            : error instanceof Error
              ? error.message
              : '无法解析 B 站短链接'
          return Response.json(
            { error: message },
            { status: isValidationError ? 400 : 502 },
          )
        }
      },
    },
  },
})
