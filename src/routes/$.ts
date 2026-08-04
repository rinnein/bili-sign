import { createFileRoute } from '@tanstack/react-router'

import { auth } from '#/lib/auth'

function handleRootMetadata(request: Request) {
  const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/'
  if (
    path !== '/.well-known/oauth-authorization-server' &&
    path !== '/.well-known/openid-configuration' &&
    path !== '/jwks'
  ) {
    return new Response('Not found', { status: 404 })
  }
  return auth.handler(request)
}

export const Route = createFileRoute('/$')({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => handleRootMetadata(request),
    },
  },
})
