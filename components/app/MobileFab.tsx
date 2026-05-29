'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { TransactionForm } from './TransactionForm'
import { getCategories } from '@/app/actions/categories'
import type { Database } from '@/types/database'

type Category = Database['public']['Tables']['categories']['Row']

export function MobileFab() {
  const [open, setOpen] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const fetched = useRef(false)

  useEffect(() => {
    if (open && !fetched.current) {
      fetched.current = true
      getCategories().then(setCategories)
    }
  }, [open])

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="icon"
        className="lg:hidden fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-lg"
      >
        <Plus size={24} />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>Nouvelle transaction</SheetTitle></SheetHeader>
          <div className="mt-6">
            <TransactionForm categories={categories} onSuccess={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
