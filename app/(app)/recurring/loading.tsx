import { Skeleton } from '@/components/ui/skeleton'

export default function RecurringLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-40" />
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="rounded-xl border divide-y">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
