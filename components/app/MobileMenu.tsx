'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { SidebarNav } from './Sidebar'

export function MobileMenu() {
  const [open, setOpen] = useState(false)
  return (
    <header
      className="md:hidden sticky top-0 z-30 flex items-center justify-between h-14 px-4 border-b bg-background/95 supports-backdrop-filter:backdrop-blur"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <Link href="/dashboard" className="text-sm font-bold tracking-widest uppercase text-foreground">
        FinanceApp
      </Link>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Ouvrir le menu" />}>
          <Menu size={20} />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SidebarNav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  )
}
