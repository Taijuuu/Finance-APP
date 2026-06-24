import type { ReactNode } from 'react'
import { Sidebar } from '@/components/app/Sidebar'
import { MobileMenu } from '@/components/app/MobileMenu'
import { BottomNav } from '@/components/app/BottomNav'
import { MobileFab } from '@/components/app/MobileFab'
import { getProfile } from '@/app/actions/profile'
import { getUnpointedExpenseCount } from '@/app/actions/transactions'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const [profile, unpointedCount] = await Promise.all([getProfile(), getUnpointedExpenseCount()])
  const transactionsBadge = profile?.reconcile_expenses ? unpointedCount : 0

  return (
    <div className="min-h-screen bg-background">
      <Sidebar transactionsBadge={transactionsBadge} />
      <div className="md:pl-56 overflow-x-hidden">
        <MobileMenu transactionsBadge={transactionsBadge} />
        <main className="md:pb-0 min-h-screen" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 4rem)' }}>
          <div className="max-w-6xl mx-auto px-4 py-6 min-w-0">
            {children}
          </div>
        </main>
      </div>
      <BottomNav transactionsBadge={transactionsBadge} />
      <MobileFab />
    </div>
  )
}
