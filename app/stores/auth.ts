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

export const useAuthStore = defineStore('auth', () => {
  const supabase = useSupabase()

  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const partner = ref<Partner | null>(null)
  const companies = shallowRef<UserCompany[]>([])
  const selectedCompanyId = ref<string | null>(null)
  const loading = ref(false)

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

    const defaultCompany = companies.value.find(c => c.isDefault)
    if (defaultCompany) {
      selectedCompanyId.value = defaultCompany.company.id
    } else if (companies.value.length > 0) {
      selectedCompanyId.value = companies.value[0]!.company.id
    }
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
  }

  function selectCompany(companyId: string): void {
    const exists = companies.value.some(c => c.company.id === companyId)
    if (exists) {
      selectedCompanyId.value = companyId
    }
  }

  function clearSession(): void {
    user.value = null
    session.value = null
    partner.value = null
    companies.value = []
    selectedCompanyId.value = null
  }

  return {
    user,
    session,
    partner,
    companies,
    selectedCompanyId,
    loading,
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
  }
})
