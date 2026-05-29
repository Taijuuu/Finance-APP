import type { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight">FinanceApp</h1>
          <p className="text-sm text-muted-foreground mt-1">Gérez vos finances personnelles</p>
        </div>
        {children}
      </div>
    </div>
  )
}
