import type { ReactNode } from 'react'
import { Sidebar } from '@/components/app/Sidebar'
import { BottomNav } from '@/components/app/BottomNav'
import { MobileFab } from '@/components/app/MobileFab'
import { InstallBanner } from '@/components/app/InstallBanner'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="md:pl-56 md:pb-0 min-h-screen" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 4rem)' }}>
        <div className="max-w-6xl mx-auto px-4 py-6">
          {children}
        </div>
      </main>
      <BottomNav />
      <MobileFab />
    </div>
  )
}
