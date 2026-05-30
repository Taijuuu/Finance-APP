import type { ReactNode } from 'react'
import { Sidebar } from '@/components/app/Sidebar'
import { BottomNav } from '@/components/app/BottomNav'
import { MobileFab } from '@/components/app/MobileFab'
import { InstallBanner } from '@/components/app/InstallBanner'
import { PageTransition } from '@/components/app/PageTransition'
import { DashboardRecurringTrigger } from '@/components/app/DashboardRecurringTrigger'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <DashboardRecurringTrigger />
      <Sidebar />
      <main className="lg:pl-56 pb-16 lg:pb-0 min-h-screen">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <PageTransition>
            {children}
          </PageTransition>
        </div>
      </main>
      <BottomNav />
      <MobileFab />
      <InstallBanner />
    </div>
  )
}
