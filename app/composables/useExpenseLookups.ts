import type { ExpenseCategoryRow } from '~/types/expense.types'

export type ExpenseLookupOption = { value: string; label: string }

/**
 * Catálogos que usan el formulario y el listado de gastos: categorías,
 * proveedores (contactos de la empresa), proyectos y métodos de pago.
 */
export const useExpenseLookups = () => {
  const { getByCompany: getCategories } = useExpenseCategory()
  const { getPartnersByCompany } = usePartner()
  const { getProjectsByCompany } = useProject()
  const { getAllByCompany: getPaymentMethods } = usePaymentMethod()

  const categories = ref<ExpenseCategoryRow[]>([])
  const categoryOptions = ref<ExpenseLookupOption[]>([])
  const partnerOptions = ref<ExpenseLookupOption[]>([])
  const projectOptions = ref<ExpenseLookupOption[]>([])
  const paymentMethodOptions = ref<ExpenseLookupOption[]>([])

  const load = async (companyId: string | null | undefined): Promise<void> => {
    if (!companyId) {
      categories.value = []
      categoryOptions.value = []
      partnerOptions.value = []
      projectOptions.value = []
      paymentMethodOptions.value = []
      return
    }

    const [cats, partners, projects, methods] = await Promise.all([
      getCategories(companyId, { includeArchived: true }),
      getPartnersByCompany(companyId, { active: true }),
      getProjectsByCompany(companyId),
      getPaymentMethods(companyId)
    ])

    categories.value = cats
    categoryOptions.value = cats
      .filter(c => c.active !== false)
      .map(c => ({ value: c.id, label: c.name }))
    partnerOptions.value = partners.map(p => ({ value: p.id, label: p.display_name || p.name }))
    projectOptions.value = projects
      .filter((p): p is typeof p & { id: string } => !!p.id)
      .map(p => ({ value: p.id, label: p.name ?? 'Proyecto' }))
    paymentMethodOptions.value = methods.map(m => ({ value: m.id, label: m.name }))
  }

  /** Mapa id → etiqueta, para resolver nombres en listados. */
  const labelMap = (options: ExpenseLookupOption[]): Map<string, string> =>
    new Map(options.map(o => [o.value, o.label]))

  return {
    categories,
    categoryOptions,
    partnerOptions,
    projectOptions,
    paymentMethodOptions,
    load,
    labelMap
  }
}
