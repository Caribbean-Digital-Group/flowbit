import type { StorefrontDatabase } from './storefront.types'

/**
 * Tipos temporales del módulo de analítica del storefront.
 *
 * Igual que `storefront.types.ts`: `types/database.types.ts` no puede
 * regenerarse desde esta sesión, así que este shim replica el shape que
 * generará Supabase para las tablas de la migración
 * `20260707140000_create_storefront_analytics_module`. Tras correr
 * `npm run db:types`, puede sustituirse por `Tables<'storefront_event'>`,
 * etc., y eliminarse.
 */

export type StorefrontEventRow = {
  id: string
  company_id: string
  event_name: string
  event_category: 'navigation' | 'interaction' | 'ecommerce' | 'custom'
  anonymous_id: string | null
  user_id: string | null
  session_id: string | null
  page_path: string | null
  page_title: string | null
  referrer: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  device_type: string | null
  browser: string | null
  os: string | null
  country: string | null
  language: string | null
  viewport: string | null
  value: number | null
  currency: string | null
  items: unknown[] | null
  order_id: string | null
  checkout_token: string | null
  properties: Record<string, unknown>
  client_ts: string | null
  server_ts: string
  created_at: string | null
}

export type StorefrontSessionRow = {
  id: string
  company_id: string
  session_id: string
  anonymous_id: string | null
  user_id: string | null
  started_at: string
  last_seen_at: string
  duration_seconds: number
  page_views: number
  events_count: number
  entry_path: string | null
  exit_path: string | null
  referrer: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  device_type: string | null
  browser: string | null
  os: string | null
  country: string | null
  is_new_visitor: boolean
  is_bounce: boolean
  converted: boolean
  order_count: number
  revenue: number
  created_at: string | null
  updated_at: string | null
}

export type StorefrontAnalyticsDailyRow = {
  id: string
  company_id: string
  day: string
  page_views: number
  sessions: number
  visitors: number
  new_visitors: number
  bounce_sessions: number
  total_session_seconds: number
  orders: number
  revenue: number
  refunds: number
  refund_amount: number
  converted_sessions: number
  funnel_view_item: number
  funnel_add_to_cart: number
  funnel_begin_checkout: number
  funnel_purchase: number
  created_at: string | null
  updated_at: string | null
}

export type StorefrontAnalyticsDailyDimRow = {
  id: string
  company_id: string
  day: string
  dim:
    | 'page'
    | 'product_view'
    | 'product_purchased'
    | 'source'
    | 'device'
    | 'browser'
    | 'country'
    | 'search'
    | 'event'
  dim_key: string
  dim_label: string | null
  hits: number
  uniques: number
  value: number
  created_at: string | null
}

export type StorefrontAnalyticsJobRunRow = {
  id: string
  job_name: string
  started_at: string
  finished_at: string | null
  rows_processed: number | null
  error: string | null
  created_at: string | null
}

type ReadOnlyTable<Row> = {
  Row: Row
  Insert: never
  Update: never
  Relationships: []
}

/**
 * Extiende StorefrontDatabase con las tablas de analítica (solo lectura
 * desde el cliente: la escritura pasa por RPCs SECURITY DEFINER).
 */
export type AnalyticsDatabase = Omit<StorefrontDatabase, 'public'> & {
  public: Omit<StorefrontDatabase['public'], 'Tables'> & {
    Tables: StorefrontDatabase['public']['Tables'] & {
      storefront_event: ReadOnlyTable<StorefrontEventRow>
      storefront_session: ReadOnlyTable<StorefrontSessionRow>
      storefront_analytics_daily: ReadOnlyTable<StorefrontAnalyticsDailyRow>
      storefront_analytics_daily_dim: ReadOnlyTable<StorefrontAnalyticsDailyDimRow>
      storefront_analytics_job_run: ReadOnlyTable<StorefrontAnalyticsJobRunRow>
    }
  }
}
