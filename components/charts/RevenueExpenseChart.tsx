'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useTheme } from 'next-themes'

interface DataPoint { month: string; revenus: number; dépenses: number }

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  const rev = payload.find(p => p.dataKey === 'revenus')?.value ?? 0
  const exp = payload.find(p => p.dataKey === 'dépenses')?.value ?? 0
  const net = rev - exp
  return (
    <div className="rounded-xl border border-border bg-card/95 backdrop-blur-sm p-3 shadow-xl text-sm min-w-[160px]">
      <p className="font-semibold mb-2 text-foreground">{label}</p>
      <div className="flex justify-between gap-6"><span className="text-muted-foreground">Revenus</span><span className="font-semibold text-emerald-500">{rev.toFixed(2)} €</span></div>
      <div className="flex justify-between gap-6"><span className="text-muted-foreground">Dépenses</span><span className="font-semibold text-rose-500">{exp.toFixed(2)} €</span></div>
      <div className="border-t border-border mt-2 pt-2 flex justify-between gap-6">
        <span className="text-muted-foreground">Net</span>
        <span className={`font-bold ${net >= 0 ? 'text-primary' : 'text-rose-500'}`}>{net >= 0 ? '+' : ''}{net.toFixed(2)} €</span>
      </div>
    </div>
  )
}

export function RevenueExpenseChart({ data }: { data: DataPoint[] }) {
  const { resolvedTheme } = useTheme()
  const textColor = resolvedTheme === 'dark' ? '#8888AA' : '#6B7280'
  const currentIdx = data.length - 1

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="text-sm font-semibold mb-0.5">Revenus vs Dépenses</div>
      <div className="text-xs text-muted-foreground mb-5">6 derniers mois · mois courant en surbrillance</div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} barGap={3} barCategoryGap="25%">
          <defs>
            <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity={1} />
              <stop offset="100%" stopColor="#059669" stopOpacity={0.8} />
            </linearGradient>
            <linearGradient id="gradExp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F43F5E" stopOpacity={1} />
              <stop offset="100%" stopColor="#E11D48" stopOpacity={0.8} />
            </linearGradient>
          </defs>
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} tickFormatter={v => `${v}€`} width={52} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 4 }} />
          <Bar dataKey="revenus" fill="url(#gradRev)" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => <Cell key={i} opacity={i === currentIdx ? 1 : 0.45} />)}
          </Bar>
          <Bar dataKey="dépenses" fill="url(#gradExp)" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => <Cell key={i} opacity={i === currentIdx ? 1 : 0.45} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-sm inline-block bg-emerald-500" />Revenus
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-sm inline-block bg-rose-500" />Dépenses
        </div>
      </div>
    </div>
  )
}
