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
