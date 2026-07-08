import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AnalyticsDatabase,
  StorefrontAnalyticsDailyRow,
  StorefrontAnalyticsDailyDimRow,
  StorefrontAnalyticsJobRunRow
} from '~/types/analytics.types'

/**
 * Consultas del panel de analítica del storefront.
 *
 * Lee exclusivamente tablas agregadas (rollups) protegidas por RLS — nunca
 * escanea eventos crudos, salvo el contador de visitantes activos que usa
 * un RPC acotado a los últimos 5 minutos. El cast del cliente es temporal
 * hasta regenerar database.types.ts (mismo patrón que el resto del módulo).
 */
export const useStorefrontAnalyticsReport = () => {
  const supabase = useSupabase() as unknown as SupabaseClient<AnalyticsDatabase>

  /** Serie diaria de KPIs en el rango [from, to] (fechas YYYY-MM-DD, UTC). */
  const getDailySeries = async (
    companyId: string,
    from: string,
    to: string
  ): Promise<StorefrontAnalyticsDailyRow[]> => {
    if (!companyId) return []

    const { data, error } = await supabase
      .from('storefront_analytics_daily')
      .select('*')
      .eq('company_id', companyId)
      .gte('day', from)
      .lte('day', to)
      .order('day')

    if (error) {
      console.error('Error fetching analytics daily series:', error)
      return []
    }
    return data ?? []
  }

  /** Rollups por dimensión (páginas, productos, fuentes...) en el rango. */
  const getDimensions = async (
    companyId: string,
    from: string,
    to: string,
    dims: StorefrontAnalyticsDailyDimRow['dim'][]
  ): Promise<StorefrontAnalyticsDailyDimRow[]> => {
    if (!companyId || !dims.length) return []

    const { data, error } = await supabase
      .from('storefront_analytics_daily_dim')
      .select('*')
      .eq('company_id', companyId)
      .in('dim', dims)
      .gte('day', from)
      .lte('day', to)

    if (error) {
      console.error('Error fetching analytics dimensions:', error)
      return []
    }
    return data ?? []
  }

  /**
   * KPIs recalculados desde la tabla de sesiones (agregado derivado, no
   * eventos crudos) para segmentar por dispositivo. Se usa solo cuando el
   * panel tiene un segmento activo; el camino por defecto lee los rollups.
   */
  const getSegmentKpis = async (
    companyId: string,
    from: string,
    to: string,
    device: string
  ): Promise<{
    sessions: number
    visitors: number
    newVisitors: number
    bounceSessions: number
    totalSeconds: number
    convertedSessions: number
    orders: number
    revenue: number
    pageViews: number
  } | null> => {
    if (!companyId) return null

    const { data, error } = await supabase
      .from('storefront_session')
      .select('anonymous_id, is_new_visitor, is_bounce, converted, duration_seconds, page_views, order_count, revenue')
      .eq('company_id', companyId)
      .eq('device_type', device)
      .gte('started_at', `${from}T00:00:00Z`)
      .lte('started_at', `${to}T23:59:59Z`)
      .limit(10000)

    if (error) {
      console.error('Error fetching segmented analytics KPIs:', error)
      return null
    }

    const rows = data ?? []
    const visitors = new Set(rows.map((row) => row.anonymous_id).filter(Boolean)).size
    return rows.reduce(
      (acc, row) => {
        acc.sessions += 1
        acc.newVisitors += row.is_new_visitor ? 1 : 0
        acc.bounceSessions += row.is_bounce ? 1 : 0
        acc.totalSeconds += row.duration_seconds ?? 0
        acc.convertedSessions += row.converted ? 1 : 0
        acc.orders += row.order_count ?? 0
        acc.revenue += Number(row.revenue ?? 0)
        acc.pageViews += row.page_views ?? 0
        return acc
      },
      {
        sessions: 0,
        visitors,
        newVisitors: 0,
        bounceSessions: 0,
        totalSeconds: 0,
        convertedSessions: 0,
        orders: 0,
        revenue: 0,
        pageViews: 0
      }
    )
  }

  /** Visitantes con actividad en los últimos 5 minutos (cuasi tiempo real). */
  const getActiveVisitors = async (companyId: string): Promise<number> => {
    if (!companyId) return 0

    const { data, error } = await supabase.rpc(
      'get_storefront_active_visitors' as never,
      { p_company_id: companyId } as never
    )

    if (error) {
      console.error('Error fetching active visitors:', error)
      return 0
    }
    return (data as number | null) ?? 0
  }

  /**
   * Dispara los jobs de sesionización + rollup bajo demanda. El servidor
   * aplica un throttle de 5 minutos, así que es seguro llamarlo al abrir
   * el panel (complementa o reemplaza a pg_cron).
   */
  const refresh = async (): Promise<{ status: string } | null> => {
    const { data, error } = await supabase.rpc('run_storefront_analytics_jobs' as never)

    if (error) {
      console.error('Error refreshing analytics rollups:', error)
      return null
    }
    return data as { status: string } | null
  }

  /** Última ejecución registrada del pipeline (observabilidad). */
  const getLastJobRun = async (): Promise<StorefrontAnalyticsJobRunRow | null> => {
    const { data, error } = await supabase
      .from('storefront_analytics_job_run')
      .select('*')
      .eq('job_name', 'analytics_refresh')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Error fetching analytics job run:', error)
      return null
    }
    return data
  }

  return { getDailySeries, getDimensions, getSegmentKpis, getActiveVisitors, refresh, getLastJobRun }
}
