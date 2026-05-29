'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useTheme } from 'next-themes'

interface DataPoint { month: string; revenus: number; dépenses: number }

export function RevenueExpenseChart({ data }: { data: DataPoint[] }) {
  const { theme } = useTheme()
  const textColor = theme === 'dark' ? '#8888AA' : '#6B7280'
  return (
    <div className="rounded-xl border p-6">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4">Revenus vs Dépenses — 6 mois</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} barGap={4} barCategoryGap="30%">
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} tickFormatter={v => `${v}€`} />
          <Tooltip formatter={(v) => [`${Number(v).toFixed(2)} €`]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="revenus" fill="#10B981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="dépenses" fill="#EC4899" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
