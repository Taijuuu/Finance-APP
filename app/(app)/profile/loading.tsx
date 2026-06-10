import { Skeleton } from '@/components/ui/skeleton'

export default function ProfileLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-8 w-24" />
      <div className="max-w-lg space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-9 w-full" /></div>
          <div className="space-y-2"><Skeleton className="h-4 w-16" /><Skeleton className="h-9 w-full" /></div>
        </div>
        <div className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-9 w-full" /></div>
        <Skeleton className="h-9 w-full" />
      </div>
      <Skeleton className="h-px w-full" />
      <div className="space-y-4">
        <Skeleton className="h-6 w-28" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1].map(i => (
            <div key={i} className="rounded-xl border divide-y">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
