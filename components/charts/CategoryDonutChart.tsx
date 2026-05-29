'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface DataPoint { name: string; value: number; color: string | null }

export function CategoryDonutChart({ data }: { data: DataPoint[] }) {
  return (
    <div className="rounded-xl border p-6">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4">Dépenses par catégorie</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={2}>
            {data.map((entry, i) => <Cell key={i} fill={entry.color ?? '#9CA3AF'} />)}
          </Pie>
          <Tooltip formatter={(v) => [`${Number(v).toFixed(2)} €`]} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
