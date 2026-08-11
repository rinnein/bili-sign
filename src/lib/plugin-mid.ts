import type { PluginCapability } from '#/lib/plugin-protocol'
import { parseBiliNavMid } from '#/lib/bili-api-proxy'

export async function readPluginMid({
  capabilities,
  readWithMid,
  readWithProxy,
}: {
  capabilities: ReadonlyArray<PluginCapability>
  readWithMid: () => Promise<unknown>
  readWithProxy: () => Promise<unknown>
}) {
  if (capabilities.includes('bili.mid.read')) {
    try {
      const result = await readWithMid()
      if (
        typeof result === 'object' &&
        result !== null &&
        typeof (result as { mid?: unknown }).mid === 'string' &&
        /^\d+$/.test((result as { mid: string }).mid)
      ) {
        return (result as { mid: string }).mid
      }
    } catch {
      // Fall through to the higher-level API proxy when mid.get is unavailable.
    }
  }

  if (capabilities.includes('bili.api.proxy')) {
    try {
      return parseBiliNavMid(await readWithProxy())
    } catch {
      // Keep the website's manual MID input available when both plugin paths fail.
    }
  }

  return null
}
