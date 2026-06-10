'use client'

import { useState } from 'react'
import Link from 'next/link'
import { login, forgotPassword } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError] = useState<string | null>(null)
  const [forgotSuccess, setForgotSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const result = await login(new FormData(e.currentTarget))
      if (result?.error) setError(result.error)
    } catch {
      setError('Une erreur inattendue est survenue.')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgot(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setForgotLoading(true)
    setForgotError(null)
    try {
      const result = await forgotPassword(new FormData(e.currentTarget))
      if (result?.error) {
        setForgotError(result.error)
      } else {
        setForgotSuccess(true)
      }
    } catch {
      setForgotError('Une erreur inattendue est survenue.')
    } finally {
      setForgotLoading(false)
    }
  }

  function openForgot() {
    setForgotOpen(true)
    setForgotError(null)
    setForgotSuccess(false)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Connexion</CardTitle>
          <CardDescription>Entrez vos identifiants pour accéder à votre compte</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Mot de passe</Label>
                <button
                  type="button"
                  onClick={openForgot}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <Input id="password" name="password" type="password" required autoComplete="current-password" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </Button>
          </form>
          <p className="text-sm text-center text-muted-foreground mt-4">
            Pas de compte ?{' '}
            <Link href="/register" className="text-primary hover:underline">Créer un compte</Link>
          </p>
        </CardContent>
      </Card>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-md overflow-y-auto max-h-[90dvh]">
          <DialogHeader>
            <DialogTitle>Mot de passe oublié</DialogTitle>
            <DialogDescription>
              Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
            </DialogDescription>
          </DialogHeader>

          {forgotSuccess ? (
            <div className="space-y-4">
              <p className="text-sm text-center text-muted-foreground">
                Un email de réinitialisation a été envoyé à votre adresse. Vérifiez votre boîte de réception.
              </p>
              <Button className="w-full" onClick={() => setForgotOpen(false)}>
                Fermer
              </Button>
            </div>
          ) : (
            <form onSubmit={handleForgot} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email</Label>
                <Input
                  id="forgot-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="exemple@email.com"
                />
              </div>
              {forgotError && <p className="text-sm text-destructive">{forgotError}</p>}
              <Button type="submit" className="w-full" disabled={forgotLoading}>
                {forgotLoading ? 'Envoi...' : 'Envoyer le lien'}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
