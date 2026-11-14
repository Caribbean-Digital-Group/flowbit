import type { Database } from './database.types'

/**
 * Tipos temporales del módulo de Gastos (TRY-10).
 *
 * `types/database.types.ts` aún no incluye las tablas de la migración
 * `20261114120000_create_expense_tables`. Este shim replica el shape que
 * generará Supabase para mantener TypeScript estricto sin `any`.
 *
 * Tras correr `npm run db:push && npm run db:types` pueden sustituirse por
 * `Tables<'expense'>`, `Tables<'expense_category'>`, etc., y este archivo
 * puede eliminarse.
 *
 * Solo tipos: las constantes viven en `app/utils/expenses.ts`.
 */

type Audit = {
  active: boolean | null
  created_at: string | null
  updated_at: string | null
  created_by: string | null
  updated_by: string | null
}

type Table<Row, Insert, Update> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export type ExpenseStatus = 'draft' | 'approved' | 'paid' | 'cancelled'

// ─── expense_category ───────────────────────────────────────────────────────

export type ExpenseCategoryRow = Audit & {
  id: string
  company_id: string
  name: string
  description: string | null
  color: string | null
}

export type ExpenseCategoryInsert = Partial<ExpenseCategoryRow> & { company_id: string; name: string }
export type ExpenseCategoryUpdate = Partial<ExpenseCategoryRow>

// ─── expense ────────────────────────────────────────────────────────────────

export type ExpenseRow = Audit & {
  id: string
  company_id: string
  expense_date: string
  description: string
  category_id: string | null
  partner_id: string | null
  project_id: string | null
  payment_method_id: string | null
  amount: number
  tax_amount: number
  currency: string | null
  reference: string | null
  notes: string | null
  status: ExpenseStatus
  paid_at: string | null
}

export type ExpenseInsert = Partial<ExpenseRow> & { company_id: string; description: string; amount: number }
export type ExpenseUpdate = Partial<ExpenseRow>

/** Cliente de Supabase extendido con las tablas de Gastos. */
export type ExpenseDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables'> & {
    Tables: Database['public']['Tables'] & {
      expense_category: Table<ExpenseCategoryRow, ExpenseCategoryInsert, ExpenseCategoryUpdate>
      expense: Table<ExpenseRow, ExpenseInsert, ExpenseUpdate>
    }
  }
}
