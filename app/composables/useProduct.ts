import type { Tables, TablesInsert, TablesUpdate } from '~/types/database.types'

type Product = Tables<'product'>
type ProductInsert = TablesInsert<'product'>
type ProductUpdate = TablesUpdate<'product'>

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
      .single()

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
    createProduct,
    updateProduct,
    archiveProduct
  }
}
