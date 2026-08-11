import { useState } from 'react'

import { authClient } from '#/lib/auth-client'

export type DeviceSession = {
  session: {
    token: string
    userId: string
  }
  user: {
    id: string
    name: string
    image?: string | null
    role?: string | null
  }
}

export function useDeviceSessionSwitcher() {
  const [sessions, setSessions] = useState<Array<DeviceSession>>([])
  const [loading, setLoading] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState('')

  async function loadSessions() {
    setLoading(true)
    setError('')
    const result = await authClient.multiSession.listDeviceSessions()
    if (result.error) {
      setError('暂时无法读取已登录账户。')
      setSessions([])
    } else {
      setSessions(result.data)
    }
    setLoading(false)
  }

  async function switchSession(sessionToken: string) {
    setSwitching(true)
    setError('')
    const result = await authClient.multiSession.setActive({ sessionToken })
    if (result.error) {
      setError('切换账户失败，请重试。')
      setSwitching(false)
      return false
    }
    window.location.reload()
    return true
  }

  return {
    sessions,
    loading,
    switching,
    error,
    loadSessions,
    switchSession,
  }
}
