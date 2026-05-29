'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useTheme } from 'next-themes'

interface DataPoint { name: string; value: number; color: string | null }

export function HorizontalBarChart({ data }: { data: DataPoint[] }) {
  const { theme } = useTheme()
  const textColor = theme === 'dark' ? '#8888AA' : '#6B7280'
  return (
    <div className="rounded-xl border p-6">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4">Top dépenses par catégorie</h3>
      <ResponsiveContainer width="100%" height={data.length * 40 + 20}>
        <BarChart data={data} layout="vertical" barCategoryGap="30%">
          <XAxis type="number" tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} tickFormatter={v => `${v}€`} />
          <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: textColor }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => [`${Number(v).toFixed(2)} €`]} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => <Cell key={i} fill={entry.color ?? '#9CA3AF'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
