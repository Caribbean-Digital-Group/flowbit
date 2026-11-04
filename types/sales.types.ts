/**
 * Tipos del flujo comercial: entregas, libro de pagos, devoluciones,
 * existencias por almacén y reportes de ventas.
 *
 * Shim temporal (igual que `inventory.types.ts`): replica el shape de las
 * tablas, vistas y RPC de las migraciones
 *   20261103130000_sales_fulfillment_and_payments
 *   20261103140000_warehouse_stock_and_reservations
 *   20261103150000_sales_reports_crm_attribution
 * Tras correr `npm run db:types` puede sustituirse por `Tables<'order_payment'>`
 * y las vistas generadas, y este archivo puede eliminarse.
 */
import type { Database } from './database.types'

export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'condoned' | 'overdue'
export type DeliveryStatus = 'pending' | 'partial' | 'delivered' | 'no_delivery'
export type PaymentSource = 'dashboard' | 'pos' | 'stripe' | 'backfill'
export type OrderChannel = 'dashboard' | 'pos' | 'storefront'

/** Columnas que las migraciones agregan a `order` (aún no están en los tipos generados). */
export interface OrderSalesFields {
  origin: OrderChannel
  delivery_status: DeliveryStatus
  amount_paid: number
  amount_refunded: number
  warehouse_id: string | null
  payment_method_id: string | null
  payment_status: PaymentStatus
  paid_at: string | null
  balance_due: number
  payment_method_name: string | null
  warehouse_name: string | null
}

export interface OrderPaymentView {
  id: string
  company_id: string
  order_id: string
  payment_method_id: string | null
  amount: number
  paid_at: string
  source: PaymentSource
  pos_session_id: string | null
  pos_payment_id: string | null
  stripe_payment_intent_id: string | null
  refund_id: string | null
  reference: string | null
  notes: string | null
  active: boolean
  voided_at: string | null
  void_reason: string | null
  created_at: string | null
  created_by: string | null
  order_name: string | null
  order_type: 'sale' | 'purchase'
  order_origin: OrderChannel
  partner_id: string | null
  currency: string | null
  partner_name: string | null
  payment_method_name: string | null
  refund_name: string | null
  pos_session_name: string | null
}

export interface OrderRefundView {
  id: string
  company_id: string
  order_id: string
  name: string | null
  reason: string
  amount_untaxed: number
  amount_tax: number
  amount_total: number
  amount_reimbursed: number
  picking_id: string | null
  pos_session_id: string | null
  is_backfill: boolean
  active: boolean
  created_at: string | null
  created_by: string | null
  order_name: string | null
  order_origin: OrderChannel
  partner_id: string | null
  currency: string | null
  partner_name: string | null
  picking_name: string | null
}

export interface StockAvailabilityView {
  company_id: string
  product_id: string
  warehouse_id: string
  product_name: string | null
  product_sku: string | null
  tracking: 'none' | 'lot' | 'serial' | null
  warehouse_name: string | null
  warehouse_code: string | null
  on_hand: number
  reserved: number
  available: number
  updated_at: string | null
}

export type RevenueLedgerKind =
  | 'collection'
  | 'reimbursement'
  | 'supplier_payment'
  | 'supplier_refund'
  | 'cogs'
  | 'cogs_return'

export interface RevenueLedgerView {
  company_id: string
  occurred_at: string
  kind: RevenueLedgerKind
  order_type: 'sale' | 'purchase'
  channel: OrderChannel
  order_id: string
  order_name: string | null
  partner_id: string | null
  payment_method_id: string | null
  source: string | null
  document_id: string
  amount: number
  amount_net: number
  product_id: string | null
  quantity: number | null
}

// ── Respuestas de RPC ──────────────────────────────────────────────────────

export interface PrepareDeliveryResult {
  status: 'ok' | 'in_progress' | 'nothing_pending'
  picking_id: string | null
  created: boolean
}

export interface DeliveryShortage {
  product_id: string
  product_name: string
  pending: number
  available: number
}

export interface RegisterPaymentResult {
  payment_id: string
  amount_paid: number
  payment_status: PaymentStatus
  balance: number
}

export interface RefundLineInput {
  order_line_id: string
  quantity: number
  restock_quantity?: number
}

export interface RegisterRefundResult {
  refund_id: string
  refund_name: string
  refund_total: number
  reimbursed: number
  picking_id: string | null
  order_id: string
  order_name: string
}

export interface SalesKpiTotals {
  collected: number
  reimbursed: number
  net_collected: number
  net_revenue: number
  tax_collected: number
  cogs: number
  purchases_paid: number
  paying_orders: number
  units_sold: number
  gross_margin: number
  margin_percent: number
  net_cash_flow: number
  average_ticket: number
  currency: string
}

export interface SalesKpiChannel {
  channel: OrderChannel
  net_collected: number
  net_revenue: number
  cogs: number
  orders: number
}

export interface SalesKpiMonth {
  month: string
  income: number
  income_net: number
  expense: number
  cogs: number
  income_count: number
  expense_count: number
}

export interface SalesKpiPaymentMethod {
  payment_method_id: string | null
  name: string
  amount: number
  count: number
}

export interface SalesKpiProduct {
  product_id: string
  name: string
  units: number
  cogs: number
  revenue: number
}

export interface SalesKpiCampaign {
  utm_source: string
  utm_campaign: string
  net_collected: number
  orders: number
}

export interface SalesKpis {
  from: string
  to: string
  totals: SalesKpiTotals
  by_channel: SalesKpiChannel[]
  monthly: SalesKpiMonth[]
  by_payment_method: SalesKpiPaymentMethod[]
  top_products: SalesKpiProduct[]
  by_campaign: SalesKpiCampaign[]
  receivables: {
    total: number
    count: number
    current: number
    d1_30: number
    d31_60: number
    d61_90: number
    d90_plus: number
  }
  payables: { total: number; count: number }
  pending_deliveries: { orders: number; units: number; value: number }
  refunds: { count: number; total: number; reimbursed: number }
  orders_confirmed: { count: number; total: number; untaxed: number }
}

/** Cliente de Supabase con las vistas nuevas. */
export type SalesDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Views'> & {
    Views: Database['public']['Views'] & {
      v_order_payments: { Row: OrderPaymentView; Relationships: [] }
      v_order_refunds: { Row: OrderRefundView; Relationships: [] }
      v_stock_availability: { Row: StockAvailabilityView; Relationships: [] }
      v_revenue_ledger: { Row: RevenueLedgerView; Relationships: [] }
    }
  }
}
