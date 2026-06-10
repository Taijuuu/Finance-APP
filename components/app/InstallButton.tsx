'use client'

import { useState, useEffect } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type BeforeInstallPromptEvent = Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> }

interface Props {
  variant?: 'sidebar' | 'card'
}

export function InstallButton({ variant = 'sidebar' }: Props) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [iosDialogOpen, setIosDialogOpen] = useState(false)
  const [isStandalone, setIsStandalone] = useState(true)

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    if (standalone) { setIsStandalone(true); return }
    setIsStandalone(false)

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream
    if (ios) { setIsIOS(true); return }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (isIOS) { setIosDialogOpen(true); return }
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setIsStandalone(true)
    setDeferredPrompt(null)
  }

  if (isStandalone || (!deferredPrompt && !isIOS)) return null

  if (variant === 'card') {
    return (
      <>
        <div className="rounded-xl border bg-card p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Download size={18} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Installer l'application</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isIOS ? 'Ajouter à l\'écran d\'accueil via Safari' : 'Accès rapide depuis votre écran d\'accueil'}
            </p>
          </div>
          <Button size="sm" onClick={handleInstall}>
            Installer
          </Button>
        </div>

        <Dialog open={iosDialogOpen} onOpenChange={setIosDialogOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Installer sur iPhone / iPad</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Pour ajouter l'app à votre écran d'accueil :</p>
              <ol className="space-y-3 list-none">
                <li className="flex items-start gap-3">
                  <span className="bg-primary/10 text-primary rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</span>
                  <span>Appuyez sur l'icône <strong>Partager</strong> <span className="text-base">⎙</span> en bas de Safari</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="bg-primary/10 text-primary rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</span>
                  <span>Faites défiler et appuyez sur <strong>« Sur l'écran d'accueil »</strong></span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="bg-primary/10 text-primary rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</span>
                  <span>Appuyez sur <strong>Ajouter</strong> en haut à droite</span>
                </li>
              </ol>
            </div>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-3 text-muted-foreground"
        onClick={handleInstall}
      >
        <Download size={16} />
        <span className="text-sm font-medium">Installer l'app</span>
      </Button>

      <Dialog open={iosDialogOpen} onOpenChange={setIosDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Installer sur iPhone / iPad</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Pour ajouter l'app à votre écran d'accueil :</p>
            <ol className="space-y-3 list-none">
              <li className="flex items-start gap-3">
                <span className="bg-primary/10 text-primary rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</span>
                <span>Appuyez sur l'icône <strong>Partager</strong> <span className="text-base">⎙</span> en bas de Safari</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="bg-primary/10 text-primary rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</span>
                <span>Faites défiler et appuyez sur <strong>« Sur l'écran d'accueil »</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="bg-primary/10 text-primary rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</span>
                <span>Appuyez sur <strong>Ajouter</strong> en haut à droite</span>
              </li>
            </ol>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
