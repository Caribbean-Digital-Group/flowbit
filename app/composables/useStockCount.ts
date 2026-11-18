import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ApplyStockCountResult,
  StockCountDatabase,
  StockCountLineRow,
  StockCountRow
} from '~/types/stockCount.types'

/** Conteo con nombres resueltos para el listado. */
export interface StockCountListItem extends StockCountRow {
  warehouseName: string
  categoryName: string | null
  totalLines: number
  countedLines: number
}

/** Línea con los datos del producto y la existencia actual del almacén. */
export interface StockCountLineView extends StockCountLineRow {
  name: string
  sku: string | null
  barcode: string | null
  /** Existencia del almacén hoy (puede diferir de la esperada si hubo movimientos). */
  currentQuantity: number
}

export interface StockCountCategoryOption {
  id: string
  name: string
}

/**
 * Conteo físico de inventario (TRY-42). Las tablas solo se escriben por RPC
 * (`start_stock_count`, `set_stock_count_line`, `apply_stock_count`,
 * `cancel_stock_count`). El cast del cliente es temporal hasta regenerar
 * `database.types.ts`. Documentado en `docs/inventory.md` («Conteo físico»).
 */
export const useStockCount = () => {
  const supabase = useSupabase() as unknown as SupabaseClient<StockCountDatabase>
  const lastError = ref<string | null>(null)

  const fail = (context: string, error: { message: string; code?: string }): null => {
    console.error(`Error ${context}:`, error)
    lastError.value = error.code === '42P01' || error.code === 'PGRST202'
      ? 'La base de datos aún no tiene el conteo físico. Aplica las migraciones pendientes con «npm run db:push».'
      : (error.message?.trim() || 'No se pudo completar la operación.')
    return null
  }

  const getCounts = async (companyId: string): Promise<StockCountListItem[]> => {
    if (!companyId) return []
    lastError.value = null

    const [countsResult, warehousesResult, categoriesResult] = await Promise.all([
      supabase
        .from('stock_count')
        .select('*')
        .eq('company_id', companyId)
        .eq('active', true)
        .order('started_at', { ascending: false })
        .limit(200),
      supabase.from('warehouse').select('id, name').eq('company_id', companyId),
      supabase.from('product_category').select('id, name').eq('company_id', companyId)
    ])

    if (countsResult.error) { fail('fetching stock counts', countsResult.error); return [] }
    const counts = countsResult.data ?? []
    if (counts.length === 0) return []

    // Avance por conteo (solo de los mostrados)
    const { data: lines, error: linesError } = await fetchAllRows((from, to) => supabase
      .from('stock_count_line')
      .select('id, stock_count_id, counted_quantity')
      .in('stock_count_id', counts.map((c) => c.id))
      .order('id', { ascending: true })
      .range(from, to))
    if (linesError) console.error('Error fetching stock count progress:', linesError)

    const progress = new Map<string, { total: number; counted: number }>()
    for (const line of lines) {
      const entry = progress.get(line.stock_count_id) ?? { total: 0, counted: 0 }
      entry.total += 1
      if (line.counted_quantity !== null) entry.counted += 1
      progress.set(line.stock_count_id, entry)
    }

    const warehouses = new Map((warehousesResult.data ?? []).map((w) => [w.id, w.name]))
    const categories = new Map((categoriesResult.data ?? []).map((c) => [c.id, c.name]))

    return counts.map((count) => ({
      ...count,
      warehouseName: warehouses.get(count.warehouse_id) ?? '—',
      categoryName: count.category_id ? categories.get(count.category_id) ?? null : null,
      totalLines: progress.get(count.id)?.total ?? 0,
      countedLines: progress.get(count.id)?.counted ?? 0
    }))
  }

  const getCount = async (id: string, companyId: string): Promise<StockCountListItem | null> => {
    if (!companyId) return null
    const all = await getCounts(companyId)
    const found = all.find((c) => c.id === id)
    if (found) return found

    // Conteos más antiguos que el límite del listado
    const { data, error } = await supabase
      .from('stock_count')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()
    if (error) return fail('fetching stock count', error)
    if (!data) return null
    const { data: wh } = await supabase.from('warehouse').select('name').eq('id', data.warehouse_id).maybeSingle()
    return { ...data, warehouseName: wh?.name ?? '—', categoryName: null, totalLines: 0, countedLines: 0 }
  }

  const getLines = async (count: Pick<StockCountRow, 'id' | 'company_id' | 'warehouse_id'>): Promise<StockCountLineView[]> => {
    lastError.value = null

    const [linesResult, productsResult, quantsResult] = await Promise.all([
      fetchAllRows((from, to) => supabase
        .from('stock_count_line')
        .select('*')
        .eq('stock_count_id', count.id)
        .order('id', { ascending: true })
        .range(from, to)),
      fetchAllRows((from, to) => supabase
        .from('product')
        .select('id, name, display_name, sku, barcode')
        .eq('company_id', count.company_id)
        .order('id', { ascending: true })
        .range(from, to)),
      fetchAllRows((from, to) => supabase
        .from('stock_quant')
        .select('product_id, quantity')
        .eq('warehouse_id', count.warehouse_id)
        .order('product_id', { ascending: true })
        .range(from, to))
    ])

    if (linesResult.error) { fail('fetching stock count lines', linesResult.error as { message: string }); return [] }

    const products = new Map(productsResult.data.map((p) => [p.id, p]))
    const quants = new Map(quantsResult.data.map((q) => [q.product_id, Number(q.quantity ?? 0)]))

    return linesResult.data
      .map((line) => {
        const product = products.get(line.product_id)
        return {
          ...line,
          expected_quantity: Number(line.expected_quantity),
          unit_cost: Number(line.unit_cost),
          counted_quantity: line.counted_quantity === null ? null : Number(line.counted_quantity),
          adjusted_quantity: line.adjusted_quantity === null ? null : Number(line.adjusted_quantity),
          name: product?.display_name?.trim() || product?.name || 'Producto',
          sku: product?.sku ?? null,
          barcode: product?.barcode ?? null,
          currentQuantity: quants.get(line.product_id) ?? 0
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'es-MX'))
  }

  const getCategories = async (companyId: string): Promise<StockCountCategoryOption[]> => {
    if (!companyId) return []
    const { data, error } = await supabase
      .from('product_category')
      .select('id, name')
      .eq('company_id', companyId)
      .order('name')
    if (error) { console.error('Error fetching product categories:', error); return [] }
    return data ?? []
  }

  const startCount = async (warehouseId: string, categoryId: string | null, notes: string | null): Promise<string | null> => {
    lastError.value = null
    const { data, error } = await supabase.rpc('start_stock_count', {
      p_warehouse_id: warehouseId,
      p_category_id: categoryId,
      p_notes: notes
    })
    if (error) return fail('starting stock count', error)
    return data
  }

  const setCounted = async (lineId: string, counted: number | null): Promise<boolean> => {
    lastError.value = null
    const { error } = await supabase.rpc('set_stock_count_line', { p_line_id: lineId, p_counted: counted })
    if (error) { fail('saving counted quantity', error); return false }
    return true
  }

  const applyCount = async (countId: string, uncountedAsZero: boolean): Promise<ApplyStockCountResult | null> => {
    lastError.value = null
    const { data, error } = await supabase.rpc('apply_stock_count', {
      p_count_id: countId,
      p_uncounted_as_zero: uncountedAsZero
    })
    if (error) return fail('applying stock count', error)
    return data
  }

  const cancelCount = async (countId: string): Promise<boolean> => {
    lastError.value = null
    const { error } = await supabase.rpc('cancel_stock_count', { p_count_id: countId })
    if (error) { fail('cancelling stock count', error); return false }
    return true
  }

  return {
    lastError,
    getCounts,
    getCount,
    getLines,
    getCategories,
    startCount,
    setCounted,
    applyCount,
    cancelCount
  }
}
