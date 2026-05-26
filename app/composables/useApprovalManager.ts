import type { Database, Tables, TablesInsert, TablesUpdate } from '~/types/database.types'
import type { CompanyMember } from '~/composables/useMembership'

type PartnerCompanyRole = Database['public']['Enums']['partner_company_role']

const APPROVER_ELIGIBLE_TEAM_ROLES: PartnerCompanyRole[] = ['owner', 'member']

export interface ApprovalManagerCandidate {
  partner_id: string
  name: string
  display_name: string | null
  email: string | null
  user_id: string | null
  role: PartnerCompanyRole
}

export type ApprovalManagerWithRelations = Tables<'approval_manager'> & {
  partner: Pick<
    Tables<'partner'>,
    'id' | 'name' | 'display_name' | 'email' | 'user_id'
  > | null
  approval_manager_category: { approval_category_id: string }[] | null
}

export const useApprovalManager = () => {
  const supabase = useSupabase()

  const mapManagerRow = (
    row: Record<string, unknown> | null
  ): ApprovalManagerWithRelations | null => {
    if (!row) return null
    const { partner, approval_manager_category: amc, ...rest } = row as {
      partner: ApprovalManagerWithRelations['partner']
      approval_manager_category: { approval_category_id: string }[] | null
    } & Tables<'approval_manager'>

    return {
      ...rest,
      partner,
      approval_manager_category: amc ?? []
    }
  }

  const getManagersByCompany = async (
    companyId: string
  ): Promise<ApprovalManagerWithRelations[]> => {
    if (!companyId) return []

    const { data, error } = await supabase
      .from('approval_manager')
      .select(
        `
        *,
        partner:partner_id(id, name, display_name, email, user_id),
        approval_manager_category(approval_category_id)
      `
      )
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching approval managers:', error)
      return []
    }

    return (data ?? [])
      .map((r) => mapManagerRow(r as Record<string, unknown>))
      .filter((x): x is ApprovalManagerWithRelations => x !== null)
  }

  const getManagerById = async (
    id: string,
    companyId: string
  ): Promise<ApprovalManagerWithRelations | null> => {
    if (!id || !companyId) return null

    const { data, error } = await supabase
      .from('approval_manager')
      .select(
        `
        *,
        partner:partner_id(id, name, display_name, email, user_id),
        approval_manager_category(approval_category_id)
      `
      )
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (error) {
      console.error('Error fetching approval manager:', error)
      return null
    }

    return mapManagerRow(data as Record<string, unknown> | null)
  }

  const getActiveManagerForPartner = async (
    companyId: string,
    partnerId: string
  ): Promise<ApprovalManagerWithRelations | null> => {
    if (!companyId || !partnerId) return null

    const { data, error } = await supabase
      .from('approval_manager')
      .select(
        `
        *,
        partner:partner_id(id, name, display_name, email, user_id),
        approval_manager_category(approval_category_id)
      `
      )
      .eq('company_id', companyId)
      .eq('partner_id', partnerId)
      .eq('active', true)
      .maybeSingle()

    if (error) {
      console.error('Error fetching approval manager for partner:', error)
      return null
    }

    return mapManagerRow(data as Record<string, unknown> | null)
  }

  const syncManagerCategories = async (
    managerId: string,
    categoryIds: string[]
  ): Promise<boolean> => {
    const { error: delError } = await supabase
      .from('approval_manager_category')
      .delete()
      .eq('approval_manager_id', managerId)

    if (delError) {
      console.error('Error clearing manager categories:', delError)
      return false
    }

    if (categoryIds.length === 0) return true

    const rows = categoryIds.map((approval_category_id) => ({
      approval_manager_id: managerId,
      approval_category_id
    }))

    const { error: insError } = await supabase.from('approval_manager_category').insert(rows)

    if (insError) {
      console.error('Error inserting manager categories:', insError)
      return false
    }

    return true
  }

  const createManager = async (
    companyId: string,
    payload: Omit<TablesInsert<'approval_manager'>, 'company_id'>,
    categoryIds: string[]
  ): Promise<ApprovalManagerWithRelations | null> => {
    if (!companyId) return null
    const user = await useSupabaseUser()

    const { data, error } = await supabase
      .from('approval_manager')
      .insert({
        ...payload,
        company_id: companyId,
        created_by: user?.id,
        updated_by: user?.id
      })
      .select(
        `
        *,
        partner:partner_id(id, name, display_name, email, user_id),
        approval_manager_category(approval_category_id)
      `
      )
      .maybeSingle()

    if (error || !data) {
      console.error('Error creating approval manager:', error)
      return null
    }

    const id = (data as Tables<'approval_manager'>).id

    const okCats = await syncManagerCategories(id, categoryIds)
    if (!okCats) {
      return null
    }

    return getManagerById(id, companyId)
  }

  const updateManager = async (
    id: string,
    companyId: string,
    updates: TablesUpdate<'approval_manager'>,
    categoryIds?: string[]
  ): Promise<ApprovalManagerWithRelations | null> => {
    if (!id || !companyId) return null
    const user = await useSupabaseUser()

    const { error } = await supabase
      .from('approval_manager')
      .update({
        ...updates,
        updated_by: user?.id
      })
      .eq('id', id)
      .eq('company_id', companyId)

    if (error) {
      console.error('Error updating approval manager:', error)
      return null
    }

    if (categoryIds !== undefined) {
      const ok = await syncManagerCategories(id, categoryIds)
      if (!ok) return null
    }

    return getManagerById(id, companyId)
  }

  /**
   * Miembros activos del equipo (acceso aceptado, rol owner o member, con usuario vinculado)
   * que aún no están registrados como aprobadores.
   */
  const getCandidatePartnerOptions = async (
    companyId: string
  ): Promise<ApprovalManagerCandidate[]> => {
    const { getCompanyMembers } = useMembership()

    const [members, managers] = await Promise.all([
      getCompanyMembers(companyId, 'team'),
      getManagersByCompany(companyId)
    ])

    const taken = new Set(managers.map((m) => m.partner_id))

    const isEligibleTeamMember = (m: CompanyMember): boolean =>
      m.invitation_status === 'accepted'
      && m.is_active
      && APPROVER_ELIGIBLE_TEAM_ROLES.includes(m.role)
      && Boolean(m.partner_user_id)
      && !taken.has(m.partner_id)

    return members.filter(isEligibleTeamMember).map((m) => ({
      partner_id: m.partner_id,
      name: m.partner_name,
      display_name: m.partner_display_name,
      email: m.partner_email,
      user_id: m.partner_user_id,
      role: m.role
    }))
  }

  return {
    getManagersByCompany,
    getManagerById,
    getActiveManagerForPartner,
    createManager,
    updateManager,
    syncManagerCategories,
    getCandidatePartnerOptions
  }
}
