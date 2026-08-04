export type BiliInfoResponse = {
  data: {
    card: {
      mid: string
      name: string
      face: string
      sign: string
      fans: number
      level_info: { current_level: number }
      vip: { type: number }
      spacesta: number
    }
  }
}

export type PublicBiliInfo = {
  mid: string
  name: string
  face: string
  sign: string
  fans: number
  level: number
  vip: number
  ban: boolean
}

export function isPublicBiliInfo(value: unknown): value is PublicBiliInfo {
  if (typeof value !== 'object' || value === null) return false
  const info = value as Record<string, unknown>
  return (
    typeof info.mid === 'string' &&
    typeof info.name === 'string' &&
    typeof info.face === 'string' &&
    typeof info.sign === 'string' &&
    typeof info.fans === 'number' &&
    typeof info.level === 'number' &&
    typeof info.vip === 'number' &&
    typeof info.ban === 'boolean'
  )
}

export function parseMid(value: string): bigint | null {
  if (!/^\d+$/.test(value)) return null
  return BigInt(value)
}

export function mapBiliPublicInfo(result: BiliInfoResponse): PublicBiliInfo {
  const card = result.data.card
  return {
    mid: card.mid,
    name: card.name,
    face: card.face,
    sign: card.sign,
    fans: card.fans,
    level: card.level_info.current_level,
    vip: card.vip.type,
    ban: card.spacesta === -2,
  }
}
