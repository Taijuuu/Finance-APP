'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const WEEKDAYS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'] // Monday-first

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

interface CalendarProps {
  value?: Date | null
  onSelect: (d: Date) => void
  /** 'day' picks a specific day; 'month' picks a whole month. */
  mode?: 'day' | 'month'
}

export function Calendar({ value, onSelect, mode = 'day' }: CalendarProps) {
  const today = new Date()
  const base = value ?? today
  const [view, setView] = React.useState<'days' | 'months' | 'years'>(mode === 'month' ? 'months' : 'days')
  const [cursor, setCursor] = React.useState(() => new Date(base.getFullYear(), base.getMonth(), 1))

  const year = cursor.getFullYear()
  const month = cursor.getMonth()

  const headBtn = 'rounded-md px-2 py-1 text-sm font-semibold hover:bg-primary/10 transition-colors'
  const arrowBtn = 'flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-foreground transition-colors'

  // ── Days view ──────────────────────────────────────────────────────
  function DaysView() {
    // Monday-first offset for the 1st of the month
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7
    const cells: Date[] = Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - firstDow + i))
    return (
      <>
        <div className="flex items-center justify-between mb-2">
          <button type="button" className={arrowBtn} onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Mois précédent"><ChevronLeft className="size-4" /></button>
          <div className="flex items-center gap-1">
            <button type="button" className={headBtn} onClick={() => setView('months')}>{MONTHS[month]}</button>
            <button type="button" className={headBtn} onClick={() => setView('years')}>{year}</button>
          </div>
          <button type="button" className={arrowBtn} onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Mois suivant"><ChevronRight className="size-4" /></button>
        </div>
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map(d => <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((d, i) => {
            const inMonth = d.getMonth() === month
            const isSelected = value ? sameDay(d, value) : false
            const isToday = sameDay(d, today)
            return (
              <button
                key={i}
                type="button"
                onClick={() => onSelect(d)}
                className={cn(
                  'h-8 w-full rounded-md text-sm transition-colors',
                  !inMonth && 'text-muted-foreground/40',
                  inMonth && !isSelected && 'hover:bg-primary/10',
                  isSelected && 'bg-primary text-primary-foreground font-semibold hover:bg-primary',
                  !isSelected && isToday && 'ring-1 ring-inset ring-primary/50 font-semibold',
                )}
              >
                {d.getDate()}
              </button>
            )
          })}
        </div>
      </>
    )
  }

  // ── Months view ────────────────────────────────────────────────────
  function MonthsView() {
    return (
      <>
        <div className="flex items-center justify-between mb-2">
          <button type="button" className={arrowBtn} onClick={() => setCursor(new Date(year - 1, month, 1))} aria-label="Année précédente"><ChevronLeft className="size-4" /></button>
          <button type="button" className={headBtn} onClick={() => setView('years')}>{year}</button>
          <button type="button" className={arrowBtn} onClick={() => setCursor(new Date(year + 1, month, 1))} aria-label="Année suivante"><ChevronRight className="size-4" /></button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {MONTHS_SHORT.map((m, i) => {
            const isSelected = value ? value.getFullYear() === year && value.getMonth() === i : false
            const isCurrent = today.getFullYear() === year && today.getMonth() === i
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  if (mode === 'month') { onSelect(new Date(year, i, 1)); return }
                  setCursor(new Date(year, i, 1)); setView('days')
                }}
                className={cn(
                  'h-9 rounded-md text-sm capitalize transition-colors hover:bg-primary/10',
                  isSelected && 'bg-primary text-primary-foreground font-semibold hover:bg-primary',
                  !isSelected && isCurrent && 'ring-1 ring-inset ring-primary/50 font-semibold',
                )}
              >
                {m}
              </button>
            )
          })}
        </div>
      </>
    )
  }

  // ── Years view ─────────────────────────────────────────────────────
  function YearsView() {
    const startYear = year - (year % 12)
    const years = Array.from({ length: 12 }, (_, i) => startYear + i)
    return (
      <>
        <div className="flex items-center justify-between mb-2">
          <button type="button" className={arrowBtn} onClick={() => setCursor(new Date(year - 12, month, 1))} aria-label="Décennie précédente"><ChevronLeft className="size-4" /></button>
          <span className="text-sm font-semibold">{startYear} – {startYear + 11}</span>
          <button type="button" className={arrowBtn} onClick={() => setCursor(new Date(year + 12, month, 1))} aria-label="Décennie suivante"><ChevronRight className="size-4" /></button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {years.map(y => {
            const isSelected = value ? value.getFullYear() === y : false
            const isCurrent = today.getFullYear() === y
            return (
              <button
                key={y}
                type="button"
                onClick={() => { setCursor(new Date(y, month, 1)); setView(mode === 'month' ? 'months' : 'months') }}
                className={cn(
                  'h-9 rounded-md text-sm transition-colors hover:bg-primary/10',
                  isSelected && 'bg-primary text-primary-foreground font-semibold hover:bg-primary',
                  !isSelected && isCurrent && 'ring-1 ring-inset ring-primary/50 font-semibold',
                )}
              >
                {y}
              </button>
            )
          })}
        </div>
      </>
    )
  }

  return (
    <div className="w-64 select-none">
      {view === 'days' && <DaysView />}
      {view === 'months' && <MonthsView />}
      {view === 'years' && <YearsView />}
    </div>
  )
}
