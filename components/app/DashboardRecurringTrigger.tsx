'use client'

import { useEffect } from 'react'

export function DashboardRecurringTrigger() {
  useEffect(() => {
    fetch('/api/recurring/generate', { method: 'POST' }).catch(() => {})
  }, [])
  return null
}
