'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import { useTheme } from 'next-themes'

interface DataPoint { month: string; solde: number }

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  const v = payload[0]?.value ?? 0
  return (
    <div className="rounded-xl border border-border bg-card/95 backdrop-blur-sm p-3 shadow-xl text-sm">
      <p className="text-muted-foreground text-xs mb-1">{label}</p>
      <p className={`font-bold text-base ${v >= 0 ? 'text-primary' : 'text-rose-500'}`}>
        {v >= 0 ? '+' : ''}{Number(v).toFixed(2)} €
      </p>
    </div>
  )
}

export function BalanceLineChart({ data }: { data: DataPoint[] }) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const textColor = isDark ? '#8888AA' : '#6B7280'
  const gridColor = isDark ? '#2A2A3A' : '#E5E7EB'
  const lastValue = data[data.length - 1]?.solde ?? 0

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="text-sm font-semibold">Évolution du solde</div>
          <div className="text-xs text-muted-foreground">12 derniers mois</div>
        </div>
        <div className="text-right">
          <div className={`text-xl font-bold ${lastValue >= 0 ? 'text-primary' : 'text-rose-500'}`}>
            {lastValue >= 0 ? '+' : ''}{lastValue.toFixed(2)} €
          </div>
          <div className="text-xs text-muted-foreground">mois courant</div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradBalance" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6C63FF" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#6C63FF" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} tickFormatter={v => `${v}€`} width={52} />
          <ReferenceLine y={0} stroke="rgba(108,99,255,0.35)" strokeDasharray="4 4" label={{ value: '0 €', fill: 'rgba(108,99,255,0.5)', fontSize: 10, position: 'insideTopLeft' }} />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: 'rgba(108,99,255,0.3)', strokeWidth: 1 }}
            position={{ y: 0 }}
            allowEscapeViewBox={{ x: false, y: true }}
            wrapperStyle={{ zIndex: 50, pointerEvents: 'none' }}
          />
          <Area
            type="monotone"
            dataKey="solde"
            stroke="#6C63FF"
            strokeWidth={2.5}
            fill="url(#gradBalance)"
            dot={false}
            activeDot={{ r: 5, fill: '#6C63FF', stroke: 'rgba(108,99,255,0.3)', strokeWidth: 6 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
