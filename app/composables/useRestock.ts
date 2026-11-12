import type { Tables } from '~/types/database.types'
import {
  buildRestockSuggestions,
  sumReservedByProduct,
  type RestockInput,
  type RestockSuggestion,
  type SupplierGroup
} from '~/utils/restock'

type ProductRow = Pick<
  Tables<'product'>,
  'id' | 'name' | 'sku' | 'stock_quantity' | 'stock_min' | 'stock_max' | 'cost_price' | 'default_supplier_id'
> & {
  supplier: Pick<Tables<'partner'>, 'id' | 'name' | 'display_name'> | null
}

export interface CreatedPurchaseOrder {
  orderId: string
  supplierName: string
  lineCount: number
}

export interface PurchaseOrderResult {
  created: CreatedPurchaseOrder[]
  failed: { supplierName: string; reason: string }[]
}

/**
 * Reabastecimiento: productos bajo su mínimo (descontando reservas) y creación
 * de órdenes de compra en borrador agrupadas por proveedor habitual.
 *
 * El cálculo vive en `app/utils/restock.ts`; aquí solo se lee la base y se usan
 * los RPC existentes `create_order` y `add_order_line`. Documentado en
 * `docs/inventory.md` (sección «Por reabastecer»).
 */
export const useRestock = () => {
  const supabase = useSupabase()
  const { getStockAvailability } = useInventory()
  const { createDraftOrder, addOrderLineRpc } = useOrder()

  const getSuggestions = async (companyId: string): Promise<RestockSuggestion[]> => {
    if (!companyId) return []

    const [productsResult, availability] = await Promise.all([
      supabase
        .from('product')
        .select(
          'id, name, sku, stock_quantity, stock_min, stock_max, cost_price, default_supplier_id, supplier:partner!product_default_supplier_id_fkey(id, name, display_name)'
        )
        .eq('company_id', companyId)
        .eq('is_stockable', true)
        .gt('stock_min', 0)
        .not('status', 'in', '(inactive,discontinued)')
        .order('name')
        .returns<ProductRow[]>(),
      getStockAvailability(companyId)
    ])

    if (productsResult.error) {
      console.error('Error fetching restock candidates:', productsResult.error)
      return []
    }

    const reserved = sumReservedByProduct(availability)

    const inputs: RestockInput[] = (productsResult.data ?? []).map((row) => ({
      productId: row.id,
      name: row.name,
      sku: row.sku,
      onHand: row.stock_quantity ?? 0,
      reserved: reserved.get(row.id) ?? 0,
      stockMin: row.stock_min,
      stockMax: row.stock_max,
      unitCost: row.cost_price,
      supplierId: row.default_supplier_id,
      supplierName: row.supplier?.display_name || row.supplier?.name || null
    }))

    return buildRestockSuggestions(inputs)
  }

  /**
   * Crea una orden de compra en borrador por cada grupo con proveedor. Los
   * grupos sin proveedor se ignoran: la página los señala para asignarlo.
   * Un fallo en un proveedor no detiene a los demás.
   */
  const createPurchaseOrders = async (
    companyId: string,
    groups: SupplierGroup[]
  ): Promise<PurchaseOrderResult> => {
    const result: PurchaseOrderResult = { created: [], failed: [] }
    if (!companyId) return result

    for (const group of groups) {
      if (!group.supplierId || group.items.length === 0) continue

      const orderId = await createDraftOrder({
        companyId,
        orderType: 'purchase',
        partnerId: group.supplierId
      })
      if (!orderId) {
        result.failed.push({ supplierName: group.supplierName, reason: 'No se pudo crear la orden.' })
        continue
      }

      let lineCount = 0
      for (const item of group.items) {
        const lineId = await addOrderLineRpc({
          orderId,
          productId: item.productId,
          quantity: item.suggestedQuantity,
          unitPrice: item.unitCost ?? 0,
          unitCost: item.unitCost ?? 0
        })
        if (lineId) lineCount++
      }

      if (lineCount < group.items.length) {
        result.failed.push({
          supplierName: group.supplierName,
          reason: `Se agregaron ${lineCount} de ${group.items.length} productos; revisa la orden.`
        })
      }
      result.created.push({ orderId, supplierName: group.supplierName, lineCount })
    }

    return result
  }

  return { getSuggestions, createPurchaseOrders }
}
