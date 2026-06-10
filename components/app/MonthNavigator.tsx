'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const MONTHS_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

interface Props {
  year: number
  month: number
}

export function MonthNavigator({ year, month }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(year)

  const now = new Date()
  const horizon = new Date(now.getFullYear(), now.getMonth() + 12, 1)

  function isBeyondHorizon(y: number, m: number) {
    return new Date(y, m - 1, 1) > horizon
  }

  function navigate(offsetMonths: number) {
    const d = new Date(year, month - 1 + offsetMonths, 1)
    push(d.getFullYear(), d.getMonth() + 1)
  }

  function push(y: number, m: number) {
    router.push(`${pathname}?month=${y}-${String(m).padStart(2, '0')}`)
  }

  function selectMonth(m: number) {
    if (isBeyondHorizon(pickerYear, m)) return
    push(pickerYear, m)
    setOpen(false)
  }

  const label = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1, 1))

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(-1)}>
        <ChevronLeft size={16} />
      </Button>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button className="text-sm text-muted-foreground min-w-[130px] text-center capitalize px-2 py-1 rounded-md hover:bg-muted transition-colors" />
          }
        >
          {label}
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" side="bottom" align="center">
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPickerYear(y => y - 1)}>
              <ChevronLeft size={14} />
            </Button>
            <span className="text-sm font-semibold">{pickerYear}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={isBeyondHorizon(pickerYear + 1, 1)}
              onClick={() => setPickerYear(y => y + 1)}
            >
              <ChevronRight size={14} />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTHS_SHORT.map((name, i) => {
              const m = i + 1
              const isSelected = pickerYear === year && m === month
              const disabled = isBeyondHorizon(pickerYear, m)
              return (
                <button
                  key={m}
                  disabled={disabled}
                  onClick={() => selectMonth(m)}
                  className={`rounded-md py-1.5 text-xs font-medium transition-colors
                    ${isSelected ? 'bg-primary text-primary-foreground' : ''}
                    ${!isSelected && !disabled ? 'hover:bg-muted' : ''}
                    ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  {name}
                </button>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        disabled={isBeyondHorizon(year, month + 1)}
        onClick={() => navigate(1)}
      >
        <ChevronRight size={16} />
      </Button>
    </div>
  )
}
