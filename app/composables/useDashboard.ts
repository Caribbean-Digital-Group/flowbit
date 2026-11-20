import type { DashboardSnapshot } from '~/utils/dashboardSnapshot'
import { normalizeDashboardSnapshot } from '~/utils/dashboardSnapshot'
import type { DateRange } from '~/utils/dashboard'

export interface DashboardSnapshotRequest {
  range: DateRange
  comparison: DateRange | null
  /** `YYYY-MM-DD` de hoy en hora local. */
  today: string
  /** Zona IANA del navegador (p. ej. `America/Mexico_City`). */
  timeZone: string
}

export interface DashboardSnapshotResult {
  snapshot: DashboardSnapshot | null
  /** El RPC no existe todavía (migraciones pendientes): usar el respaldo. */
  missing: boolean
}

/** 42883 función inexistente (Postgres) · PGRST202 función fuera del caché de PostgREST. */
const isMissingFunction = (code: string | undefined): boolean =>
  code === '42883' || code === 'PGRST202'

/**
 * Tablero principal (TRY-33): una sola llamada a `get_dashboard_snapshot`
 * reemplaza los ocho listados completos que se descargaban antes.
 */
export const useDashboard = () => {
  const supabase = useSupabase()

  const getSnapshot = async (
    companyId: string,
    request: DashboardSnapshotRequest
  ): Promise<DashboardSnapshotResult> => {
    if (!companyId) return { snapshot: null, missing: false }

    // El RPC es nuevo: hasta correr `db:types` no aparece en los tipos generados.
    const { data, error } = await supabase.rpc(
      'get_dashboard_snapshot' as never,
      {
        p_company_id: companyId,
        p_from: request.range.from,
        p_to: request.range.to,
        p_compare_from: request.comparison?.from ?? null,
        p_compare_to: request.comparison?.to ?? null,
        p_today: request.today,
        p_tz: request.timeZone
      } as never
    )

    if (error) {
      if (isMissingFunction(error.code)) return { snapshot: null, missing: true }
      console.error('Error fetching dashboard snapshot:', error)
      return { snapshot: null, missing: false }
    }

    return {
      snapshot: data ? normalizeDashboardSnapshot(data as unknown as DashboardSnapshot) : null,
      missing: false
    }
  }

  return { getSnapshot }
}
