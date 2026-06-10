'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ArrowLeftRight, CalendarDays, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const items = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/recap', label: 'Récap', icon: CalendarDays },
  { href: '/profile', label: 'Profil', icon: User },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t flex items-start pt-2"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
    >
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            prefetch={true}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors py-1',
              active ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <Icon size={20} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
