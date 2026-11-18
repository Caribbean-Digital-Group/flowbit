import type { Database } from './database.types'
import type { StockCountStatus } from '../app/utils/stockCount'

/**
 * Tipos temporales del conteo físico de inventario (TRY-42).
 *
 * `types/database.types.ts` aún no incluye las tablas ni los RPC de la
 * migración `20261118120000_create_stock_count`. Este shim replica el shape
 * que generará Supabase para mantener TypeScript estricto sin `any`.
 *
 * Tras correr `npm run db:push && npm run db:types` pueden sustituirse por
 * `Tables<'stock_count'>` y `Tables<'stock_count_line'>`, y este archivo
 * puede eliminarse.
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

export type StockCountRow = Audit & {
  id: string
  company_id: string
  reference: string
  warehouse_id: string
  category_id: string | null
  status: StockCountStatus
  notes: string | null
  started_at: string
  applied_at: string | null
  applied_by: string | null
  cancelled_at: string | null
}

export type StockCountLineRow = Audit & {
  id: string
  company_id: string
  stock_count_id: string
  product_id: string
  expected_quantity: number
  unit_cost: number
  counted_quantity: number | null
  counted_at: string | null
  counted_by: string | null
  adjusted_quantity: number | null
  stock_move_id: string | null
}

/** Las tablas solo se escriben por RPC: Insert/Update no se usan desde el cliente. */
type ReadOnly = Record<string, never>

export interface ApplyStockCountResult {
  status: 'applied'
  reference: string
  adjusted_lines: number
  skipped_lines: number
  clamped_lines: number
  adjustment_value: number
}

/** Cliente de Supabase extendido con las tablas y RPC del conteo físico. */
export type StockCountDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables' | 'Functions'> & {
    Tables: Database['public']['Tables'] & {
      stock_count: Table<StockCountRow, ReadOnly, ReadOnly>
      stock_count_line: Table<StockCountLineRow, ReadOnly, ReadOnly>
    }
    Functions: Database['public']['Functions'] & {
      start_stock_count: {
        Args: { p_warehouse_id: string; p_category_id?: string | null; p_notes?: string | null }
        Returns: string
      }
      set_stock_count_line: {
        Args: { p_line_id: string; p_counted: number | null }
        Returns: undefined
      }
      apply_stock_count: {
        Args: { p_count_id: string; p_uncounted_as_zero?: boolean }
        Returns: ApplyStockCountResult
      }
      cancel_stock_count: {
        Args: { p_count_id: string }
        Returns: undefined
      }
    }
  }
}
