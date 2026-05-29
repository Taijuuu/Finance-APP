# Finance App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete personal finance PWA with auth, transaction tracking, recurring transactions, monthly recap, budgets, and Excel/CSV import.

**Architecture:** Next.js 15 App Router with hybrid Server/Client Components. Server Components fetch data server-side via `@supabase/ssr`. Client Components handle forms (React Hook Form), charts (Recharts), and interactive UI. Mutations via Server Actions.

**Tech Stack:** Next.js 15, TypeScript strict, Tailwind CSS 4, shadcn/ui (zinc), Supabase (PostgreSQL + Auth + RLS), Recharts, React Hook Form + Zod, SheetJS, Lucide React, Framer Motion, sonner, next-themes, @ducanh2912/next-pwa

**Spec:** `docs/superpowers/specs/2026-05-29-finance-app-design.md`

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `.env.local`, `vitest.config.ts`

- [ ] **Step 1: Bootstrap Next.js 15 app**

Run in `C:\Users\FRGLUTID\Documents\`:
```bash
npx create-next-app@latest finance-app --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
cd finance-app
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr next-themes sonner recharts react-hook-form @hookform/resolvers zod xlsx lucide-react framer-motion @ducanh2912/next-pwa
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Init shadcn/ui**

```bash
npx shadcn@latest init
```
When prompted: style=`default`, base color=`zinc`, CSS variables=`yes`.

Then add components:
```bash
npx shadcn@latest add button card sheet dialog alert-dialog badge progress separator skeleton popover select input label textarea tabs avatar dropdown-menu
```

- [ ] **Step 4: Create `.env.local`**

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Replace values from your Supabase project dashboard → Settings → API.

- [ ] **Step 5: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 6: Create `vitest.setup.ts`**

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 7: Add test script to `package.json`**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 8: Verify scaffold**

```bash
npm run dev
```
Expected: app loads at `http://localhost:3000`. Stop dev server.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 15 app with shadcn/ui and dependencies"
```

---

## Task 2: Database migration

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/001_initial_schema.sql`:

```sql
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  currency TEXT DEFAULT 'EUR',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories (before transactions — transactions FK depends on categories)
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon_name TEXT,
  color TEXT,
  type TEXT CHECK (type IN ('expense', 'income', 'both')) DEFAULT 'both',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recurring transactions (before transactions — transactions FK depends on this)
CREATE TABLE public.recurring_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  type TEXT CHECK (type IN ('expense', 'income')) NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  frequency TEXT CHECK (frequency IN ('weekly', 'monthly', 'yearly')) NOT NULL,
  start_date DATE NOT NULL,
  last_generated DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions (after recurring_transactions)
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  type TEXT CHECK (type IN ('expense', 'income')) NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  description TEXT,
  date DATE NOT NULL,
  is_recurring_instance BOOLEAN DEFAULT false,
  recurring_id UUID REFERENCES public.recurring_transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Budgets
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  month INT CHECK (month BETWEEN 1 AND 12) NOT NULL,
  year INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category_id, month, year)
);

-- Indexes
CREATE INDEX idx_transactions_user_date ON public.transactions(user_id, date DESC);
CREATE INDEX idx_transactions_user_month ON public.transactions(user_id, date_trunc('month', date));
CREATE INDEX idx_recurring_active ON public.recurring_transactions(user_id, is_active, last_generated);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profiles" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users manage own categories" ON public.categories FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own transactions" ON public.transactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own recurring" ON public.recurring_transactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own budgets" ON public.budgets FOR ALL USING (auth.uid() = user_id);

-- Handle new user: create profile + seed categories
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');

  INSERT INTO public.categories (user_id, name, icon_name, color, type, is_default) VALUES
  (NEW.id, 'Logement',             'home',           '#6366F1', 'expense', true),
  (NEW.id, 'Alimentation',         'shopping-cart',  '#10B981', 'expense', true),
  (NEW.id, 'Transport',            'car',            '#F59E0B', 'expense', true),
  (NEW.id, 'Santé',                'heart-pulse',    '#EF4444', 'expense', true),
  (NEW.id, 'Loisirs',              'clapperboard',   '#8B5CF6', 'expense', true),
  (NEW.id, 'Restaurants & Bars',   'utensils',       '#F97316', 'expense', true),
  (NEW.id, 'Vêtements & Shopping', 'shirt',          '#EC4899', 'expense', true),
  (NEW.id, 'Abonnements',          'smartphone',     '#14B8A6', 'expense', true),
  (NEW.id, 'Sport & Bien-être',    'dumbbell',       '#84CC16', 'expense', true),
  (NEW.id, 'Éducation',            'graduation-cap', '#0EA5E9', 'expense', true),
  (NEW.id, 'Voyages & Vacances',   'plane',          '#06B6D4', 'expense', true),
  (NEW.id, 'Banque & Assurances',  'landmark',       '#64748B', 'expense', true),
  (NEW.id, 'Animaux',              'paw-print',      '#A78BFA', 'expense', true),
  (NEW.id, 'Cadeaux & Dons',       'gift',           '#F43F5E', 'expense', true),
  (NEW.id, 'Maison & Bricolage',   'wrench',         '#78716C', 'expense', true),
  (NEW.id, 'Autre dépense',        'circle-help',    '#9CA3AF', 'expense', true),
  (NEW.id, 'Salaire',              'briefcase',      '#10B981', 'income',  true),
  (NEW.id, 'Freelance',            'laptop',         '#6366F1', 'income',  true),
  (NEW.id, 'Investissements',      'trending-up',    '#F59E0B', 'income',  true),
  (NEW.id, 'Revenus locatifs',     'building',       '#8B5CF6', 'income',  true),
  (NEW.id, 'Cadeaux reçus',        'gift',           '#EC4899', 'income',  true),
  (NEW.id, 'Remboursements',       'rotate-ccw',     '#14B8A6', 'income',  true),
  (NEW.id, 'Autre revenu',         'circle-help',    '#9CA3AF', 'income',  true);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

- [ ] **Step 2: Apply migration in Supabase dashboard**

Go to your Supabase project → SQL Editor → paste the entire file → Run.

Expected: no errors. Tables appear in Table Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/
git commit -m "feat: add initial database schema with RLS and user seed trigger"
```

---

## Task 3: Supabase clients + auth middleware

**Files:**
- Create: `lib/supabase/server.ts`, `lib/supabase/client.ts`, `middleware.ts`
- Create: `types/database.ts`

- [ ] **Step 1: Create TypeScript database types**

Create `types/database.ts`:

```ts
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; full_name: string | null; currency: string; created_at: string }
        Insert: { id: string; full_name?: string | null; currency?: string }
        Update: { full_name?: string | null; currency?: string }
      }
      categories: {
        Row: { id: string; user_id: string; name: string; icon_name: string | null; color: string | null; type: 'expense' | 'income' | 'both'; is_default: boolean; created_at: string }
        Insert: { user_id: string; name: string; icon_name?: string | null; color?: string | null; type?: 'expense' | 'income' | 'both'; is_default?: boolean }
        Update: { name?: string; icon_name?: string | null; color?: string | null; type?: 'expense' | 'income' | 'both' }
      }
      transactions: {
        Row: { id: string; user_id: string; amount: number; type: 'expense' | 'income'; category_id: string | null; description: string | null; date: string; is_recurring_instance: boolean; recurring_id: string | null; created_at: string }
        Insert: { user_id: string; amount: number; type: 'expense' | 'income'; category_id?: string | null; description?: string | null; date: string; is_recurring_instance?: boolean; recurring_id?: string | null }
        Update: { amount?: number; type?: 'expense' | 'income'; category_id?: string | null; description?: string | null; date?: string }
      }
      recurring_transactions: {
        Row: { id: string; user_id: string; name: string; amount: number; type: 'expense' | 'income'; category_id: string | null; frequency: 'weekly' | 'monthly' | 'yearly'; start_date: string; last_generated: string | null; is_active: boolean; created_at: string }
        Insert: { user_id: string; name: string; amount: number; type: 'expense' | 'income'; category_id?: string | null; frequency: 'weekly' | 'monthly' | 'yearly'; start_date: string; is_active?: boolean }
        Update: { name?: string; amount?: number; type?: 'expense' | 'income'; category_id?: string | null; frequency?: 'weekly' | 'monthly' | 'yearly'; start_date?: string; is_active?: boolean }
      }
      budgets: {
        Row: { id: string; user_id: string; category_id: string; amount: number; month: number; year: number; created_at: string }
        Insert: { user_id: string; category_id: string; amount: number; month: number; year: number }
        Update: { amount?: number }
      }
    }
  }
}
```

- [ ] **Step 2: Create server Supabase client**

Create `lib/supabase/server.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

- [ ] **Step 3: Create browser Supabase client**

Create `lib/supabase/client.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 4: Create middleware**

Create `middleware.ts` at project root:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isAuthPage = pathname === '/login' || pathname === '/register'
  const isPublicAsset = pathname.startsWith('/_next') || pathname.startsWith('/icons') || pathname === '/manifest.json'

  if (isPublicAsset) return supabaseResponse

  if (!user && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/ middleware.ts types/
git commit -m "feat: add Supabase clients and auth middleware"
```

---

## Task 4: Utility functions + Zod schemas

**Files:**
- Create: `lib/utils.ts`, `lib/validations/transaction.ts`, `lib/validations/category.ts`, `lib/validations/budget.ts`, `lib/validations/recurring.ts`
- Create: `lib/utils.test.ts`

- [ ] **Step 1: Write failing tests for utils**

Create `lib/utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatCurrency, formatDate, savingsRate, getMonthRange } from './utils'

describe('formatCurrency', () => {
  it('formats EUR by default', () => {
    expect(formatCurrency(1234.5)).toBe('1 234,50 €')
  })
  it('formats with custom currency', () => {
    expect(formatCurrency(1000, 'USD')).toBe('1 000,00 $US')
  })
})

describe('savingsRate', () => {
  it('computes correctly', () => {
    expect(savingsRate(3000, 1800)).toBe(40)
  })
  it('returns null when income is 0', () => {
    expect(savingsRate(0, 0)).toBeNull()
  })
})

describe('getMonthRange', () => {
  it('returns correct start and end for a given month', () => {
    const { start, end } = getMonthRange(2024, 5)
    expect(start).toBe('2024-05-01')
    expect(end).toBe('2024-05-31')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm test
```
Expected: FAIL — `formatCurrency` not found.

- [ ] **Step 3: Implement utils**

Create `lib/utils.ts`:

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
}

export function savingsRate(income: number, expenses: number): number | null {
  if (income === 0) return null
  return Math.round(((income - expenses) / income) * 100)
}

export function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  return { start: fmt(start), end: fmt(end) }
}

export function getCurrentMonthYear(): { month: number; year: number } {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npm test
```
Expected: all 4 tests PASS.

- [ ] **Step 5: Create transaction validation schema**

Create `lib/validations/transaction.ts`:

```ts
import { z } from 'zod'

export const transactionSchema = z.object({
  amount: z.coerce.number().positive('Le montant doit être positif'),
  type: z.enum(['expense', 'income']),
  category_id: z.string().uuid().nullable().optional(),
  description: z.string().max(255).optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)'),
})

export type TransactionInput = z.infer<typeof transactionSchema>
```

- [ ] **Step 6: Create category validation schema**

Create `lib/validations/category.ts`:

```ts
import { z } from 'zod'

export const categorySchema = z.object({
  name: z.string().min(1, 'Nom requis').max(50),
  icon_name: z.string().min(1, 'Icône requise'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Couleur invalide'),
  type: z.enum(['expense', 'income', 'both']),
})

export type CategoryInput = z.infer<typeof categorySchema>
```

- [ ] **Step 7: Create budget validation schema**

Create `lib/validations/budget.ts`:

```ts
import { z } from 'zod'

export const budgetSchema = z.object({
  category_id: z.string().uuid(),
  amount: z.coerce.number().positive('Le budget doit être positif'),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
})

export type BudgetInput = z.infer<typeof budgetSchema>
```

- [ ] **Step 8: Create recurring transaction validation schema**

Create `lib/validations/recurring.ts`:

```ts
import { z } from 'zod'

export const recurringSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(100),
  amount: z.coerce.number().positive('Le montant doit être positif'),
  type: z.enum(['expense', 'income']),
  category_id: z.string().uuid().nullable().optional(),
  frequency: z.enum(['weekly', 'monthly', 'yearly']),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export type RecurringInput = z.infer<typeof recurringSchema>
```

- [ ] **Step 9: Commit**

```bash
git add lib/
git commit -m "feat: add utility functions and Zod validation schemas"
```

---

## Task 5: Auth pages

**Files:**
- Create: `app/(auth)/layout.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`
- Create: `app/actions/auth.ts`

- [ ] **Step 1: Create auth layout**

Create `app/(auth)/layout.tsx`:

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
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
```

- [ ] **Step 2: Create auth server actions**

Create `app/actions/auth.ts`:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })
  if (error) return { error: error.message }
  redirect('/dashboard')
}

export async function register(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      data: { full_name: formData.get('full_name') as string },
    },
  })
  if (error) return { error: error.message }
  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

- [ ] **Step 3: Create login page**

Create `app/(auth)/login/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { login } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await login(new FormData(e.currentTarget))
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
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
            <Label htmlFor="password">Mot de passe</Label>
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
  )
}
```

- [ ] **Step 4: Create register page**

Create `app/(auth)/register/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { register } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await register(new FormData(e.currentTarget))
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Créer un compte</CardTitle>
        <CardDescription>Commencez à suivre vos finances</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Nom complet</Label>
            <Input id="full_name" name="full_name" type="text" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input id="password" name="password" type="password" required minLength={6} autoComplete="new-password" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Création...' : 'Créer mon compte'}
          </Button>
        </form>
        <p className="text-sm text-center text-muted-foreground mt-4">
          Déjà un compte ?{' '}
          <Link href="/login" className="text-primary hover:underline">Se connecter</Link>
        </p>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 5: Update root `app/layout.tsx`**

Replace `app/layout.tsx` with:

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: 'FinanceApp',
  description: 'Gestion de finances personnelles',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 6: Add root redirect**

Create `app/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
export default function RootPage() { redirect('/dashboard') }
```

- [ ] **Step 7: Test auth flow manually**

```bash
npm run dev
```
Navigate to `http://localhost:3000` → should redirect to `/login`. Register a new account → should redirect to `/dashboard` (404 for now — expected).

- [ ] **Step 8: Commit**

```bash
git add app/
git commit -m "feat: add auth pages (login, register) and server actions"
```

---

## Task 6: App layout + navigation

**Files:**
- Create: `app/(app)/layout.tsx`, `components/app/Sidebar.tsx`, `components/app/BottomNav.tsx`, `components/app/ThemeProvider.tsx`

- [ ] **Step 1: Create ThemeProvider**

Create `components/app/ThemeProvider.tsx`:

```tsx
'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  )
}
```

Update `app/layout.tsx` to wrap with ThemeProvider:

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '@/components/app/ThemeProvider'
import { Toaster } from 'sonner'
import './globals.css'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: 'FinanceApp',
  description: 'Gestion de finances personnelles',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          {children}
          <Toaster position="bottom-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Create Sidebar component**

Create `components/app/Sidebar.tsx`:

```tsx
'use client'

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

function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(href + '/')
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
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
        <span className="text-sm font-bold tracking-widest uppercase text-foreground">FinanceApp</span>
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
```

- [ ] **Step 3: Create BottomNav component**

Create `components/app/BottomNav.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ArrowLeftRight, CalendarDays, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const items = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/recap', label: 'Récap', icon: CalendarDays },
  { href: '/profile', label: 'Profil', icon: User },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t h-16 flex items-center">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link key={href} href={href} className={cn(
            'flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
            active ? 'text-primary' : 'text-muted-foreground'
          )}>
            <Icon size={20} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 4: Create app layout**

Create `app/(app)/layout.tsx`:

```tsx
import { Sidebar } from '@/components/app/Sidebar'
import { BottomNav } from '@/components/app/BottomNav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="lg:pl-56 pb-16 lg:pb-0 min-h-screen">
        <div className="max-w-6xl mx-auto px-4 py-6">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 5: Add placeholder pages so navigation works**

Create `app/(app)/dashboard/page.tsx`:
```tsx
export default function DashboardPage() { return <h1 className="text-2xl font-bold">Dashboard</h1> }
```

Create `app/(app)/transactions/page.tsx`:
```tsx
export default function TransactionsPage() { return <h1 className="text-2xl font-bold">Transactions</h1> }
```

Create `app/(app)/recap/page.tsx`:
```tsx
export default function RecapPage() { return <h1 className="text-2xl font-bold">Récap mensuel</h1> }
```

Create `app/(app)/budgets/page.tsx`:
```tsx
export default function BudgetsPage() { return <h1 className="text-2xl font-bold">Budgets</h1> }
```

Create `app/(app)/recurring/page.tsx`:
```tsx
export default function RecurringPage() { return <h1 className="text-2xl font-bold">Récurrents</h1> }
```

Create `app/(app)/import/page.tsx`:
```tsx
export default function ImportPage() { return <h1 className="text-2xl font-bold">Import</h1> }
```

Create `app/(app)/profile/page.tsx`:
```tsx
export default function ProfilePage() { return <h1 className="text-2xl font-bold">Profil</h1> }
```

- [ ] **Step 6: Verify navigation**

```bash
npm run dev
```
Log in → sidebar visible on desktop, bottom nav on mobile, all links work.

- [ ] **Step 7: Commit**

```bash
git add app/ components/
git commit -m "feat: add app layout with sidebar and bottom navigation"
```

---

## Task 7: Transaction server actions + skeleton components

**Files:**
- Create: `app/actions/transactions.ts`, `app/actions/categories.ts`
- Create: `components/app/Skeletons.tsx`

- [ ] **Step 1: Create categories server actions**

Create `app/actions/categories.ts`:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { categorySchema } from '@/lib/validations/category'
import { revalidatePath } from 'next/cache'

export async function getCategories() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', user.id)
    .order('name')
  return data ?? []
}

export async function createCategory(input: unknown) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const parsed = categorySchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { error } = await supabase.from('categories').insert({ ...parsed.data, user_id: user.id })
  if (error) return { error: error.message }
  revalidatePath('/profile')
  return { success: true }
}

export async function updateCategory(id: string, input: unknown) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const parsed = categorySchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { error } = await supabase.from('categories').update(parsed.data).eq('id', id).eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/profile')
  return { success: true }
}

export async function deleteCategory(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const { error } = await supabase.from('categories').delete().eq('id', id).eq('user_id', user.id).eq('is_default', false)
  if (error) return { error: error.message }
  revalidatePath('/profile')
  return { success: true }
}
```

- [ ] **Step 2: Create transaction server actions**

Create `app/actions/transactions.ts`:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { transactionSchema } from '@/lib/validations/transaction'
import { revalidatePath } from 'next/cache'

export async function getTransactions(params: {
  month?: string
  type?: 'expense' | 'income'
  category_id?: string
  q?: string
  sort?: string
  order?: 'asc' | 'desc'
  page?: number
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], count: 0 }

  const { month, type, category_id, q, sort = 'date', order = 'desc', page = 1 } = params
  const pageSize = 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('transactions')
    .select('*, categories(id, name, icon_name, color)', { count: 'exact' })
    .eq('user_id', user.id)

  if (month) {
    const [year, m] = month.split('-').map(Number)
    const start = new Date(year, m - 1, 1).toISOString().split('T')[0]
    const end = new Date(year, m, 0).toISOString().split('T')[0]
    query = query.gte('date', start).lte('date', end)
  }
  if (type) query = query.eq('type', type)
  if (category_id) query = query.eq('category_id', category_id)
  if (q) query = query.ilike('description', `%${q}%`)

  const { data, count } = await query.order(sort, { ascending: order === 'asc' }).range(from, to)
  return { data: data ?? [], count: count ?? 0 }
}

export async function createTransaction(input: unknown) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const parsed = transactionSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { error } = await supabase.from('transactions').insert({ ...parsed.data, user_id: user.id })
  if (error) return { error: error.message }
  revalidatePath('/transactions')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateTransaction(id: string, input: unknown) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const parsed = transactionSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { error } = await supabase.from('transactions').update(parsed.data).eq('id', id).eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/transactions')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteTransaction(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const { error } = await supabase.from('transactions').delete().eq('id', id).eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/transactions')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function getMonthlyTotals(year: number, month: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { income: 0, expenses: 0 }

  const start = new Date(year, month - 1, 1).toISOString().split('T')[0]
  const end = new Date(year, month, 0).toISOString().split('T')[0]

  const { data } = await supabase
    .from('transactions')
    .select('amount, type')
    .eq('user_id', user.id)
    .gte('date', start)
    .lte('date', end)

  const income = (data ?? []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const expenses = (data ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  return { income, expenses }
}
```

- [ ] **Step 3: Create skeleton components**

Create `components/app/Skeletons.tsx`:

```tsx
import { Skeleton } from '@/components/ui/skeleton'

export function CardSkeleton() {
  return (
    <div className="rounded-xl border p-6 space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-32" />
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <div className="rounded-xl border p-6">
      <Skeleton className="h-4 w-32 mb-4" />
      <Skeleton className="h-48 w-full" />
    </div>
  )
}

export function TransactionRowSkeleton() {
  return (
    <div className="flex items-center gap-4 py-3 border-b">
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="flex-1 space-y-1">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-4 w-16" />
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/actions/ components/
git commit -m "feat: add transaction/category server actions and skeleton components"
```

---

## Task 8: Transaction list page + form

**Files:**
- Create: `components/app/CategoryBadge.tsx`, `components/app/TransactionForm.tsx`
- Modify: `app/(app)/transactions/page.tsx`

- [ ] **Step 1: Create CategoryBadge component**

Create `components/app/CategoryBadge.tsx`:

```tsx
import * as LucideIcons from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  name: string
  iconName: string | null
  color: string | null
  size?: 'sm' | 'md'
}

export function CategoryBadge({ name, iconName, color, size = 'md' }: Props) {
  const Icon = iconName
    ? ((LucideIcons as Record<string, React.ElementType>)[
        iconName.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')
      ] ?? LucideIcons.Circle)
    : LucideIcons.Circle

  return (
    <span className={cn('inline-flex items-center gap-1.5 font-medium', size === 'sm' ? 'text-xs' : 'text-sm')}>
      <span
        className={cn('flex items-center justify-center rounded-full', size === 'sm' ? 'w-5 h-5' : 'w-7 h-7')}
        style={{ backgroundColor: color ? `${color}20` : '#9CA3AF20' }}
      >
        <Icon size={size === 'sm' ? 10 : 14} style={{ color: color ?? '#9CA3AF' }} />
      </span>
      {name}
    </span>
  )
}
```

- [ ] **Step 2: Create TransactionForm component**

Create `components/app/TransactionForm.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { transactionSchema, type TransactionInput } from '@/lib/validations/transaction'
import { createTransaction, updateTransaction } from '@/app/actions/transactions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { Database } from '@/types/database'

type Transaction = Database['public']['Tables']['transactions']['Row']
type Category = Database['public']['Tables']['categories']['Row']

interface Props {
  transaction?: Transaction | null
  categories: Category[]
  onSuccess: () => void
}

export function TransactionForm({ transaction, categories, onSuccess }: Props) {
  const isEdit = !!transaction
  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<TransactionInput>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: 'expense',
      date: new Date().toISOString().split('T')[0],
    },
  })

  useEffect(() => {
    if (transaction) {
      reset({
        amount: transaction.amount,
        type: transaction.type,
        category_id: transaction.category_id ?? undefined,
        description: transaction.description ?? undefined,
        date: transaction.date,
      })
    }
  }, [transaction, reset])

  const selectedType = watch('type')

  async function onSubmit(data: TransactionInput) {
    const result = isEdit
      ? await updateTransaction(transaction!.id, data)
      : await createTransaction(data)
    if (result.error) { toast.error(result.error); return }
    toast.success(isEdit ? 'Transaction mise à jour' : 'Transaction ajoutée')
    onSuccess()
  }

  const filteredCategories = categories.filter(c => c.type === selectedType || c.type === 'both')

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={selectedType} onValueChange={v => setValue('type', v as 'expense' | 'income')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Dépense</SelectItem>
              <SelectItem value="income">Revenu</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="amount">Montant (€)</Label>
          <Input id="amount" type="number" step="0.01" min="0.01" {...register('amount')} />
          {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Catégorie</Label>
        <Select onValueChange={v => setValue('category_id', v)}>
          <SelectTrigger><SelectValue placeholder="Choisir une catégorie" /></SelectTrigger>
          <SelectContent>
            {filteredCategories.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="date">Date</Label>
        <Input id="date" type="date" {...register('date')} />
        {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={2} {...register('description')} />
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Enregistrement...' : isEdit ? 'Mettre à jour' : 'Ajouter'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: Build transaction list page**

Replace `app/(app)/transactions/page.tsx`:

```tsx
import { Suspense } from 'react'
import { getTransactions } from '@/app/actions/transactions'
import { getCategories } from '@/app/actions/categories'
import { TransactionListClient } from '@/components/app/TransactionListClient'
import { TransactionRowSkeleton } from '@/components/app/Skeletons'

interface Props {
  searchParams: Promise<{ month?: string; type?: string; category?: string; q?: string; page?: string; sort?: string; order?: string }>
}

export default async function TransactionsPage({ searchParams }: Props) {
  const params = await searchParams
  const [{ data: transactions, count }, categories] = await Promise.all([
    getTransactions({
      month: params.month,
      type: params.type as 'expense' | 'income' | undefined,
      category_id: params.category,
      q: params.q,
      sort: params.sort,
      order: params.order as 'asc' | 'desc' | undefined,
      page: params.page ? Number(params.page) : 1,
    }),
    getCategories(),
  ])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Transactions</h1>
      </div>
      <Suspense fallback={<>{Array.from({ length: 5 }).map((_, i) => <TransactionRowSkeleton key={i} />)}</>}>
        <TransactionListClient
          transactions={transactions}
          categories={categories}
          totalCount={count}
          currentPage={params.page ? Number(params.page) : 1}
          searchParams={params}
        />
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 4: Create TransactionListClient component**

Create `components/app/TransactionListClient.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { deleteTransaction } from '@/app/actions/transactions'
import { TransactionForm } from './TransactionForm'
import { CategoryBadge } from './CategoryBadge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Database } from '@/types/database'

type Transaction = Database['public']['Tables']['transactions']['Row'] & {
  categories: Pick<Database['public']['Tables']['categories']['Row'], 'id' | 'name' | 'icon_name' | 'color'> | null
}
type Category = Database['public']['Tables']['categories']['Row']

interface Props {
  transactions: Transaction[]
  categories: Category[]
  totalCount: number
  currentPage: number
  searchParams: Record<string, string | undefined>
}

export function TransactionListClient({ transactions, categories, totalCount, currentPage, searchParams }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const pageSize = 20
  const totalPages = Math.ceil(totalCount / pageSize)

  function openCreate() { setEditing(null); setSheetOpen(true) }
  function openEdit(t: Transaction) { setEditing(t); setSheetOpen(true) }

  async function handleDelete(id: string) {
    const result = await deleteTransaction(id)
    if (result.error) toast.error(result.error)
    else toast.success('Transaction supprimée')
  }

  function setParam(key: string, value: string | undefined) {
    const params = new URLSearchParams(searchParams as Record<string, string>)
    if (value) params.set(key, value); else params.delete(key)
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="month"
          className="h-9 rounded-md border px-3 text-sm bg-background"
          value={searchParams.month ?? ''}
          onChange={e => setParam('month', e.target.value || undefined)}
        />
        <select
          className="h-9 rounded-md border px-3 text-sm bg-background"
          value={searchParams.type ?? ''}
          onChange={e => setParam('type', e.target.value || undefined)}
        >
          <option value="">Tous types</option>
          <option value="expense">Dépenses</option>
          <option value="income">Revenus</option>
        </select>
        <select
          className="h-9 rounded-md border px-3 text-sm bg-background"
          value={searchParams.category ?? ''}
          onChange={e => setParam('category', e.target.value || undefined)}
        >
          <option value="">Toutes catégories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input
          type="search"
          placeholder="Rechercher..."
          className="h-9 rounded-md border px-3 text-sm bg-background"
          defaultValue={searchParams.q ?? ''}
          onKeyDown={e => { if (e.key === 'Enter') setParam('q', (e.target as HTMLInputElement).value || undefined) }}
        />
        <Button onClick={openCreate} size="sm" className="ml-auto">
          <Plus size={14} className="mr-1" /> Ajouter
        </Button>
      </div>

      <div className="rounded-xl border overflow-hidden">
        {transactions.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 text-sm">Aucune transaction trouvée</p>
        ) : (
          <div className="divide-y">
            {transactions.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                {t.categories && (
                  <CategoryBadge name="" iconName={t.categories.icon_name} color={t.categories.color} size="sm" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.description || t.categories?.name || '—'}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(t.date)} · {t.categories?.name}</p>
                </div>
                <span className={`text-sm font-semibold ${t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                  {t.type === 'income' ? '+' : '-'}{formatCurrency(Number(t.amount))}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}><Pencil size={13} /></Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 size={13} /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer la transaction ?</AlertDialogTitle>
                      <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(t.id)}>Supprimer</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <Button key={p} variant={p === currentPage ? 'default' : 'outline'} size="sm" onClick={() => setParam('page', String(p))}>{p}</Button>
          ))}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editing ? 'Modifier la transaction' : 'Nouvelle transaction'}</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <TransactionForm transaction={editing} categories={categories} onSuccess={() => setSheetOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
```

- [ ] **Step 5: Add FAB for mobile**

Add this to `app/(app)/layout.tsx` after `<BottomNav />`:

```tsx
import { MobileFab } from '@/components/app/MobileFab'
```

Create `components/app/MobileFab.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { TransactionForm } from './TransactionForm'
import { getCategories } from '@/app/actions/categories'
import { useEffect, useRef } from 'react'
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
```

Update `app/(app)/layout.tsx`:

```tsx
import { Sidebar } from '@/components/app/Sidebar'
import { BottomNav } from '@/components/app/BottomNav'
import { MobileFab } from '@/components/app/MobileFab'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="lg:pl-56 pb-16 lg:pb-0 min-h-screen">
        <div className="max-w-6xl mx-auto px-4 py-6">
          {children}
        </div>
      </main>
      <BottomNav />
      <MobileFab />
    </div>
  )
}
```

- [ ] **Step 6: Test transactions flow**

```bash
npm run dev
```
- Add a transaction via the sheet → appears in list
- Edit → updates in place
- Delete → removed with confirmation

- [ ] **Step 7: Commit**

```bash
git add app/ components/
git commit -m "feat: add transaction list page with filters, form, and CRUD"
```

---

## Task 9: Recurring generate API + algorithm

**Files:**
- Create: `lib/recurring-engine.ts`, `lib/recurring-engine.test.ts`
- Create: `app/api/recurring/generate/route.ts`
- Create: `app/actions/recurring.ts`

- [ ] **Step 1: Write failing tests for recurring engine**

Create `lib/recurring-engine.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeMissingOccurrences } from './recurring-engine'

describe('computeMissingOccurrences', () => {
  it('generates monthly occurrences since last_generated', () => {
    const dates = computeMissingOccurrences({
      frequency: 'monthly',
      start_date: '2024-01-15',
      last_generated: '2024-02-15',
    }, new Date('2024-04-20'))
    expect(dates).toEqual(['2024-03-15', '2024-04-15'])
  })

  it('uses start_date when last_generated is null', () => {
    const dates = computeMissingOccurrences({
      frequency: 'monthly',
      start_date: '2024-03-01',
      last_generated: null,
    }, new Date('2024-04-10'))
    expect(dates).toEqual(['2024-03-01', '2024-04-01'])
  })

  it('returns empty when up to date', () => {
    const dates = computeMissingOccurrences({
      frequency: 'monthly',
      start_date: '2024-01-01',
      last_generated: '2024-04-01',
    }, new Date('2024-04-15'))
    expect(dates).toEqual([])
  })

  it('generates weekly occurrences', () => {
    const dates = computeMissingOccurrences({
      frequency: 'weekly',
      start_date: '2024-04-01',
      last_generated: null,
    }, new Date('2024-04-22'))
    expect(dates).toEqual(['2024-04-01', '2024-04-08', '2024-04-15', '2024-04-22'])
  })

  it('generates yearly occurrence', () => {
    const dates = computeMissingOccurrences({
      frequency: 'yearly',
      start_date: '2023-06-15',
      last_generated: '2023-06-15',
    }, new Date('2024-07-01'))
    expect(dates).toEqual(['2024-06-15'])
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm test
```
Expected: FAIL — `computeMissingOccurrences` not found.

- [ ] **Step 3: Implement recurring engine**

Create `lib/recurring-engine.ts`:

```ts
type Frequency = 'weekly' | 'monthly' | 'yearly'

interface RecurringParams {
  frequency: Frequency
  start_date: string
  last_generated: string | null
}

function addInterval(date: Date, frequency: Frequency): Date {
  const d = new Date(date)
  if (frequency === 'weekly') d.setDate(d.getDate() + 7)
  else if (frequency === 'monthly') d.setMonth(d.getMonth() + 1)
  else d.setFullYear(d.getFullYear() + 1)
  return d
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

export function computeMissingOccurrences(
  params: RecurringParams,
  today: Date = new Date()
): string[] {
  const todayStr = toDateStr(today)
  const start = new Date(params.start_date)
  const lastGenStr = params.last_generated

  // Find first date to generate: the one after last_generated, or start_date if never generated
  let next: Date
  if (lastGenStr) {
    next = addInterval(new Date(lastGenStr), params.frequency)
  } else {
    next = start
  }

  const results: string[] = []
  while (toDateStr(next) <= todayStr) {
    results.push(toDateStr(next))
    next = addInterval(next, params.frequency)
  }
  return results
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npm test
```
Expected: all 5 tests PASS.

- [ ] **Step 5: Create the generate API route**

Create `app/api/recurring/generate/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeMissingOccurrences } from '@/lib/recurring-engine'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: recurrings } = await supabase
    .from('recurring_transactions')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (!recurrings?.length) return NextResponse.json({ generated: 0 })

  const today = new Date()
  let totalGenerated = 0

  for (const r of recurrings) {
    const dates = computeMissingOccurrences(
      { frequency: r.frequency, start_date: r.start_date, last_generated: r.last_generated },
      today
    )
    if (dates.length === 0) continue

    const toInsert = dates.map(date => ({
      user_id: user.id,
      amount: r.amount,
      type: r.type,
      category_id: r.category_id,
      description: r.name,
      date,
      is_recurring_instance: true,
      recurring_id: r.id,
    }))

    const { error } = await supabase.from('transactions').insert(toInsert)
    if (!error) {
      await supabase
        .from('recurring_transactions')
        .update({ last_generated: dates[dates.length - 1] })
        .eq('id', r.id)
      totalGenerated += dates.length
    }
  }

  return NextResponse.json({ generated: totalGenerated })
}
```

- [ ] **Step 6: Create recurring server actions**

Create `app/actions/recurring.ts`:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { recurringSchema } from '@/lib/validations/recurring'
import { revalidatePath } from 'next/cache'

export async function getRecurring() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('recurring_transactions')
    .select('*, categories(id, name, icon_name, color)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function createRecurring(input: unknown) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const parsed = recurringSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { error } = await supabase.from('recurring_transactions').insert({ ...parsed.data, user_id: user.id })
  if (error) return { error: error.message }
  revalidatePath('/recurring')
  return { success: true }
}

export async function updateRecurring(id: string, input: unknown) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const parsed = recurringSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { error } = await supabase.from('recurring_transactions').update(parsed.data).eq('id', id).eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/recurring')
  return { success: true }
}

export async function toggleRecurring(id: string, is_active: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const { error } = await supabase.from('recurring_transactions').update({ is_active }).eq('id', id).eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/recurring')
  return { success: true }
}

export async function deleteRecurring(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const { error } = await supabase.from('recurring_transactions').delete().eq('id', id).eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/recurring')
  return { success: true }
}
```

- [ ] **Step 7: Commit**

```bash
git add lib/ app/api/ app/actions/
git commit -m "feat: add recurring engine (tested), generate API route, and recurring actions"
```

---

## Task 10: Dashboard page

**Files:**
- Create: `components/charts/RevenueExpenseChart.tsx`, `components/charts/CategoryDonutChart.tsx`, `components/charts/BalanceLineChart.tsx`
- Create: `components/app/DashboardRecurringTrigger.tsx`
- Modify: `app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Create DashboardRecurringTrigger**

Create `components/app/DashboardRecurringTrigger.tsx`:

```tsx
'use client'

import { useEffect } from 'react'

export function DashboardRecurringTrigger() {
  useEffect(() => {
    fetch('/api/recurring/generate', { method: 'POST' }).catch(() => {})
  }, [])
  return null
}
```

- [ ] **Step 2: Create RevenueExpenseChart**

Create `components/charts/RevenueExpenseChart.tsx`:

```tsx
'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useTheme } from 'next-themes'

interface DataPoint { month: string; revenus: number; dépenses: number }

export function RevenueExpenseChart({ data }: { data: DataPoint[] }) {
  const { theme } = useTheme()
  const textColor = theme === 'dark' ? '#8888AA' : '#6B7280'
  return (
    <div className="rounded-xl border p-6">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4">Revenus vs Dépenses — 6 mois</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} barGap={4} barCategoryGap="30%">
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} tickFormatter={v => `${v}€`} />
          <Tooltip formatter={(v: number) => [`${v.toFixed(2)} €`]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="revenus" fill="#10B981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="dépenses" fill="#EC4899" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 3: Create CategoryDonutChart**

Create `components/charts/CategoryDonutChart.tsx`:

```tsx
'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface DataPoint { name: string; value: number; color: string | null }

export function CategoryDonutChart({ data }: { data: DataPoint[] }) {
  return (
    <div className="rounded-xl border p-6">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4">Dépenses par catégorie</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={2}>
            {data.map((entry, i) => <Cell key={i} fill={entry.color ?? '#9CA3AF'} />)}
          </Pie>
          <Tooltip formatter={(v: number) => [`${v.toFixed(2)} €`]} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 4: Create BalanceLineChart**

Create `components/charts/BalanceLineChart.tsx`:

```tsx
'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useTheme } from 'next-themes'

interface DataPoint { month: string; solde: number }

export function BalanceLineChart({ data }: { data: DataPoint[] }) {
  const { theme } = useTheme()
  const textColor = theme === 'dark' ? '#8888AA' : '#6B7280'
  return (
    <div className="rounded-xl border p-6">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4">Évolution du solde — 12 mois</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#2A2A3A' : '#E5E7EB'} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} tickFormatter={v => `${v}€`} />
          <Tooltip formatter={(v: number) => [`${v.toFixed(2)} €`]} />
          <Line type="monotone" dataKey="solde" stroke="#4F46E5" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 5: Build dashboard page**

Replace `app/(app)/dashboard/page.tsx`:

```tsx
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { DashboardRecurringTrigger } from '@/components/app/DashboardRecurringTrigger'
import { RevenueExpenseChart } from '@/components/charts/RevenueExpenseChart'
import { CategoryDonutChart } from '@/components/charts/CategoryDonutChart'
import { BalanceLineChart } from '@/components/charts/BalanceLineChart'
import { CategoryBadge } from '@/components/app/CategoryBadge'
import { CardSkeleton, ChartSkeleton, TransactionRowSkeleton } from '@/components/app/Skeletons'
import { formatCurrency, formatDate, savingsRate, getMonthRange } from '@/lib/utils'

async function getDashboardData() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const { start, end } = getMonthRange(year, month)

  // Current month totals
  const { data: currentMonth } = await supabase
    .from('transactions')
    .select('amount, type')
    .eq('user_id', user.id)
    .gte('date', start)
    .lte('date', end)

  const income = (currentMonth ?? []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const expenses = (currentMonth ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

  // 6-month bar chart data
  const barData = await Promise.all(
    Array.from({ length: 6 }, (_, i) => {
      const d = new Date(year, month - 1 - (5 - i), 1)
      return d
    }).map(async d => {
      const y = d.getFullYear()
      const m = d.getMonth() + 1
      const { start: s, end: e } = getMonthRange(y, m)
      const { data } = await supabase.from('transactions').select('amount, type').eq('user_id', user.id).gte('date', s).lte('date', e)
      const rev = (data ?? []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
      const exp = (data ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
      return { month: `${String(m).padStart(2, '0')}/${y}`, revenus: rev, dépenses: exp }
    })
  )

  // Donut: category breakdown for current month
  const { data: catData } = await supabase
    .from('transactions')
    .select('amount, categories(name, color)')
    .eq('user_id', user.id)
    .eq('type', 'expense')
    .gte('date', start)
    .lte('date', end)

  const catMap = new Map<string, { value: number; color: string | null }>()
  ;(catData ?? []).forEach((t: any) => {
    const name = t.categories?.name ?? 'Autre'
    const color = t.categories?.color ?? null
    catMap.set(name, { value: (catMap.get(name)?.value ?? 0) + Number(t.amount), color })
  })
  const donutData = Array.from(catMap, ([name, v]) => ({ name, ...v })).sort((a, b) => b.value - a.value).slice(0, 8)

  // 12-month line chart
  const lineData = await Promise.all(
    Array.from({ length: 12 }, (_, i) => {
      const d = new Date(year, month - 1 - (11 - i), 1)
      return d
    }).map(async d => {
      const y = d.getFullYear()
      const m = d.getMonth() + 1
      const { start: s, end: e } = getMonthRange(y, m)
      const { data } = await supabase.from('transactions').select('amount, type').eq('user_id', user.id).gte('date', s).lte('date', e)
      const rev = (data ?? []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
      const exp = (data ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
      return { month: `${String(m).padStart(2, '0')}/${String(y).slice(2)}`, solde: rev - exp }
    })
  )

  // Last 5 transactions
  const { data: recent } = await supabase
    .from('transactions')
    .select('*, categories(id, name, icon_name, color)')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(5)

  // Budget alerts
  const { data: budgets } = await supabase
    .from('budgets')
    .select('*, categories(name)')
    .eq('user_id', user.id)
    .eq('month', month)
    .eq('year', year)

  const alerts: string[] = []
  for (const b of (budgets ?? [])) {
    const spent = (currentMonth ?? [])
      .filter((t: any) => t.type === 'expense' && t.category_id === b.category_id)
      .reduce((s, t) => s + Number(t.amount), 0)
    if (spent > Number(b.amount)) alerts.push((b as any).categories?.name ?? 'Catégorie')
  }

  return { income, expenses, barData, donutData, lineData, recent: recent ?? [], alerts, savings: savingsRate(income, expenses) }
}

export default async function DashboardPage() {
  const data = await getDashboardData()
  if (!data) return <p>Erreur de chargement</p>
  const { income, expenses, barData, donutData, lineData, recent, alerts, savings } = data
  const balance = income - expenses

  return (
    <div className="space-y-6">
      <DashboardRecurringTrigger />
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date())}
        </p>
      </div>

      {alerts.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Budget dépassé : {alerts.join(', ')}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Revenus</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(income)}</p>
        </div>
        <div className="rounded-xl border p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Dépenses</p>
          <p className="text-2xl font-bold text-rose-500 dark:text-rose-400">{formatCurrency(expenses)}</p>
        </div>
        <div className="rounded-xl border p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Solde</p>
          <p className={`text-2xl font-bold ${balance >= 0 ? 'text-foreground' : 'text-rose-500'}`}>{formatCurrency(balance)}</p>
          {savings !== null && <p className="text-xs text-muted-foreground mt-1">Épargne : {savings}%</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Suspense fallback={<ChartSkeleton />}><RevenueExpenseChart data={barData} /></Suspense>
        <Suspense fallback={<ChartSkeleton />}><CategoryDonutChart data={donutData} /></Suspense>
      </div>
      <Suspense fallback={<ChartSkeleton />}><BalanceLineChart data={lineData} /></Suspense>

      <div className="rounded-xl border">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold">Dernières transactions</h3>
          <a href="/transactions" className="text-xs text-primary hover:underline">Voir tout</a>
        </div>
        <div className="divide-y">
          {recent.map((t: any) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3">
              {t.categories && <CategoryBadge name="" iconName={t.categories.icon_name} color={t.categories.color} size="sm" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{t.description || t.categories?.name || '—'}</p>
                <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
              </div>
              <span className={`text-sm font-semibold ${t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                {t.type === 'income' ? '+' : '-'}{formatCurrency(Number(t.amount))}
              </span>
            </div>
          ))}
          {recent.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Aucune transaction</p>}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Verify dashboard**

```bash
npm run dev
```
Dashboard shows: summary cards, 3 charts, last 5 transactions. Recurring trigger fires silently on load.

- [ ] **Step 7: Commit**

```bash
git add app/ components/
git commit -m "feat: add dashboard with charts, summary cards, and recurring trigger"
```
