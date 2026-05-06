import type { Database, Tables, TablesInsert, TablesUpdate } from '~/types/database.types'

type Product = Tables<'product'>
type OrderKind = Database['public']['Enums']['order_type']
type ProductInsert = TablesInsert<'product'>
type ProductUpdate = TablesUpdate<'product'>

/** Escapa `%`, `_` y `\` para usar el término dentro de filtros `.ilike` en PostgREST. */
const escapeForIlike = (raw: string): string =>
  raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_%')

export const useProduct = () => {
  const supabase = useSupabase()

  const getProductById = async (id: string, companyId: string): Promise<Product | null> => {
    if (!companyId) return null

    const { data, error } = await supabase
      .from('product')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching product:', error)
      return null
    }

    return data
  }

  const getProductsByCompany = async (
    companyId: string,
    options?: {
      status?: Product['status']
      productType?: Product['product_type']
      limit?: number
      offset?: number
    }
  ): Promise<Product[]> => {
    if (!companyId) return []

    let query = supabase
      .from('product')
      .select('*')
      .eq('company_id', companyId)

    if (options?.status) {
      query = query.eq('status', options.status)
    }
    if (options?.productType) {
      query = query.eq('product_type', options.productType)
    }
    if (options?.limit) {
      query = query.limit(options.limit)
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1)
    }

    const { data, error } = await query.order('name')

    if (error) {
      console.error('Error fetching products by company:', error)
      return []
    }

    return data || []
  }

  const searchProductsByCompany = async (
    companyId: string,
    searchTerm: string,
    limit = 40
  ): Promise<Product[]> => {
    if (!companyId) return []

    let query = supabase
      .from('product')
      .select('*')
      .eq('company_id', companyId)
      .order('name')
      .limit(limit)

    const termRaw = searchTerm.trim().slice(0, 160)
    if (termRaw.length > 0) {
      const pat = `%${escapeForIlike(termRaw)}%`
      query = query.or(
        [
          `name.ilike.${pat}`,
          `display_name.ilike.${pat}`,
          `sku.ilike.${pat}`,
          `internal_ref.ilike.${pat}`,
          `barcode.ilike.${pat}`
        ].join(',')
      )
    }

    const { data, error } = await query

    if (error) {
      console.error('Error searching products:', error)
      return []
    }

    return data || []
  }

  /** Crea un producto mínimo cuando la línea de orden usa un nombre fuera del catálogo. */
  const ensureCatalogProductFromOrderLine = async (
    companyId: string,
    params: {
      orderType: OrderKind
      orderCurrency: string
      lineName: string
      unitPrice: number
      unitCost: number
      defaultTaxRate: number | null | undefined
    }
  ): Promise<Product | null> => {
    const name = params.lineName.trim().slice(0, 255)
    if (!name) return null

    return createProduct(companyId, {
      name,
      currency: params.orderCurrency.trim().slice(0, 3) || 'MXN',
      tax_rate: params.defaultTaxRate ?? 0,
      product_type: 'product',
      status: 'active',
      ...(params.orderType === 'sale'
        ? {
            sale_price: params.unitPrice,
            cost_price: params.unitCost
          }
        : {
            sale_price: 0,
            cost_price: params.unitPrice
          })
    })
  }

  const createProduct = async (
    companyId: string,
    product: Omit<ProductInsert, 'company_id'>
  ): Promise<Product | null> => {
    const user = await useSupabaseUser()
    if (!companyId) return null

    const { data, error } = await supabase
      .from('product')
      .insert({
        ...product,
        company_id: companyId,
        created_by: user?.id,
        updated_by: user?.id
      })
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error creating product:', error)
      return null
    }

    return data
  }

  const updateProduct = async (
    id: string,
    companyId: string,
    updates: ProductUpdate
  ): Promise<Product | null> => {
    const user = await useSupabaseUser()
    if (!companyId) return null

    const { data, error } = await supabase
      .from('product')
      .update({
        ...updates,
        updated_by: user?.id
      })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error updating product:', error)
      return null
    }

    return data
  }

  const archiveProduct = async (id: string, companyId: string): Promise<boolean> => {
    if (!companyId) return false

    const { error } = await supabase
      .from('product')
      .update({ status: 'inactive' })
      .eq('id', id)
      .eq('company_id', companyId)

    if (error) {
      console.error('Error archiving product:', error)
      return false
    }

    return true
  }

  return {
    getProductById,
    getProductsByCompany,
    searchProductsByCompany,
    ensureCatalogProductFromOrderLine,
    createProduct,
    updateProduct,
    archiveProduct
  }
}
