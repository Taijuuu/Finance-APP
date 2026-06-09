'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
        className="md:hidden fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-lg"
      >
        <Plus size={24} />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-full max-w-md overflow-y-auto max-h-[90dvh]">
          <DialogHeader><DialogTitle>Nouvelle transaction</DialogTitle></DialogHeader>
          <TransactionForm categories={categories} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  )
}
