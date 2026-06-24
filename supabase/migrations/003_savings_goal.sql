-- Monthly savings goal: target amount the user wants to set aside each month.
-- Progress is computed on the dashboard from the month's net balance.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS monthly_savings_goal NUMERIC(12,2) DEFAULT 0;
