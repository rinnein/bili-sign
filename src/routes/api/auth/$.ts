import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/lib/auth'

function toRootAuthRequest(request: Request) {
  const url = new URL(request.url)
  url.pathname = url.pathname.replace(/^\/api\/auth(?=\/|$)/, '') || '/'
  return new Request(url, request)
}

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) =>
        auth.handler(toRootAuthRequest(request)),
      POST: ({ request }: { request: Request }) =>
        auth.handler(toRootAuthRequest(request)),
    },
  },
})
