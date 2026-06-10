import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-44" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="rounded-xl border bg-card p-5 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border p-6 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-48 w-full" />
        </div>
        <div className="rounded-xl border p-6 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
      <div className="rounded-xl border p-6 space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-40 w-full" />
      </div>
      <div className="rounded-xl border">
        <div className="px-4 py-3 border-b">
          <Skeleton className="h-4 w-32" />
        </div>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 border-b last:border-0">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}
