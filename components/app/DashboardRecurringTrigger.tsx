'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function DashboardRecurringTrigger() {
  const router = useRouter()
  useEffect(() => {
    fetch('/api/recurring/generate', { method: 'POST' })
      .then(r => r.json())
      .then(({ generated }) => { if (generated > 0) router.refresh() })
      .catch(() => {})
  }, [router])
  return null
}
