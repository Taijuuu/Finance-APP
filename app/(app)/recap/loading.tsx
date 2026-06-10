import { Skeleton } from '@/components/ui/skeleton'

export default function RecapLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-9 w-52" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="rounded-xl border p-4 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-24" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border">
        <div className="px-4 py-3 border-b">
          <Skeleton className="h-4 w-40" />
        </div>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="px-4 py-3 border-b last:border-0 space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 w-16" />
            </div>
            <Skeleton className="h-1.5 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
