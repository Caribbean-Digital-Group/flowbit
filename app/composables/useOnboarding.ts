import type { OnboardingSignals } from '~/utils/onboarding'
import { hasText } from '~/utils/onboarding'

/**
 * Señales de «Primeros pasos» (TRY-30). Cada consulta es un `count` con
 * `head: true`: no descarga filas, solo el total, y siempre filtra por empresa.
 */
export const useOnboarding = () => {
  const supabase = useSupabase()

  const countOrZero = (label: string, result: { count: number | null; error: unknown }): number => {
    if (result.error) {
      console.error(`Error counting ${label} for onboarding:`, result.error)
      return 0
    }
    return result.count ?? 0
  }

  const getSignals = async (companyId: string): Promise<OnboardingSignals | null> => {
    const [company, products, paymentMethods, team, sales] = await Promise.all([
      supabase.from('company').select('legal_name, vat').eq('id', companyId).maybeSingle(),
      supabase.from('product').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
      supabase.from('payment_method').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
      supabase
        .from('rel_partner_company')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('relationship_type', 'team'),
      supabase
        .from('order')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('order_type', 'sale')
    ])

    if (company.error) {
      console.error('Error fetching company for onboarding:', company.error)
      return null
    }

    return {
      hasLegalName: hasText(company.data?.legal_name),
      hasTaxId: hasText(company.data?.vat),
      productCount: countOrZero('products', products),
      paymentMethodCount: countOrZero('payment methods', paymentMethods),
      teamMemberCount: countOrZero('team members', team),
      saleOrderCount: countOrZero('sale orders', sales)
    }
  }

  return { getSignals }
}
