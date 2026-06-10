'use client'

import * as React from 'react'
import { Calendar as CalendarIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

const pad = (n: number) => String(n).padStart(2, '0')

function parseValue(v?: string): Date | null {
  if (!v) return null
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(v)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, m[3] ? Number(m[3]) : 1)
}

interface DatePickerProps {
  value?: string
  onChange: (value: string) => void
  /** 'day' → yyyy-mm-dd, 'month' → yyyy-mm */
  mode?: 'day' | 'month'
  placeholder?: string
  id?: string
  className?: string
}

export function DatePicker({ value, onChange, mode = 'day', placeholder, id, className }: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const date = parseValue(value)

  const label = date
    ? mode === 'month'
      ? `${MONTHS[date.getMonth()]} ${date.getFullYear()}`
      : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : (placeholder ?? (mode === 'month' ? 'Choisir un mois' : 'Choisir une date'))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        type="button"
        className={cn(
          'flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground transition-all outline-none hover:border-primary/40 hover:bg-card/80 focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/20',
          !date && 'text-muted-foreground',
          className,
        )}
      >
        <span className="flex-1 truncate text-left capitalize">{label}</span>
        <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto">
        <Calendar
          mode={mode}
          value={date}
          onSelect={d => {
            onChange(mode === 'month'
              ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
              : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
