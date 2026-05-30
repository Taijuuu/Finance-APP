'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  year: number
  month: number
}

export function MonthNavigator({ year, month }: Props) {
  const router = useRouter()

  function navigate(offsetMonths: number) {
    const d = new Date(year, month - 1 + offsetMonths, 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    router.push(`/dashboard?month=${y}-${String(m).padStart(2, '0')}`)
  }

  const isAtHorizon = (() => {
    const horizon = new Date()
    horizon.setMonth(horizon.getMonth() + 12)
    return year > horizon.getFullYear() ||
      (year === horizon.getFullYear() && month >= horizon.getMonth() + 1)
  })()

  const label = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(-1)}>
        <ChevronLeft size={16} />
      </Button>
      <span className="text-sm text-muted-foreground min-w-[130px] text-center capitalize">{label}</span>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(1)} disabled={isAtHorizon}>
        <ChevronRight size={16} />
      </Button>
    </div>
  )
}
