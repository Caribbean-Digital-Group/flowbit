import type { ApprovalFieldDefinition, ApprovalFieldType } from '~/types/approval.types'
import type { ApprovalManagerWithRelations } from '~/composables/useApprovalManager'
import type { CompanyMember } from '~/composables/useMembership'

export type PeopleOption = {
  value: string
  label: string
}

const memberLabel = (m: CompanyMember): string =>
  (m.partner_display_name?.trim() || m.partner_name?.trim() || m.partner_email || m.partner_id)

/**
 * Personas y catálogos que usa el módulo de Aprobaciones:
 * - nombres para la línea de tiempo, comentarios y bitácora;
 * - aprobadores elegibles (aprobadores registrados activos + owners);
 * - miembros del equipo (solicitar en nombre de otra persona);
 * - opciones de los campos dinámicos de tipo contacto, empleado y producto.
 */
export const useApprovalPeople = () => {
  const { getCompanyMembers } = useMembership()
  const { getManagersByCompany } = useApprovalManager()

  const members = ref<CompanyMember[]>([])
  const managers = ref<ApprovalManagerWithRelations[]>([])
  const lookups = ref<Record<'partner' | 'employee' | 'product', PeopleOption[]>>({ partner: [], employee: [], product: [] })
  const extraNames = ref<Record<string, string>>({})

  const activeMembers = computed(() =>
    members.value.filter(m => m.invitation_status === 'accepted' && m.is_active))

  const loadBase = async (companyId: string): Promise<void> => {
    if (!companyId) return
    const [m, g] = await Promise.all([getCompanyMembers(companyId, 'team'), getManagersByCompany(companyId)])
    members.value = m
    managers.value = g
  }

  /** Carga solo los catálogos que pide el formulario de la categoría. */
  const loadLookups = async (companyId: string, schema: ApprovalFieldDefinition[]): Promise<void> => {
    const types = new Set(schema.map(f => f.type))
    const tasks: Promise<void>[] = []
    if (types.has('partner') && !lookups.value.partner.length) {
      tasks.push((async () => {
        const { getPartnersByCompany } = usePartner()
        const rows = await getPartnersByCompany(companyId, { relationshipType: 'partner' })
        lookups.value.partner = rows.map(p => ({ value: p.id, label: p.display_name || p.name || p.email || p.id }))
      })())
    }
    if (types.has('employee') && !lookups.value.employee.length) {
      tasks.push((async () => {
        const { getAll } = useEmployee()
        const rows = await getAll(companyId)
        lookups.value.employee = rows
          .filter(e => e.partner_id)
          .map(e => ({ value: e.partner_id as string, label: e.partner_name || e.partner_id || '' }))
      })())
    }
    if (types.has('product') && !lookups.value.product.length) {
      tasks.push((async () => {
        const { getProductsByCompany } = useProduct()
        const rows = await getProductsByCompany(companyId, { limit: 500 })
        lookups.value.product = rows.map(p => ({ value: p.id, label: p.name }))
      })())
    }
    await Promise.all(tasks)
  }

  const nameMap = computed<Record<string, string>>(() => {
    const map: Record<string, string> = { ...extraNames.value }
    for (const m of members.value) map[m.partner_id] = memberLabel(m)
    for (const g of managers.value) {
      if (g.partner) map[g.partner_id] = g.partner.display_name?.trim() || g.partner.name?.trim() || g.partner.email || g.partner_id
    }
    for (const list of Object.values(lookups.value)) for (const o of list) map[o.value] ??= o.label
    return map
  })

  const nameOf = (partnerId: string | null | undefined): string =>
    partnerId ? (nameMap.value[partnerId] ?? 'Persona sin acceso') : '—'

  /** Registra nombres que vienen de vistas (p. ej. el solicitante, que puede no ser miembro). */
  const rememberName = (partnerId: string | null | undefined, name: string | null | undefined): void => {
    if (partnerId && name) extraNames.value = { ...extraNames.value, [partnerId]: name }
  }

  const lookupLabel = (type: ApprovalFieldType, id: string): string | undefined => {
    if (type === 'partner' || type === 'employee' || type === 'product') {
      return lookups.value[type].find(o => o.value === id)?.label ?? nameMap.value[id]
    }
    return undefined
  }

  /** Aprobadores elegibles: owners y aprobadores registrados activos con usuario. */
  const approverOptions = computed<PeopleOption[]>(() => {
    const seen = new Set<string>()
    const options: PeopleOption[] = []
    for (const m of activeMembers.value) {
      if (m.role === 'owner' && m.partner_user_id && !seen.has(m.partner_id)) {
        seen.add(m.partner_id)
        options.push({ value: m.partner_id, label: `${memberLabel(m)} · owner` })
      }
    }
    for (const g of managers.value) {
      if (g.active && g.partner?.user_id && !seen.has(g.partner_id)) {
        seen.add(g.partner_id)
        options.push({ value: g.partner_id, label: nameOf(g.partner_id) })
      }
    }
    return options.sort((a, b) => a.label.localeCompare(b.label, 'es'))
  })

  const memberOptions = computed<PeopleOption[]>(() =>
    activeMembers.value
      .map(m => ({ value: m.partner_id, label: memberLabel(m) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es')))

  /** Aprobadores registrados que autorizan una categoría (modo simple). */
  const managerOptionsFor = (categoryId: string | null | undefined): PeopleOption[] =>
    managers.value
      .filter(g => g.active && g.partner?.user_id)
      .filter(g => (g.approval_manager_category ?? []).some(l => l.approval_category_id === categoryId))
      .map(g => ({ value: g.id, label: nameOf(g.partner_id) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'))

  const allManagerOptions = computed<PeopleOption[]>(() =>
    managers.value
      .filter(g => g.active && g.partner?.user_id)
      .map(g => ({ value: g.id, label: nameOf(g.partner_id) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es')))

  return {
    members,
    managers,
    lookups,
    loadBase,
    loadLookups,
    nameOf,
    rememberName,
    lookupLabel,
    approverOptions,
    memberOptions,
    managerOptionsFor,
    allManagerOptions
  }
}
