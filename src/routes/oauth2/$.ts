import { createFileRoute } from '@tanstack/react-router'

import { auth } from '#/lib/auth'

export const Route = createFileRoute('/oauth2/$')({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => auth.handler(request),
      POST: ({ request }: { request: Request }) => auth.handler(request),
    },
  },
})
