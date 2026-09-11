import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  StorefrontDatabase,
  StorefrontSettingsRow,
  StorefrontSettingsUpdate
} from '~/types/storefront.types'

/**
 * CRUD de la configuración de la tienda en línea (storefront_settings).
 * Una fila por empresa; se crea bajo demanda con upsert.
 * El cast del cliente es temporal hasta regenerar database.types.ts.
 */
export const useStorefrontSettings = () => {
  const supabase = useSupabase() as unknown as SupabaseClient<StorefrontDatabase>

  /** Último error de escritura, para poder explicarlo en la interfaz. */
  const lastError = ref<string | null>(null)

  const getByCompany = async (companyId: string): Promise<StorefrontSettingsRow | null> => {
    if (!companyId) return null

    const { data, error } = await supabase
      .from('storefront_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching storefront settings:', error)
      return null
    }

    return data
  }

  const upsertForCompany = async (
    companyId: string,
    updates: StorefrontSettingsUpdate
  ): Promise<StorefrontSettingsRow | null> => {
    if (!companyId) return null
    const user = await useSupabaseUser()

    const { data, error } = await supabase
      .from('storefront_settings')
      .upsert(
        { ...updates, company_id: companyId, updated_by: user?.id ?? null },
        { onConflict: 'company_id' }
      )
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error saving storefront settings:', error)
      // 42703 = columna inexistente: falta aplicar una migración en la base.
      lastError.value = error.code === '42703'
        ? 'La base de datos no tiene las columnas de diseño de la tienda. Aplica las migraciones pendientes con «npm run db:push».'
        : error.message
      return null
    }

    lastError.value = null
    return data
  }

  return { getByCompany, upsertForCompany, lastError }
}
