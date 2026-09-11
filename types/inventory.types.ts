/**
 * Tipos del módulo de trazabilidad de inventario.
 *
 * `types/database.types.ts` no puede regenerarse desde esta sesión, así que
 * este shim replica el shape de las tablas y vistas creadas en la migración
 * `20260911120000_create_inventory_traceability_module`.
 *
 * Tras correr `npm run db:types` pueden sustituirse por `Tables<'stock_move'>`
 * y este archivo puede eliminarse.
 */
import type { Database } from './database.types'

export type StockMoveType = 'in' | 'out'

export type StockMoveOrigin =
  | 'initial'
  | 'purchase'
  | 'sale'
  | 'pos'
  | 'storefront'
  | 'return_in'
  | 'return_out'
  | 'adjustment'
  | 'manual'

export type StockStatus = 'ok' | 'low' | 'out' | 'negative'

export type StockMoveRow = {
  id: string
  company_id: string
  product_id: string
  warehouse_id: string | null
  move_type: StockMoveType
  origin: StockMoveOrigin
  quantity: number
  signed_quantity: number
  unit_cost: number
  total_cost: number
  balance_after: number
  avg_cost_after: number
  picking_id: string | null
  picking_line_id: string | null
  order_id: string | null
  lot_name: string | null
  serial_number: string | null
  reference: string | null
  notes: string | null
  occurred_at: string
  created_at: string | null
  created_by: string | null
}

/** Fila de `v_stock_moves`: el asiento con los nombres ya resueltos. */
export type StockMoveView = StockMoveRow & {
  product_name: string
  product_sku: string | null
  warehouse_name: string | null
  warehouse_code: string | null
  picking_name: string | null
  picking_type: string | null
  order_name: string | null
  order_type: string | null
}

/** Fila de `v_product_stock`: existencias, valoración y semáforo. */
export type ProductStockView = {
  id: string
  company_id: string
  name: string
  sku: string | null
  barcode: string | null
  category_id: string | null
  category_name: string | null
  product_type: string
  status: string
  is_stockable: boolean | null
  tracking: string | null
  stock_quantity: number
  stock_min: number
  stock_max: number | null
  cost_price: number
  unit_cost: number
  stock_value: number
  sale_price: number
  retail_value: number
  stock_status: StockStatus
  suggested_restock: number
  last_move_at: string | null
  active: boolean | null
  created_at: string | null
  updated_at: string | null
}

export type InventorySettingsRow = {
  id: string
  company_id: string
  auto_restock_tasks: boolean
  restock_responsible_partner_id: string | null
  restock_project_id: string | null
  restock_lead_days: number
  active: boolean | null
  created_at: string | null
  updated_at: string | null
  created_by: string | null
  updated_by: string | null
}

export type InventorySettingsUpdate = Partial<InventorySettingsRow> & { company_id: string }

// ── Formas devueltas por los RPC ────────────────────────────────────────────

export interface InventoryTotals {
  product_count: number
  units_on_hand: number
  stock_value: number
  retail_value: number
  potential_margin: number
  low_count: number
  out_count: number
  negative_count: number
  ok_count: number
  /** Productos con existencias pero sin costo capturado: distorsionan la valoración. */
  uncosted_count: number
}

export interface InventoryCategoryBreakdown {
  category_id: string | null
  category_name: string
  product_count: number
  units: number
  stock_value: number
}

export interface InventoryWarehouseBreakdown {
  warehouse_id: string | null
  warehouse_name: string
  units: number
  stock_value: number
  product_count: number
}

export interface InventoryAlert {
  id: string
  name: string
  sku: string | null
  stock_quantity: number
  stock_min: number
  suggested_restock: number
  stock_status: StockStatus
  unit_cost: number
}

export interface InventorySummary {
  status: 'ok'
  totals: InventoryTotals
  by_category: InventoryCategoryBreakdown[]
  by_warehouse: InventoryWarehouseBreakdown[]
  alerts: InventoryAlert[]
  generated_at: string
}

export interface StockCardMove {
  id: string
  occurred_at: string
  move_type: StockMoveType
  origin: StockMoveOrigin
  quantity: number
  signed_quantity: number
  unit_cost: number
  total_cost: number
  balance_after: number
  warehouse_name: string | null
  picking_id: string | null
  picking_name: string | null
  order_id: string | null
  order_name: string | null
  lot_name: string | null
  serial_number: string | null
  reference: string | null
  notes: string | null
}

export interface StockCard {
  status: 'ok' | 'not_found'
  product: ProductStockView | null
  summary: {
    total_in: number
    total_out: number
    move_count: number
    first_move_at: string | null
    last_move_at: string | null
  }
  moves: StockCardMove[]
}

export interface StockAdjustmentResult {
  status: 'ok' | 'unchanged'
  move_id?: string
  difference?: number
  stock_quantity: number
}

export interface WarehouseStockProduct {
  product_id: string
  name: string
  sku: string | null
  quantity: number
  unit_cost: number
  stock_value: number
  stock_min: number
  last_move_at: string | null
  /** Saldo del producto en toda la empresa, para comparar con el de este almacén. */
  company_total: number
}

export interface WarehouseStock {
  status: 'ok' | 'not_found'
  warehouse: { id: string; name: string; code: string | null }
  totals: { product_count: number; units: number; stock_value: number }
  products: WarehouseStockProduct[]
}

export interface RestockTaskResult {
  status: 'ok'
  pending_tasks: number
  closed_tasks: number
}

/**
 * Cliente de Supabase extendido con las tablas y vistas del inventario,
 * para conservar la inferencia de tipos sin recurrir a `any`.
 */
export type InventoryDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables' | 'Views'> & {
    Tables: Database['public']['Tables'] & {
      stock_move: {
        Row: StockMoveRow
        Insert: Partial<StockMoveRow> & { company_id: string; product_id: string }
        Update: Partial<StockMoveRow>
        Relationships: []
      }
      inventory_settings: {
        Row: InventorySettingsRow
        Insert: InventorySettingsUpdate
        Update: Partial<InventorySettingsRow>
        Relationships: []
      }
    }
    Views: Database['public']['Views'] & {
      v_stock_moves: { Row: StockMoveView; Relationships: [] }
      v_product_stock: { Row: ProductStockView; Relationships: [] }
    }
  }
}
