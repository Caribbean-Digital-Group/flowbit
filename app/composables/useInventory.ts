import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  InventoryDatabase,
  InventorySettingsRow,
  InventorySummary,
  ProductStockView,
  RestockTaskResult,
  StockAdjustmentResult,
  StockCard,
  StockMoveOrigin,
  StockMoveView,
  StockStatus,
  WarehouseStock
} from '~/types/inventory.types'
import type { SalesDatabase, StockAvailabilityView } from '~/types/sales.types'

/** Etiquetas en español de cada origen de movimiento. */
export const STOCK_ORIGIN_LABELS: Record<StockMoveOrigin, string> = {
  initial: 'Saldo inicial',
  purchase: 'Compra',
  sale: 'Venta',
  pos: 'Punto de venta',
  storefront: 'Tienda en línea',
  return_in: 'Devolución de cliente',
  return_out: 'Devolución a proveedor',
  adjustment: 'Ajuste',
  manual: 'Movimiento manual',
  transfer: 'Traspaso entre almacenes'
}

/** Color de cada origen, para distinguirlos de un vistazo en las tablas. */
export const STOCK_ORIGIN_CLASSES: Record<StockMoveOrigin, string> = {
  initial: 'bg-slate-100 text-slate-600',
  purchase: 'bg-emerald-100 text-emerald-700',
  sale: 'bg-blue-100 text-blue-700',
  pos: 'bg-fuchsia-100 text-fuchsia-700',
  storefront: 'bg-violet-100 text-violet-700',
  return_in: 'bg-teal-100 text-teal-700',
  return_out: 'bg-orange-100 text-orange-700',
  adjustment: 'bg-amber-100 text-amber-700',
  manual: 'bg-slate-100 text-slate-600',
  transfer: 'bg-sky-100 text-sky-700'
}

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  ok: 'Correcto',
  low: 'Bajo mínimo',
  out: 'Agotado',
  negative: 'Negativo'
}

export const STOCK_STATUS_CLASSES: Record<StockStatus, string> = {
  ok: 'bg-emerald-100 text-emerald-700',
  low: 'bg-amber-100 text-amber-700',
  out: 'bg-orange-100 text-orange-700',
  negative: 'bg-red-100 text-red-700'
}

/**
 * Acceso al libro de inventario: existencias, valoración, trazabilidad,
 * ajustes y tareas de reabastecimiento.
 *
 * El stock ya no se escribe desde el cliente: todo pasa por los RPC que
 * dejan asiento en `stock_move`.
 */
export const useInventory = () => {
  const supabase = useSupabase() as unknown as SupabaseClient<InventoryDatabase>

  /** Última operación fallida, para poder explicarla en la interfaz. */
  const lastError = ref<string | null>(null)

  // ── Reportes ──────────────────────────────────────────────────────────────

  /** Resumen completo: totales, valoración, desglose y alertas. */
  const getSummary = async (companyId: string): Promise<InventorySummary | null> => {
    if (!companyId) return null

    const { data, error } = await supabase.rpc(
      'get_inventory_summary' as never,
      { p_company_id: companyId } as never
    )

    if (error) {
      console.error('Error fetching inventory summary:', error)
      lastError.value = describeError(error)
      return null
    }

    return data as unknown as InventorySummary
  }

  /** Existencias y valoración producto por producto. */
  const getStockReport = async (companyId: string): Promise<ProductStockView[]> => {
    if (!companyId) return []

    const { data, error } = await supabase
      .from('v_product_stock')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('name')

    if (error) {
      console.error('Error fetching stock report:', error)
      lastError.value = describeError(error)
      return []
    }

    return data ?? []
  }

  /** Kardex de un producto: movimientos con saldo corrido. */
  const getStockCard = async (productId: string, limit = 200): Promise<StockCard | null> => {
    if (!productId) return null

    const { data, error } = await supabase.rpc(
      'get_product_stock_card' as never,
      { p_product_id: productId, p_limit: limit } as never
    )

    if (error) {
      console.error('Error fetching stock card:', error)
      lastError.value = describeError(error)
      return null
    }

    return data as unknown as StockCard
  }

  /** Últimos movimientos de la empresa, con filtros opcionales. */
  const getRecentMoves = async (
    companyId: string,
    options: { limit?: number; origin?: StockMoveOrigin; productId?: string; warehouseId?: string } = {}
  ): Promise<StockMoveView[]> => {
    if (!companyId) return []

    let query = supabase
      .from('v_stock_moves')
      .select('*')
      .eq('company_id', companyId)
      .order('occurred_at', { ascending: false })
      .limit(options.limit ?? 50)

    // 'transfer' aún no está en el enum generado (llega con db:types)
    if (options.origin) query = query.eq('origin', options.origin as never)
    if (options.productId) query = query.eq('product_id', options.productId)
    if (options.warehouseId) query = query.eq('warehouse_id', options.warehouseId)

    const { data, error } = await query

    if (error) {
      console.error('Error fetching stock moves:', error)
      lastError.value = describeError(error)
      return []
    }

    return data ?? []
  }

  /** Existencias y valoración de un almacén, calculadas desde el libro. */
  const getWarehouseStock = async (warehouseId: string): Promise<WarehouseStock | null> => {
    if (!warehouseId) return null

    const { data, error } = await supabase.rpc(
      'get_warehouse_stock' as never,
      { p_warehouse_id: warehouseId } as never
    )

    if (error) {
      console.error('Error fetching warehouse stock:', error)
      lastError.value = describeError(error)
      return null
    }

    return data as unknown as WarehouseStock
  }

  // ── Operaciones ───────────────────────────────────────────────────────────

  /** Ajusta las existencias a la cantidad contada, dejando asiento y motivo. */
  const adjustStock = async (
    productId: string,
    newQuantity: number,
    reason: string,
    warehouseId?: string | null
  ): Promise<StockAdjustmentResult | null> => {
    lastError.value = null

    const { data, error } = await supabase.rpc(
      'create_stock_adjustment' as never,
      {
        p_product_id: productId,
        p_new_quantity: newQuantity,
        p_reason: reason,
        p_warehouse_id: warehouseId ?? null
      } as never
    )

    if (error) {
      console.error('Error adjusting stock:', error)
      lastError.value = describeError(error)
      return null
    }

    return data as unknown as StockAdjustmentResult
  }

  /** Sincroniza las tareas de reabastecimiento de todo el catálogo. */
  const generateRestockTasks = async (companyId: string): Promise<RestockTaskResult | null> => {
    lastError.value = null

    const { data, error } = await supabase.rpc(
      'generate_restock_tasks' as never,
      { p_company_id: companyId } as never
    )

    if (error) {
      console.error('Error generating restock tasks:', error)
      lastError.value = describeError(error)
      return null
    }

    return data as unknown as RestockTaskResult
  }

  // ── Configuración ─────────────────────────────────────────────────────────

  const getSettings = async (companyId: string): Promise<InventorySettingsRow | null> => {
    if (!companyId) return null

    const { data, error } = await supabase
      .from('inventory_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching inventory settings:', error)
      return null
    }

    return data
  }

  const saveSettings = async (
    companyId: string,
    updates: Partial<InventorySettingsRow>
  ): Promise<InventorySettingsRow | null> => {
    lastError.value = null
    const user = await useSupabaseUser()

    const { data, error } = await supabase
      .from('inventory_settings')
      .upsert(
        { ...updates, company_id: companyId, updated_by: user?.id ?? null },
        { onConflict: 'company_id' }
      )
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error saving inventory settings:', error)
      lastError.value = describeError(error)
      return null
    }

    return data
  }

  // ── Existencias por almacén ───────────────────────────────────────────────

  /** Existencia, reservado (entregas preparadas) y disponible por almacén. */
  const getStockAvailability = async (
    companyId: string,
    productId?: string | null
  ): Promise<StockAvailabilityView[]> => {
    if (!companyId) return []
    lastError.value = null

    const salesDb = supabase as unknown as SupabaseClient<SalesDatabase>
    let query = salesDb
      .from('v_stock_availability')
      .select('*')
      .eq('company_id', companyId)
      .order('warehouse_name')

    if (productId) query = query.eq('product_id', productId)

    const { data, error } = await query

    if (error) {
      console.error('Error fetching stock availability:', error)
      lastError.value = describeError(error)
      return []
    }

    return (data ?? []) as StockAvailabilityView[]
  }

  /** Traspasa existencias entre almacenes (salida + entrada al costo promedio). */
  const transferStock = async (params: {
    productId: string
    fromWarehouseId: string
    toWarehouseId: string
    quantity: number
    lotName?: string | null
    serialNumber?: string | null
    notes?: string | null
  }): Promise<boolean> => {
    lastError.value = null

    const { error } = await supabase.rpc(
      'transfer_stock' as never,
      {
        p_product_id: params.productId,
        p_from_warehouse_id: params.fromWarehouseId,
        p_to_warehouse_id: params.toWarehouseId,
        p_quantity: params.quantity,
        p_lot_name: params.lotName ?? null,
        p_serial_number: params.serialNumber ?? null,
        p_notes: params.notes ?? null
      } as never
    )

    if (error) {
      console.error('Error transferring stock:', error)
      lastError.value = describeError(error)
      return false
    }

    return true
  }

  return {
    lastError,
    getStockAvailability,
    transferStock,
    getSummary,
    getStockReport,
    getStockCard,
    getRecentMoves,
    getWarehouseStock,
    adjustStock,
    generateRestockTasks,
    getSettings,
    saveSettings
  }
}

/** Traduce los errores de Postgres que el usuario puede encontrarse. */
function describeError(error: { code?: string; message: string }): string {
  // 42P01 tabla inexistente · 42703 columna inexistente · 42883 función inexistente
  if (error.code === '42P01' || error.code === '42703' || error.code === '42883') {
    return 'La base de datos aún no tiene el módulo de trazabilidad de inventario. Aplica las migraciones pendientes con «npm run db:push».'
  }
  if (error.code === '42501') {
    return 'El stock no se modifica directamente: registra un ajuste de inventario con su motivo.'
  }
  return error.message
}
