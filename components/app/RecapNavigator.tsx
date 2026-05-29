'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function RecapNavigator({ year, month }: { year: number; month: number }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function navigate(delta: number) {
    let m = month + delta
    let y = year
    if (m > 12) { m = 1; y++ }
    if (m < 1) { m = 12; y-- }
    const params = new URLSearchParams(searchParams.toString())
    params.set('year', String(y))
    params.set('month', String(m))
    router.push(`/recap?${params.toString()}`)
  }

  const label = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
  const isCurrentMonth = year === new Date().getFullYear() && month === new Date().getMonth() + 1

  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
        <ChevronLeft size={16} />
      </Button>
      <span className="text-sm font-medium min-w-32 text-center capitalize">{label}</span>
      <Button variant="outline" size="icon" className="h-8 w-8" disabled={isCurrentMonth} onClick={() => navigate(1)}>
        <ChevronRight size={16} />
      </Button>
    </div>
  )
}
