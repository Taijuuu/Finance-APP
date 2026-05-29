# Finance App — Design Spec
**Date :** 2026-05-29
**Stack :** Next.js 15 App Router + TypeScript strict + Tailwind CSS 4 + shadcn/ui (zinc) + Supabase + Recharts + React Hook Form + Zod + SheetJS + Lucide React + next-pwa + Framer Motion + sonner

---

## 1. Architecture

### Approche
Hybride Server/Client Components (Next.js 15 App Router idiomatique) :
- Pages = React Server Components → fetch Supabase server-side via `createServerClient` (`@supabase/ssr`)
- Formulaires, graphiques, interactions = `"use client"` components
- Mutations = Server Actions dans `app/actions/`
- Auth = `middleware.ts` vérifie le JWT Supabase et redirige vers `/login` si absent

### Structure de fichiers
```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
├── (app)/                            ← layout avec sidebar + auth guard
│   ├── layout.tsx
│   ├── dashboard/page.tsx
│   ├── transactions/page.tsx
│   ├── recap/page.tsx
│   ├── budgets/page.tsx
│   ├── recurring/page.tsx
│   ├── import/page.tsx
│   └── profile/page.tsx
├── api/
│   └── recurring/generate/route.ts  ← POST, appelée au load dashboard
└── middleware.ts

lib/
├── supabase/
│   ├── server.ts        ← createServerClient
│   ├── client.ts        ← createBrowserClient
│   └── middleware.ts    ← createMiddlewareClient
├── validations/         ← schémas Zod partagés (transaction, category, budget, import)
└── utils.ts             ← formatCurrency, formatDate, cn

components/
├── ui/                  ← shadcn/ui générés
├── app/                 ← composants métier
│   ├── TransactionForm.tsx
│   ├── TransactionList.tsx
│   ├── CategoryBadge.tsx
│   ├── BudgetCard.tsx
│   ├── RecurringForm.tsx
│   └── ImportWizard.tsx
└── charts/              ← wrappers Recharts (client)
    ├── BarChart.tsx
    ├── DonutChart.tsx
    └── LineChart.tsx

app/actions/
├── transactions.ts
├── categories.ts
├── budgets.ts
├── recurring.ts
└── profile.ts
```

---

## 2. Base de données (Supabase / PostgreSQL)

### Schéma
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  currency TEXT DEFAULT 'EUR',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon_name TEXT,           -- nom d'icône Lucide (ex: "home", "car", "utensils")
  color TEXT,               -- hex parmi 12 couleurs prédéfinies
  type TEXT CHECK (type IN ('expense', 'income', 'both')) DEFAULT 'both',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE recurring_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  type TEXT CHECK (type IN ('expense', 'income')) NOT NULL,
  category_id UUID REFERENCES categories(id),
  frequency TEXT CHECK (frequency IN ('weekly', 'monthly', 'yearly')) NOT NULL,
  start_date DATE NOT NULL,
  last_generated DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- transactions après recurring_transactions (dépendance FK)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  type TEXT CHECK (type IN ('expense', 'income')) NOT NULL,
  category_id UUID REFERENCES categories(id),
  description TEXT,
  date DATE NOT NULL,
  is_recurring_instance BOOLEAN DEFAULT false,
  recurring_id UUID REFERENCES recurring_transactions(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id),
  amount DECIMAL(12,2) NOT NULL,
  month INT CHECK (month BETWEEN 1 AND 12),
  year INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category_id, month, year)
);

-- Index pour performances
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX idx_transactions_user_month ON transactions(user_id, date_trunc('month', date));
CREATE INDEX idx_recurring_active ON recurring_transactions(user_id, is_active, last_generated);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own data" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users manage own data" ON categories FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own data" ON transactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own data" ON recurring_transactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own data" ON budgets FOR ALL USING (auth.uid() = user_id);
```

### Seed catégories à l'inscription
Trigger PostgreSQL `on_auth_user_created` → fonction `handle_new_user()` qui :
1. Insère le profil dans `profiles`
2. Insère les 23 catégories par défaut (16 dépenses + 7 revenus) avec `is_default = true`

Mapping icône Lucide pour les catégories par défaut :

| Catégorie | icon_name | color |
|---|---|---|
| Logement | `home` | #6366F1 |
| Alimentation | `shopping-cart` | #10B981 |
| Transport | `car` | #F59E0B |
| Santé | `heart-pulse` | #EF4444 |
| Loisirs | `clapperboard` | #8B5CF6 |
| Restaurants & Bars | `utensils` | #F97316 |
| Vêtements & Shopping | `shirt` | #EC4899 |
| Abonnements | `smartphone` | #14B8A6 |
| Sport & Bien-être | `dumbbell` | #84CC16 |
| Éducation & Formation | `graduation-cap` | #0EA5E9 |
| Voyages & Vacances | `plane` | #06B6D4 |
| Banque & Assurances | `landmark` | #64748B |
| Animaux | `paw-print` | #A78BFA |
| Cadeaux & Dons | `gift` | #F43F5E |
| Maison & Bricolage | `wrench` | #78716C |
| Autre (dépense) | `circle-help` | #9CA3AF |
| Salaire | `briefcase` | #10B981 |
| Freelance & Revenus | `laptop` | #6366F1 |
| Investissements | `trending-up` | #F59E0B |
| Revenus locatifs | `building` | #8B5CF6 |
| Cadeaux reçus | `gift` | #EC4899 |
| Remboursements | `rotate-ccw` | #14B8A6 |
| Autre revenu | `circle-help` | #9CA3AF |

### Auth flow
1. Signup → Supabase Auth crée le user → trigger crée profil + catégories
2. Login → JWT dans cookie httpOnly géré par `@supabase/ssr`
3. `middleware.ts` → `updateSession()` pour refresh token, redirect `/login` si absent
4. Page profil → Server Action update `profiles.full_name` + `profiles.currency`

---

## 3. Features

### Dashboard
- Server Component, fetch en parallèle via `Promise.all` :
  - Totaux du mois (revenus, dépenses, solde)
  - Données 6 mois pour le bar chart
  - Répartition par catégorie du mois (donut)
  - Évolution solde 12 mois (line chart)
  - 5 dernières transactions
- Charts = Client Components dans `Suspense` avec `<ChartSkeleton>`
- `useEffect` côté client déclenche `POST /api/recurring/generate` au montage

### Transactions
- Server Component avec filtres URL-driven : `?month=YYYY-MM&type=expense&category=uuid&q=text&sort=date&order=desc&page=1`
- Pagination 20 items/page, gérée côté serveur
- Formulaire dans un `Sheet` shadcn (droite) — Client Component React Hook Form + Zod
- Suppression via `AlertDialog` de confirmation
- Indicateur couleur : texte vert pour revenus, rouge pour dépenses (pas de fond coloré — sobre)
- Tri server-side sur `date`, `amount`, `category.name`

### Catégories (gérées depuis Profil)
- Catégories par défaut : affichées en read-only, non supprimables
- Catégories custom : CRUD complet
- Formulaire custom : nom + picker icône Lucide (sous-ensemble 40 icônes) + palette 12 couleurs fixes

### Récap mensuel
- Sélecteur mois/année (navigation précédent/suivant)
- Server Component fetch tout le mois sélectionné
- Cards : Revenus, Dépenses, Solde, Taux d'épargne `= (revenus - dépenses) / revenus * 100` (afficher "—" si revenus = 0)
- Comparaison mois précédent : diff absolue + pourcentage (calculé server-side)
- Tableau catégories : nom, montant, % du total, barre de progression shadcn
- Bar chart horizontal Recharts : top 5 catégories dépenses
- Liste complète transactions du mois (même composant que Transactions, filtré)

### Budgets
- Grille de cartes par catégorie (mois en cours)
- Chaque carte : catégorie, budget défini, montant dépensé, barre de progression
  - Vert si < 80% du budget
  - Orange si 80–100%
  - Rouge si > 100% (badge "Dépassé")
- Formulaire inline (popover) pour créer/modifier un budget par catégorie
- Widget "Alertes budget" sur le dashboard si ≥ 1 catégorie dépasse son budget

### Import Excel/CSV
Wizard 3 étapes (même page, pas de navigation) :

**Étape 1 — Upload**
- Drag & drop ou bouton, accepte `.xlsx` et `.csv`
- SheetJS parse le fichier, affiche tableau preview (5 premières lignes + headers)

**Étape 2 — Mapping**
- Pour chaque colonne détectée : dropdown pour assigner `montant` / `date` / `description` / `catégorie` / `ignorer`
- Option : sens des montants (positif = revenu OU positif = dépense)
- Option : format date si ambigu (DD/MM/YYYY, MM/DD/YYYY, ISO)
- Catégorie mappée : si la valeur de la colonne correspond à un nom de catégorie existante → auto-assignée, sinon → catégorie "Autre"

**Étape 3 — Validation & Import**
- Validation Zod sur chaque ligne (montant numérique, date valide, type déductible)
- Détection doublons : hash `date + montant + description` comparé aux transactions existantes
- Résumé avant confirmation : "X à importer, Y doublons ignorés, Z erreurs"
- Insertion batch sur confirmation
- Toast final avec résumé

### Récurrents
- Liste avec colonnes : nom, catégorie, montant, fréquence, prochaine occurrence (calculée : `last_generated` + intervalle de fréquence, ou `start_date` si jamais générée), statut
- Toggle actif/inactif inline
- Montant total mensuel estimé (somme des actives, annuelles divisées par 12)
- Formulaire Sheet : nom, type, montant, catégorie, fréquence, date de début
- Mécanisme génération (`/api/recurring/generate`) :
  - Fetch toutes les récurrentes actives de l'utilisateur
  - Pour chaque récurrente, calcule les occurrences manquantes entre `last_generated` (ou `start_date`) et aujourd'hui
  - Insert transactions manquantes avec `is_recurring_instance = true` et `recurring_id`
  - Update `last_generated` à aujourd'hui
  - Idempotent : vérifie l'existence avant d'insérer

---

## 4. UI/UX

### Design system
- shadcn/ui thème `zinc`, CSS variables overridées dans `globals.css`
- Couleurs sémantiques :
  - Accent primaire : `#4F46E5` (indigo)
  - Positif/revenus : `#10B981` (émeraude)
  - Négatif/dépenses : `#EC4899` (rose)
- `next-themes` avec `defaultTheme="system"`, toggle manuel Sun/Moon dans sidebar
- Police : Inter (Google Fonts), preload avec `font-display: swap`
- Pas d'emojis — icônes Lucide React partout

### Navigation
**Desktop (≥ lg / 1024px) :**
```
Sidebar 220px fixe
├── Logo / nom app (haut)
├── Dashboard
├── Transactions
├── Récap mensuel
├── Budgets
├── ── Outils ──
├── Récurrents
├── Import
└── Profil + toggle dark/light (bas)
```

**Mobile (< lg) :**
- Sidebar masquée, bottom navbar avec 4 items : Dashboard, Transactions, Récap, Profil
- FAB (+) flottant pour ajout rapide de transaction (ouvre un Sheet)
- Récurrents + Import accessibles depuis la page Profil

### Composants UI récurrents
- **Sheet** (shadcn) : formulaires de création/édition (TransactionForm, RecurringForm, CategoryForm)
- **AlertDialog** : confirmations de suppression
- **Skeleton** : `<CardSkeleton>`, `<ChartSkeleton>`, `<TransactionRowSkeleton>` dans tous les Suspense
- **Toast** (sonner) : toutes les actions CRUD, erreurs, succès import
- **Badge** : statut transaction (revenu/dépense), statut budget (dépassé), statut récurrent (actif/inactif)
- **Progress** (shadcn) : barres budget colorées selon le taux

### Animations
- Transitions de page : `fade + translateY(8px)` via Framer Motion dans le layout `(app)`
- Hover cartes : `scale(1.01)` + ombre légère — CSS pur
- Durée max : 0.3s, easing `cubic-bezier(0.16, 1, 0.3, 1)`
- `prefers-reduced-motion` respecté (Framer Motion le gère nativement)

### Responsive
- Mobile-first, breakpoints : `sm:640px`, `md:768px`, `lg:1024px`
- Cards dashboard : 1 col mobile → 3 col desktop
- Tableaux : scroll horizontal sur mobile
- Touch targets minimum 44×44px

---

## 5. PWA

- **`next-pwa`** avec Workbox
- **`manifest.json`** :
  - `name`: "FinanceApp", `short_name`: "Finance"
  - `display`: "standalone"
  - `theme_color`: "#4F46E5"
  - `background_color`: "#ffffff"
  - Icônes : 192×192 + 512×512 (PNG)
- **Cache strategy** :
  - Pages : `NetworkFirst` (données toujours fraîches)
  - Assets statiques (JS/CSS/images) : `CacheFirst`
  - API Supabase : pas de cache (données financières = toujours fraîches)
- **Bannière "Installer l'app"** :
  - Android/Chrome : écoute `beforeinstallprompt`, affiche un banner dismissable
  - iOS/Safari : détecte `navigator.standalone === false` + user agent Safari, affiche message "Appuyez sur Partager puis Ajouter à l'écran d'accueil"
  - État dismissed mémorisé en `localStorage`

---

## 6. Décisions actées

| Sujet | Décision |
|---|---|
| Récurrents | API Route `/api/recurring/generate` déclenchée par `useEffect` au load dashboard |
| Emojis | Aucun — icônes Lucide React partout, y compris les catégories |
| Navigation | Sidebar groupée desktop, bottom navbar mobile |
| Thème par défaut | Light (détection système + toggle manuel) |
| Data fetching | Server Components + Server Actions (approche hybride) |
| Catégories custom | Picker icône Lucide (40 icônes) + palette 12 couleurs fixes |
| Pagination | URL-driven, 20 items/page, server-side |
| Doublons import | Hash `date + montant + description` |
| Déploiement | Vercel (Next.js) + Supabase free tier |
