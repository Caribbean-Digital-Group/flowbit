import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgingReport, PartnerStatement } from '~/utils/receivables'

export type BalanceKind = 'sale' | 'purchase'

/**
 * Cuentas por cobrar (ventas) y por pagar (compras): antigüedad de saldos y
 * estado de cuenta por contacto. Todo se agrega en la base de datos
 * (`get_aging_report`, `get_partner_statement`); este composable solo llama
 * los RPC y traduce los errores a mensajes en español.
 *
 * Las funciones aún no están en `database.types.ts`: tras `npm run db:types`
 * se pueden quitar los casts `as never`.
 */
export const useReceivables = () => {
  const supabase = useSupabase() as unknown as SupabaseClient
  const lastError = ref<string | null>(null)

  const describeError = (error: { code?: string; message?: string }): string =>
    error.code === '42883' || error.code === 'PGRST202'
      ? 'La base de datos aún no tiene el reporte de cuentas por cobrar. Aplica las migraciones pendientes con «npm run db:push».'
      : (error.message?.trim() || 'No se pudo calcular el reporte.')

  /** Saldo abierto por contacto en cubetas de antigüedad, a la fecha de corte. */
  const getAgingReport = async (
    companyId: string,
    kind: BalanceKind = 'sale',
    asOf?: string
  ): Promise<AgingReport | null> => {
    if (!companyId) return null
    lastError.value = null
    const { data, error } = await supabase.rpc(
      'get_aging_report' as never,
      { p_company_id: companyId, p_order_type: kind, ...(asOf ? { p_as_of: asOf } : {}) } as never
    )
    if (error) {
      console.error('Error fetching aging report:', error)
      lastError.value = describeError(error)
      return null
    }
    return data as unknown as AgingReport
  }

  /** Movimientos y órdenes abiertas de un contacto. `from` opcional (`YYYY-MM-DD`). */
  const getPartnerStatement = async (
    companyId: string,
    partnerId: string,
    kind: BalanceKind = 'sale',
    from?: string | null,
    asOf?: string
  ): Promise<PartnerStatement | null> => {
    if (!companyId || !partnerId) return null
    lastError.value = null
    const { data, error } = await supabase.rpc(
      'get_partner_statement' as never,
      {
        p_company_id: companyId,
        p_partner_id: partnerId,
        p_order_type: kind,
        p_from: from || null,
        ...(asOf ? { p_as_of: asOf } : {})
      } as never
    )
    if (error) {
      console.error('Error fetching partner statement:', error)
      lastError.value = describeError(error)
      return null
    }
    return data as unknown as PartnerStatement
  }

  return { getAgingReport, getPartnerStatement, lastError }
}
