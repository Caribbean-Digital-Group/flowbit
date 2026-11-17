import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchAllRows } from '~/utils/pagination'
import { createZip } from '~/utils/zip'
import {
  buildExportFilename,
  buildExportReadme,
  rowsToCsv,
  selectExportEntities,
  type DataExportEntity,
  type DataExportResult
} from '~/utils/dataExport'

type Row = Record<string, unknown>

interface ReadResult {
  rows: Row[]
  truncated: boolean
  error: string | null
}

/** Ids por bloque al leer contactos con `.in()`: evita URLs demasiado largas. */
const PARTNER_ID_CHUNK = 200

/**
 * Exporta todos los datos de la empresa seleccionada a un ZIP de CSV.
 *
 * Lee cada entidad de `DATA_EXPORT_ENTITIES` con `fetchAllRows` (sin el corte de
 * 1000 filas). Las consultas pasan por RLS: nadie exporta más de lo que ya puede
 * leer. Una entidad que falla (por ejemplo, migración pendiente) no detiene la
 * exportación: queda anotada en `LEEME.txt`.
 *
 * El cliente se usa sin tipos porque el catálogo de tablas es dinámico.
 */
export const useCompanyDataExport = () => {
  const supabase = useSupabase() as unknown as SupabaseClient

  const isExporting = ref(false)
  const progress = ref({ done: 0, total: 0, current: '' })
  const lastResults = ref<DataExportResult[]>([])

  const describeError = (error: { code?: string; message?: string }): string =>
    error.code === '42P01' || error.code === 'PGRST205'
      ? 'la tabla no existe en esta base (migración pendiente)'
      : (error.message?.trim() || 'error desconocido')

  const readByCompany = async (source: string, companyId: string): Promise<ReadResult> => {
    const { data, error, truncated } = await fetchAllRows<Row, { code?: string; message?: string }>(
      (from, to) => supabase
        .from(source)
        .select('*')
        .eq('company_id', companyId)
        .order('id')
        .range(from, to)
    )
    return { rows: data, truncated, error: error ? describeError(error) : null }
  }

  const readCompany = async (companyId: string): Promise<ReadResult> => {
    const { data, error } = await supabase.from('company').select('*').eq('id', companyId)
    return { rows: (data ?? []) as Row[], truncated: false, error: error ? describeError(error) : null }
  }

  /** Contactos de negocio de la empresa (no los miembros del equipo). */
  const readPartners = async (companyId: string): Promise<ReadResult> => {
    const rels = await fetchAllRows<{ partner_id: string }, { code?: string; message?: string }>(
      (from, to) => supabase
        .from('rel_partner_company')
        .select('partner_id')
        .eq('company_id', companyId)
        .eq('relationship_type', 'partner')
        .order('id')
        .range(from, to)
    )
    if (rels.error) return { rows: [], truncated: false, error: describeError(rels.error) }

    const ids = Array.from(new Set(rels.data.map(rel => rel.partner_id)))
    const rows: Row[] = []
    for (let i = 0; i < ids.length; i += PARTNER_ID_CHUNK) {
      const chunk = ids.slice(i, i + PARTNER_ID_CHUNK)
      const { data, error } = await supabase.from('partner').select('*').in('id', chunk).order('id')
      if (error) return { rows, truncated: false, error: describeError(error) }
      rows.push(...((data ?? []) as Row[]))
    }
    return { rows, truncated: rels.truncated, error: null }
  }

  const readEntity = (entity: DataExportEntity, companyId: string): Promise<ReadResult> => {
    if (entity.strategy === 'self') return readCompany(companyId)
    if (entity.strategy === 'partners') return readPartners(companyId)
    return readByCompany(entity.source, companyId)
  }

  const downloadBlob = (bytes: Uint8Array, filename: string) => {
    const blob = new Blob([bytes as BlobPart], { type: 'application/zip' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  /**
   * Genera y descarga el ZIP. Devuelve el resultado por entidad (filas, errores)
   * o `null` si no se pudo armar el archivo.
   */
  const exportCompanyData = async (input: {
    companyId: string
    companyName: string
    includeSensitive: boolean
  }): Promise<DataExportResult[] | null> => {
    if (!input.companyId || isExporting.value) return null

    isExporting.value = true
    const entities = selectExportEntities(input.includeSensitive)
    progress.value = { done: 0, total: entities.length, current: '' }

    try {
      const results: DataExportResult[] = []
      const files: { name: string; content: string }[] = []
      const generatedAt = new Date()

      for (const entity of entities) {
        progress.value = { ...progress.value, current: entity.label }
        const { rows, truncated, error } = await readEntity(entity, input.companyId)
        if (error) console.error(`Error exporting ${entity.source}:`, error)
        results.push({ entity, rows: rows.length, truncated, error })
        if (!error) files.push({ name: entity.file, content: rowsToCsv(rows) })
        progress.value = { ...progress.value, done: progress.value.done + 1 }
      }

      const readme = buildExportReadme({
        companyName: input.companyName,
        generatedAt,
        results,
        includeSensitive: input.includeSensitive
      })
      const zip = createZip([
        { name: 'LEEME.txt', content: readme, date: generatedAt },
        ...files.map(file => ({ ...file, date: generatedAt }))
      ])
      downloadBlob(zip, buildExportFilename(input.companyName, generatedAt))

      lastResults.value = results
      return results
    } catch (error) {
      console.error('Error building company export:', error)
      return null
    } finally {
      isExporting.value = false
      progress.value = { ...progress.value, current: '' }
    }
  }

  return { isExporting, progress, lastResults, exportCompanyData }
}
