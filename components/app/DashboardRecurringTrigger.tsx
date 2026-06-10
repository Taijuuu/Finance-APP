'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function DashboardRecurringTrigger() {
  const router = useRouter()
  useEffect(() => {
    const key = 'recurring-checked'
    const last = localStorage.getItem(key)
    const today = new Date().toISOString().split('T')[0]
    if (last === today) return
    localStorage.setItem(key, today)
    fetch('/api/recurring/generate', { method: 'POST' })
      .then(r => r.json())
      .then(({ generated }) => { if (generated > 0) router.refresh() })
      .catch(() => {})
  }, [router])
  return null
}
