'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useTheme } from 'next-themes'

interface DataPoint { month: string; solde: number }

export function BalanceLineChart({ data }: { data: DataPoint[] }) {
  const { theme } = useTheme()
  const textColor = theme === 'dark' ? '#8888AA' : '#6B7280'
  return (
    <div className="rounded-xl border p-6">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4">Évolution du solde — 12 mois</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#2A2A3A' : '#E5E7EB'} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} tickFormatter={v => `${v}€`} />
          <Tooltip formatter={(v) => [`${Number(v).toFixed(2)} €`]} />
          <Line type="monotone" dataKey="solde" stroke="#4F46E5" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
