'use client'

import { useState, useEffect } from 'react'
import { X, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function InstallBanner() {
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null)

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    if (standalone) return
    if (sessionStorage.getItem('pwa-dismissed')) return

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream
    if (ios) { setIsIOS(true); setShow(true); return }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    sessionStorage.setItem('pwa-dismissed', '1')
    setShow(false)
  }

  async function install() {
    if (!deferredPrompt) return
    const prompt = deferredPrompt as Event & { prompt: () => void; userChoice: Promise<void> }
    prompt.prompt()
    await prompt.userChoice
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-4 right-4 lg:left-auto lg:right-4 lg:w-80 z-50 rounded-xl border bg-background shadow-lg p-4">
      <div className="flex items-start gap-3">
        <Download size={18} className="text-primary mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Installer l'app</p>
          {isIOS ? (
            <p className="text-xs text-muted-foreground mt-1">
              Appuyez sur <strong>Partager</strong> puis <strong>Ajouter à l&apos;écran d&apos;accueil</strong>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">Accès rapide depuis votre écran d&apos;accueil</p>
          )}
          {!isIOS && (
            <Button size="sm" className="mt-2 h-7 text-xs" onClick={install}>Installer</Button>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={dismiss}><X size={13} /></Button>
      </div>
    </div>
  )
}
