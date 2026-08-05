import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { LoginPage } from '#/routes/login'
import { authFetch } from '#/lib/auth-client'

export const Route = createFileRoute('/admin/login')({
  component: AdminLogin,
})

function AdminLogin() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    void authFetch('/api/admin/init')
      .then(async (response) => {
        if (!response.ok) return
        const result = (await response.json()) as { initialized?: boolean }
        if (!result.initialized) await navigate({ to: '/init' })
      })
      .finally(() => setChecking(false))
  }, [navigate])

  if (checking) return null
  return <LoginPage adminMode />
}
