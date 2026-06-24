export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; full_name: string | null; currency: string; reconcile_expenses: boolean; created_at: string }
        Insert: { id: string; full_name?: string | null; currency?: string; reconcile_expenses?: boolean }
        Update: { full_name?: string | null; currency?: string; reconcile_expenses?: boolean }
        Relationships: []
      }
      categories: {
        Row: { id: string; user_id: string; name: string; icon_name: string | null; color: string | null; type: 'expense' | 'income' | 'both'; is_default: boolean; created_at: string }
        Insert: { user_id: string; name: string; icon_name?: string | null; color?: string | null; type?: 'expense' | 'income' | 'both'; is_default?: boolean }
        Update: { name?: string; icon_name?: string | null; color?: string | null; type?: 'expense' | 'income' | 'both' }
        Relationships: []
      }
      transactions: {
        Row: { id: string; user_id: string; amount: number; type: 'expense' | 'income'; category_id: string | null; description: string | null; date: string; is_recurring_instance: boolean; recurring_id: string | null; is_pointed: boolean; created_at: string }
        Insert: { user_id: string; amount: number; type: 'expense' | 'income'; category_id?: string | null; description?: string | null; date: string; is_recurring_instance?: boolean; recurring_id?: string | null; is_pointed?: boolean }
        Update: { amount?: number; type?: 'expense' | 'income'; category_id?: string | null; description?: string | null; date?: string; is_pointed?: boolean }
        Relationships: []
      }
      recurring_transactions: {
        Row: { id: string; user_id: string; name: string; amount: number; type: 'expense' | 'income'; category_id: string | null; frequency: 'weekly' | 'monthly' | 'yearly'; start_date: string; last_generated: string | null; is_active: boolean; created_at: string }
        Insert: { user_id: string; name: string; amount: number; type: 'expense' | 'income'; category_id?: string | null; frequency: 'weekly' | 'monthly' | 'yearly'; start_date: string; is_active?: boolean }
        Update: { name?: string; amount?: number; type?: 'expense' | 'income'; category_id?: string | null; frequency?: 'weekly' | 'monthly' | 'yearly'; start_date?: string; last_generated?: string | null; is_active?: boolean }
        Relationships: []
      }
      budgets: {
        Row: { id: string; user_id: string; category_id: string; amount: number; month: number; year: number; created_at: string }
        Insert: { user_id: string; category_id: string; amount: number; month: number; year: number }
        Update: { amount?: number }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
