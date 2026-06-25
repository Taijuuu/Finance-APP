'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

interface DataPoint { name: string; value: number; color: string | null }

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { value: number; name: string; payload: DataPoint & { total: number } }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  const pct = d.payload.total > 0 ? Math.round((d.value / d.payload.total) * 100) : 0
  return (
    <div className="rounded-xl border border-border bg-card/95 backdrop-blur-sm p-3 shadow-xl text-sm min-w-[150px]">
      <p className="font-semibold mb-2" style={{ color: d.payload.color ?? '#9CA3AF' }}>{d.name}</p>
      <div className="flex justify-between gap-6"><span className="text-muted-foreground">Montant</span><span className="font-bold">{d.value.toFixed(2)} €</span></div>
      <div className="flex justify-between gap-6"><span className="text-muted-foreground">Part</span><span className="font-bold">{pct}%</span></div>
    </div>
  )
}

export function CategoryDonutChart({ data }: { data: DataPoint[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const enriched = data.map(d => ({ ...d, total }))

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="text-sm font-semibold mb-0.5">Dépenses par catégorie</div>
      <div className="text-xs text-muted-foreground mb-5">Mois courant · top 8</div>
      {data.length === 0 ? (
        <p className="text-center text-muted-foreground text-sm py-16">Aucune dépense ce mois</p>
      ) : (
        <div className="flex items-center gap-5">
          <div className="relative shrink-0" style={{ width: 180, height: 180 }}>
            <ResponsiveContainer width={180} height={180}>
              <PieChart>
                <Pie data={enriched} cx="50%" cy="50%" innerRadius={58} outerRadius={82} dataKey="value" paddingAngle={2}>
                  {enriched.map((entry, i) => <Cell key={i} fill={entry.color ?? '#9CA3AF'} />)}
                </Pie>
                <Tooltip
                  content={<CustomTooltip />}
                  allowEscapeViewBox={{ x: true, y: true }}
                  wrapperStyle={{ zIndex: 50, pointerEvents: 'none' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Total</span>
              <span className="text-base font-bold">{total.toFixed(0)} €</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-2.5 min-w-0">
            {data.slice(0, 7).map((d, i) => {
              const pct = total > 0 ? Math.round((d.value / total) * 100) : 0
              return (
                <div key={i} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.color ?? '#9CA3AF' }} />
                    <span className="text-xs truncate">{d.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold">{d.value.toFixed(0)} €</span>
                    <span className="text-[10px] text-muted-foreground w-7 text-right">{pct}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
