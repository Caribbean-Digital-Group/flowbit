import type { Database } from '~/types/database.types'

type PartnerCompanyRole = Database['public']['Enums']['partner_company_role']
type InvitationStatus = Database['public']['Enums']['invitation_status']

export type RelationshipType = 'team' | 'partner'

export interface CompanyMember {
  relationship_id: string
  partner_id: string
  company_id: string
  role: PartnerCompanyRole
  invitation_status: InvitationStatus
  is_active: boolean
  is_default: boolean
  invited_at: string | null
  accepted_at: string | null
  created_at: string | null
  relationship_type: RelationshipType
  partner_name: string
  partner_display_name: string | null
  partner_email: string | null
  partner_avatar_url: string | null
  partner_user_id: string | null
  invited_by_partner_id: string | null
  invited_by_name: string | null
  invited_by_email: string | null
}

export interface PendingInvitation {
  relationship_id: string
  company_id: string
  company_name: string
  company_display_name: string | null
  company_logo_url: string | null
  company_is_personal: boolean | null
  role: PartnerCompanyRole
  invitation_status: InvitationStatus
  invited_at: string | null
  invited_by_partner_id: string | null
  invited_by_name: string | null
  invited_by_email: string | null
}

interface InviteResult {
  success: boolean
  relationshipId: string | null
  error: string | null
}

interface MutationResult {
  success: boolean
  error: string | null
}

/**
 * Composable para gestionar la membresía de los partners a una company:
 * listar miembros, invitar nuevos, responder invitaciones recibidas,
 * cambiar roles y dar de baja a miembros existentes.
 */
export const useMembership = () => {
  const supabase = useSupabase()

  const formatError = (err: { message?: string; code?: string } | null): string => {
    if (!err) return 'Error desconocido'
    const message = err.message ?? ''

    // Mapeo de errores conocidos a mensajes amigables (UI en español).
    if (/already a member/i.test(message)) return 'El usuario ya es miembro de esta empresa.'
    if (/pending invitation/i.test(message)) return 'Ya existe una invitación pendiente para este usuario.'
    if (/cannot invite yourself/i.test(message)) return 'No puedes invitarte a ti mismo.'
    if (/only an owner can grant/i.test(message)) return 'Solo un owner puede asignar el rol de owner.'
    if (/last owner/i.test(message)) return 'No puedes quitar al último owner de la empresa.'
    if (/only owners or admins/i.test(message)) return 'Solo owners o admins pueden realizar esta acción.'
    if (/only company owners or admins/i.test(message)) return 'Solo owners o admins pueden realizar esta acción.'
    if (/valid email/i.test(message)) return 'El correo electrónico no es válido.'
    if (/Authentication required/i.test(message)) return 'Necesitas iniciar sesión para continuar.'
    if (/no longer pending/i.test(message)) return 'La invitación ya no está disponible.'
    if (/not yours/i.test(message)) return 'Esta invitación no te pertenece.'
    if (/not found/i.test(message)) return 'El registro no fue encontrado.'

    return message || 'Error al procesar la solicitud'
  }

  const getCompanyMembers = async (
    companyId: string,
    relationshipType: RelationshipType = 'team'
  ): Promise<CompanyMember[]> => {
    if (!companyId) return []

    const { data, error } = await supabase.rpc(
      'get_company_members' as never,
      {
        p_company_id: companyId,
        p_relationship_type: relationshipType
      } as never
    ) as {
      data: CompanyMember[] | null
      error: { message: string; code?: string } | null
    }

    if (error) {
      console.error('Error fetching company members:', error)
      return []
    }

    return data ?? []
  }

  const getMyInvitations = async (): Promise<PendingInvitation[]> => {
    const { data, error } = await supabase.rpc(
      'get_my_invitations' as never,
      {} as never
    ) as {
      data: PendingInvitation[] | null
      error: { message: string; code?: string } | null
    }

    if (error) {
      console.error('Error fetching invitations:', error)
      return []
    }

    return data ?? []
  }

  const inviteByEmail = async (
    companyId: string,
    email: string,
    role: PartnerCompanyRole = 'member'
  ): Promise<InviteResult> => {
    if (!companyId) {
      return { success: false, relationshipId: null, error: 'Selecciona una empresa antes de invitar.' }
    }
    if (!email?.trim()) {
      return { success: false, relationshipId: null, error: 'El correo electrónico es obligatorio.' }
    }

    const { data, error } = await supabase.rpc(
      'invite_partner_by_email' as never,
      {
        p_company_id: companyId,
        p_email: email.trim(),
        p_role: role
      } as never
    ) as {
      data: string | null
      error: { message: string; code?: string } | null
    }

    if (error) {
      console.error('Error inviting partner:', error)
      return { success: false, relationshipId: null, error: formatError(error) }
    }

    return { success: true, relationshipId: data, error: null }
  }

  const respondInvitation = async (
    relationshipId: string,
    accept: boolean
  ): Promise<MutationResult> => {
    if (!relationshipId) {
      return { success: false, error: 'Identificador de invitación inválido.' }
    }

    const { error } = await supabase.rpc(
      'respond_to_invitation' as never,
      {
        p_rel_id: relationshipId,
        p_accept: accept
      } as never
    ) as {
      data: boolean | null
      error: { message: string; code?: string } | null
    }

    if (error) {
      console.error('Error responding to invitation:', error)
      return { success: false, error: formatError(error) }
    }

    return { success: true, error: null }
  }

  const updateMemberRole = async (
    relationshipId: string,
    role: PartnerCompanyRole
  ): Promise<MutationResult> => {
    const { error } = await supabase.rpc(
      'update_member_role' as never,
      {
        p_rel_id: relationshipId,
        p_role: role
      } as never
    ) as {
      data: boolean | null
      error: { message: string; code?: string } | null
    }

    if (error) {
      console.error('Error updating member role:', error)
      return { success: false, error: formatError(error) }
    }

    return { success: true, error: null }
  }

  const removeMember = async (relationshipId: string): Promise<MutationResult> => {
    const { error } = await supabase.rpc(
      'remove_company_member' as never,
      { p_rel_id: relationshipId } as never
    ) as {
      data: boolean | null
      error: { message: string; code?: string } | null
    }

    if (error) {
      console.error('Error removing member:', error)
      return { success: false, error: formatError(error) }
    }

    return { success: true, error: null }
  }

  return {
    getCompanyMembers,
    getMyInvitations,
    inviteByEmail,
    respondInvitation,
    updateMemberRole,
    removeMember
  }
}
