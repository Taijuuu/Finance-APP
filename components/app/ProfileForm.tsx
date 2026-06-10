'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { updateProfile } from '@/app/actions/profile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Database } from '@/types/database'

type Profile = Database['public']['Tables']['profiles']['Row']

const CURRENCIES = [{ value: 'EUR', label: '€ Euro' }, { value: 'USD', label: '$ Dollar' }, { value: 'GBP', label: '£ Livre' }, { value: 'CHF', label: 'CHF Franc suisse' }]

export function ProfileForm({ profile }: { profile: Profile | null }) {
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const fd = new FormData(e.currentTarget)
    const result = await updateProfile({ full_name: fd.get('full_name'), currency: fd.get('currency') })
    setSaving(false)
    if (result.error) toast.error(result.error)
    else toast.success('Profil mis à jour')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="full_name">Nom complet</Label>
          <Input id="full_name" name="full_name" defaultValue={profile?.full_name ?? ''} />
        </div>
        <div className="space-y-2">
          <Label>Devise</Label>
          <Select name="currency" defaultValue={profile?.currency ?? 'EUR'}>
            <SelectTrigger className="w-full"><SelectValue>{v => CURRENCIES.find(c => c.value === v)?.label ?? v}</SelectValue></SelectTrigger>
            <SelectContent>{CURRENCIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" disabled={saving}>{saving ? 'Sauvegarde...' : 'Sauvegarder'}</Button>
    </form>
  )
}
