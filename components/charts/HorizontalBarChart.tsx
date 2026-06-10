'use client'

import { formatCurrency } from '@/lib/utils'

interface DataPoint { name: string; value: number; color: string | null }

export function HorizontalBarChart({ data }: { data: DataPoint[] }) {
  const max = Math.max(...data.map(d => d.value), 1)
  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="text-sm font-semibold mb-0.5">Top dépenses</div>
      <div className="text-xs text-muted-foreground mb-5">Répartition du mois</div>
      <div className="space-y-4">
        {data.map((d, i) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0
          const barWidth = (d.value / max) * 100
          return (
            <div key={i}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium">{d.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{formatCurrency(d.value)}</span>
                  <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                </div>
              </div>
              <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${barWidth}%`, backgroundColor: d.color ?? '#9CA3AF' }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
