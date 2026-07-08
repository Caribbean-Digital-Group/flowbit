import type { Database } from './database.types'

/**
 * Tipos temporales del módulo storefront.
 *
 * `types/database.types.ts` aún no incluye las tablas creadas en la migración
 * `20260707120000_create_storefront_module` (el CLI no pudo regenerarlos desde
 * esta sesión). Este shim replica el shape que generará Supabase para poder
 * mantener TypeScript estricto sin `any`.
 *
 * Cuando se regenere `npm run db:types`, estos alias pueden sustituirse por
 * `Tables<'storefront_settings'>`, etc., y este archivo puede eliminarse.
 */

export type StorefrontSettingsRow = {
  id: string
  company_id: string
  is_active: boolean
  hero_title: string | null
  hero_subtitle: string | null
  announcement: string | null
  about_text: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_address: string | null
  whatsapp_phone: string | null
  policy_shipping: string | null
  policy_returns: string | null
  policy_privacy: string | null
  policy_terms: string | null
  show_out_of_stock: boolean
  active: boolean | null
  created_at: string | null
  updated_at: string | null
  created_by: string | null
  updated_by: string | null
}

export type StorefrontSettingsInsert = Partial<StorefrontSettingsRow> & { company_id: string }
export type StorefrontSettingsUpdate = Partial<StorefrontSettingsRow>

export type StorefrontShippingMethodRow = {
  id: string
  company_id: string
  name: string
  description: string | null
  price: number
  delivery_estimate: string | null
  display_order: number | null
  active: boolean | null
  created_at: string | null
  updated_at: string | null
  created_by: string | null
  updated_by: string | null
}

export type StorefrontShippingMethodInsert =
  Partial<StorefrontShippingMethodRow> & { company_id: string; name: string }
export type StorefrontShippingMethodUpdate = Partial<StorefrontShippingMethodRow>

export type StorefrontCouponRow = {
  id: string
  company_id: string
  code: string
  description: string | null
  discount_type: 'percent' | 'fixed'
  discount_value: number
  min_purchase: number | null
  usage_limit: number | null
  usage_count: number
  starts_at: string | null
  expires_at: string | null
  active: boolean | null
  created_at: string | null
  updated_at: string | null
  created_by: string | null
  updated_by: string | null
}

export type StorefrontCouponInsert =
  Partial<StorefrontCouponRow> & { company_id: string; code: string; discount_value: number }
export type StorefrontCouponUpdate = Partial<StorefrontCouponRow>

/**
 * Esquema para castear el cliente de Supabase mientras `database.types.ts`
 * no incluye las tablas del storefront: extiende el Database generado
 * agregando solo las tablas nuevas, para conservar la inferencia de
 * supabase-js (select, insert, update) intacta.
 */
export type StorefrontDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables'> & {
    Tables: Database['public']['Tables'] & {
      storefront_settings: {
        Row: StorefrontSettingsRow
        Insert: StorefrontSettingsInsert
        Update: StorefrontSettingsUpdate
        Relationships: []
      }
      storefront_shipping_method: {
        Row: StorefrontShippingMethodRow
        Insert: StorefrontShippingMethodInsert
        Update: StorefrontShippingMethodUpdate
        Relationships: []
      }
      storefront_coupon: {
        Row: StorefrontCouponRow
        Insert: StorefrontCouponInsert
        Update: StorefrontCouponUpdate
        Relationships: []
      }
    }
  }
}
