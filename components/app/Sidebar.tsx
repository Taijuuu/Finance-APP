'use client'

import type { ElementType } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ArrowLeftRight, CalendarDays, Target, RefreshCw, Upload, User, Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { logout } from '@/app/actions/auth'

const primaryNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/recap', label: 'Récap mensuel', icon: CalendarDays },
  { href: '/budgets', label: 'Budgets', icon: Target },
]

const toolsNav = [
  { href: '/recurring', label: 'Récurrents', icon: RefreshCw },
  { href: '/import', label: 'Import', icon: Upload },
]

function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: ElementType }) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(href + '/')
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <Icon size={16} />
      {label}
    </Link>
  )
}

export function Sidebar() {
  const { theme, setTheme } = useTheme()
  return (
    <aside className="hidden lg:flex flex-col w-56 border-r bg-background h-screen fixed left-0 top-0 z-40">
      <div className="px-4 py-5 border-b">
        <Link href="/dashboard" className="text-sm font-bold tracking-widest uppercase text-foreground hover:text-primary transition-colors">FinanceApp</Link>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {primaryNav.map(item => <NavLink key={item.href} {...item} />)}
        <div className="pt-4">
          <p className="px-3 mb-1 text-[10px] uppercase tracking-widest text-muted-foreground/50 font-medium">Outils</p>
          {toolsNav.map(item => <NavLink key={item.href} {...item} />)}
        </div>
      </nav>
      <div className="px-3 py-4 border-t space-y-1">
        <NavLink href="/profile" label="Profil" icon={User} />
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-muted-foreground"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          <span className="text-sm font-medium">{theme === 'dark' ? 'Mode clair' : 'Mode sombre'}</span>
        </Button>
        <form action={logout}>
          <Button variant="ghost" size="sm" type="submit" className="w-full justify-start text-muted-foreground">
            Déconnexion
          </Button>
        </form>
      </div>
    </aside>
  )
}
