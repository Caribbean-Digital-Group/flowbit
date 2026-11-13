import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  RevenueLedgerView,
  SalesDatabase,
  SalesKpis
} from '~/types/sales.types'

/**
 * Reportes de ventas en base de caja: el ingreso es lo cobrado, en la fecha
 * del cobro (decisión de negocio). Todo se calcula en la base de datos.
 */
export const useSalesReport = () => {
  const supabase = useSupabase() as unknown as SupabaseClient<SalesDatabase>
  const lastError = ref<string | null>(null)

  /** KPIs del periodo [from, to] (fechas `YYYY-MM-DD`, ambas incluidas). */
  const getSalesKpis = async (companyId: string, from: string, to: string): Promise<SalesKpis | null> => {
    if (!companyId) return null
    lastError.value = null

    const { data, error } = await supabase.rpc(
      'get_sales_kpis' as never,
      { p_company_id: companyId, p_from: from, p_to: to } as never
    )

    if (error) {
      console.error('Error fetching sales KPIs:', error)
      lastError.value = error.code === '42883'
        ? 'La base de datos aún no tiene los reportes de ventas. Aplica las migraciones pendientes con «npm run db:push».'
        : (error.message?.trim() || 'No se pudo calcular el reporte.')
      return null
    }

    return data as unknown as SalesKpis
  }

  /** Asientos del libro de ingresos del periodo, para exportar. */
  const getRevenueLedger = async (companyId: string, from: string, to: string): Promise<RevenueLedgerView[]> => {
    if (!companyId) return []

    const toExclusive = new Date(`${to}T00:00:00`)
    toExclusive.setDate(toExclusive.getDate() + 1)

    // Por bloques: sin esto la exportación contable se cortaba en 1000 asientos.
    // La vista no tiene id; el desempate usa las columnas que identifican el asiento.
    const { data, error } = await fetchAllRows((rangeFrom, rangeTo) => supabase
      .from('v_revenue_ledger')
      .select('*')
      .eq('company_id', companyId)
      .gte('occurred_at', `${from}T00:00:00`)
      .lt('occurred_at', toExclusive.toISOString())
      .order('occurred_at', { ascending: true })
      .order('source', { ascending: true })
      .order('kind', { ascending: true })
      .order('document_id', { ascending: true })
      .order('product_id', { ascending: true })
      .range(rangeFrom, rangeTo))

    if (error) {
      console.error('Error fetching revenue ledger:', error)
      return []
    }

    return data as RevenueLedgerView[]
  }

  return { lastError, getSalesKpis, getRevenueLedger }
}
