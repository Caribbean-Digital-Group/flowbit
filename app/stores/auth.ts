import { defineStore } from 'pinia'
import type { User, Session } from '@supabase/supabase-js'
import type { Tables } from '~/types/database.types'

type Partner = Tables<'partner'>
type Company = Tables<'company'>

interface PartnerCompanyRelation {
  company_id: string
  role: string
  is_default: boolean
}

interface UserCompany {
  company: Company
  role: string
  isDefault: boolean
}

const SELECTED_COMPANY_STORAGE_KEY = 'flowbit:selected-company-id'

const readPersistedCompanyId = (): string | null => {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(SELECTED_COMPANY_STORAGE_KEY)
  } catch {
    return null
  }
}

const writePersistedCompanyId = (companyId: string | null): void => {
  if (typeof window === 'undefined') return
  try {
    if (companyId) {
      window.localStorage.setItem(SELECTED_COMPANY_STORAGE_KEY, companyId)
    } else {
      window.localStorage.removeItem(SELECTED_COMPANY_STORAGE_KEY)
    }
  } catch {
    // ignore quota / privacy mode errors
  }
}

export const useAuthStore = defineStore('auth', () => {
  const supabase = useSupabase()

  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const partner = ref<Partner | null>(null)
  const companies = shallowRef<UserCompany[]>([])
  const selectedCompanyId = ref<string | null>(null)
  const loading = ref(false)
  const pendingInvitationCount = ref(0)

  const isAuthenticated = computed(() => !!session.value)

  const selectedCompany = computed(() => {
    const list = companies.value
    const id = selectedCompanyId.value
    for (const entry of list) {
      if (entry.company.id === id) return entry.company
    }
    return null
  })

  const partnerDisplayName = computed(() => {
    if (partner.value?.display_name) return partner.value.display_name
    if (partner.value?.name) return partner.value.name
    return user.value?.email ?? ''
  })

  const partnerEmail = computed(() =>
    partner.value?.email ?? user.value?.email ?? ''
  )

  async function fetchPartner(): Promise<void> {
    if (!user.value) return

    const { data, error } = await supabase
      .from('partner')
      .select('*')
      .eq('user_id', user.value.id)
      .single()

    if (error) {
      console.error('Error fetching partner:', error)
      return
    }

    partner.value = data
  }

  async function fetchCompanies(): Promise<void> {
    if (!partner.value) return

    const { data: relations, error: relError } = await supabase
      .rpc('get_partner_companies' as never, { p_partner_id: partner.value.id } as never) as {
        data: PartnerCompanyRelation[] | null
        error: { message: string } | null
      }

    if (!relError && relations && relations.length > 0) {
      const companyIds = relations.map(r => r.company_id)

      const { data: companyData, error: companyError } = await supabase
        .from('company')
        .select('*')
        .in('id', companyIds)

      if (companyError) {
        console.error('Error fetching companies:', companyError)
        return
      }

      const relMap = new Map(relations.map(r => [r.company_id, r]))

      companies.value = (companyData ?? []).map(c => {
        const rel = relMap.get(c.id)
        return {
          company: c,
          role: rel?.role ?? 'member',
          isDefault: rel?.is_default ?? false,
        }
      })
    } else {
      if (relError) {
        console.error('Error fetching partner companies:', relError)
      }

      const { data: fallbackData, error: fallbackError } = await supabase
        .from('company')
        .select('*')

      if (fallbackError) {
        console.error('Error fetching companies fallback:', fallbackError)
        return
      }

      companies.value = (fallbackData ?? []).map(c => ({
        company: c,
        role: 'member',
        isDefault: false,
      }))
    }

    // Prefer the previously persisted company (e.g. after a reload), but only
    // if it still belongs to the current user. Otherwise fall back to the
    // default workspace and finally to the first available company.
    const persistedId = readPersistedCompanyId()
    const persistedMatch = persistedId
      ? companies.value.find(c => c.company.id === persistedId)
      : undefined

    if (persistedMatch) {
      selectedCompanyId.value = persistedMatch.company.id
    } else {
      const defaultCompany = companies.value.find(c => c.isDefault)
      if (defaultCompany) {
        selectedCompanyId.value = defaultCompany.company.id
      } else if (companies.value.length > 0) {
        selectedCompanyId.value = companies.value[0]!.company.id
      } else {
        selectedCompanyId.value = null
      }
    }

    writePersistedCompanyId(selectedCompanyId.value)
  }

  async function fetchPendingInvitationCount(): Promise<void> {
    if (!user.value) {
      pendingInvitationCount.value = 0
      return
    }

    const { data, error } = await supabase.rpc(
      'get_my_invitations' as never,
      {} as never
    ) as {
      data: { relationship_id: string }[] | null
      error: { message: string } | null
    }

    if (error) {
      console.error('Error fetching pending invitation count:', error)
      pendingInvitationCount.value = 0
      return
    }

    pendingInvitationCount.value = data?.length ?? 0
  }

  async function loadSession(): Promise<void> {
    loading.value = true

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession()

      if (!currentSession) {
        clearSession()
        return
      }

      session.value = currentSession
      user.value = currentSession.user

      await fetchPartner()
      await fetchCompanies()
      await fetchPendingInvitationCount()
    } catch (err) {
      console.error('Error loading session:', err)
      clearSession()
    } finally {
      loading.value = false
    }
  }

  async function setSession(newSession: Session): Promise<void> {
    session.value = newSession
    user.value = newSession.user

    await fetchPartner()
    await fetchCompanies()
    await fetchPendingInvitationCount()
  }

  function selectCompany(companyId: string): void {
    const exists = companies.value.some(c => c.company.id === companyId)
    if (exists) {
      selectedCompanyId.value = companyId
      writePersistedCompanyId(companyId)
    }
  }

  function clearSession(): void {
    user.value = null
    session.value = null
    partner.value = null
    companies.value = []
    selectedCompanyId.value = null
    pendingInvitationCount.value = 0
    writePersistedCompanyId(null)
  }

  return {
    user,
    session,
    partner,
    companies,
    selectedCompanyId,
    loading,
    pendingInvitationCount,
    isAuthenticated,
    selectedCompany,
    partnerDisplayName,
    partnerEmail,
    loadSession,
    setSession,
    selectCompany,
    clearSession,
    fetchPartner,
    fetchCompanies,
    fetchPendingInvitationCount,
  }
})
