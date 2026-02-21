import { defineStore } from 'pinia'
import type { User, Session } from '@supabase/supabase-js'
import type { Partner, Company } from '~/types/database.types'

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
  const companies = ref<UserCompany[]>([])
  const selectedCompanyId = ref<string | null>(null)
  const loading = ref(false)

  const isAuthenticated = computed(() => !!session.value)

  const selectedCompany = computed(() =>
    companies.value.find(c => c.company.id === selectedCompanyId.value)?.company ?? null
  )

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

    const { data, error } = await supabase
      .from('rel_partner_company')
      .select(`
        role,
        is_default,
        company:company_id (*)
      `)
      .eq('partner_id', partner.value.id)
      .eq('invitation_status', 'accepted')
      .eq('is_active', true)

    if (error) {
      console.error('Error fetching companies:', error)
      return
    }

    companies.value = (data ?? [])
      .filter((row: any) => row.company)
      .map((row: any) => ({
        company: row.company as Company,
        role: row.role,
        isDefault: row.is_default,
      }))

    const defaultCompany = companies.value.find(c => c.isDefault)
    if (defaultCompany) {
      selectedCompanyId.value = defaultCompany.company.id
    } else if (companies.value.length > 0) {
      selectedCompanyId.value = companies.value[0].company.id
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
