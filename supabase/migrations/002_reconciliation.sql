-- Expense reconciliation ("pointage")
-- Lets users mark an expense as actually debited from their bank account.

-- Per-user setting: enable the reconciliation UI on the Transactions page.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reconcile_expenses BOOLEAN DEFAULT false;

-- Per-transaction flag: expense has been debited (checked off).
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_pointed BOOLEAN DEFAULT false;
