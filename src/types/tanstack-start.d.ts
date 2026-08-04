import type { Awaitable } from '@tanstack/router-core'

type StartServerHandlerContext = {
  request: Request
  params: Record<string, string>
  context: unknown
}

type StartServerHandler = (
  context: StartServerHandlerContext,
) => Awaitable<Response>

declare module '@tanstack/router-core' {
  interface UpdatableRouteOptionsExtensions {
    server?: {
      handlers?:
        | Record<string, StartServerHandler | undefined>
        | ((options: {
            createHandlers: (
              handlers: Record<string, StartServerHandler | undefined>,
            ) => Record<string, StartServerHandler | undefined>
          }) => Record<string, StartServerHandler | undefined>)
    }
  }
}
