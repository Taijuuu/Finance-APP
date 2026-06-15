'use client'

import { useState } from 'react'
import { writeFile } from 'xlsx'
import { toast } from 'sonner'
import { Download, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { buildTransactionsWorkbook, exportFilename, type ExportTx } from '@/lib/export-engine'

export function ExportButton({ variant = 'default', size = 'default', compact = false }: { variant?: 'default' | 'outline'; size?: 'default' | 'sm'; compact?: boolean }) {
  const [busy, setBusy] = useState(false)

  async function handleExport() {
    setBusy(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setBusy(false); return }

      const { data, error } = await supabase
        .from('transactions')
        .select('date, type, amount, description, is_recurring_instance, categories(name)')
        .eq('user_id', user.id)
        .order('date', { ascending: false })

      if (error) { toast.error(error.message); setBusy(false); return }
      const rows = (data ?? []) as unknown as ExportTx[]
      if (rows.length === 0) { toast.error('Aucune transaction à exporter'); setBusy(false); return }

      const wb = buildTransactionsWorkbook(rows)
      writeFile(wb, exportFilename())
      toast.success(`${rows.length} transactions exportées`)
    } catch {
      toast.error('Erreur lors de l\'export')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant={variant} size={size} onClick={handleExport} disabled={busy}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      <span className={compact ? 'hidden sm:inline' : undefined}>{busy ? 'Export...' : 'Exporter en Excel'}</span>
    </Button>
  )
}
