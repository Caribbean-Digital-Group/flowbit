<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { createEmptyCompanyForm, type CompanyFormData } from '~/components/Company/Form.vue'
import type { TablesUpdate } from '~/types/database.types'

definePageMeta({ layout: 'admin' })

const router = useRouter()
const authStore = useAuthStore()
const { companies } = storeToRefs(authStore)
const { createCompany, updateCompany } = useCompany()

const formData = ref<CompanyFormData>(createEmptyCompanyForm())
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

const canCreate = computed(() => canCreateCompany(companies.value))

const handleBack = () => router.push('/admin/companies')

/** Datos opcionales del formulario: se guardan después de crear la empresa. */
const buildDetails = (form: CompanyFormData): TablesUpdate<'company'> => ({
  display_name: form.display_name.trim() || null,
  legal_name: form.legal_name.trim() || null,
  logo_url: form.logo_url.trim() || null,
  primary_color: form.primary_color,
  email: form.email.trim() || null,
  phone: form.phone.trim() || null,
  website: form.website.trim() || null,
  street: form.street.trim() || null,
  street2: form.street2.trim() || null,
  city: form.city.trim() || null,
  state: form.state.trim() || null,
  zip: form.zip.trim() || null,
  vat: form.vat.trim() || null,
  fiscal_regime: form.fiscal_regime.trim() || null,
  legal_representative: form.legal_representative.trim() || null,
  industry: form.industry.trim() || null,
  company_size: form.company_size,
  founded_date: form.founded_date || null,
  description: form.description.trim() || null,
  lang: form.lang,
  tz: form.tz
})

const handleSave = async () => {
  if (isSaving.value) return

  const nameError = validateCompanyName(formData.value.name)
  if (nameError) { errorMessage.value = nameError; return }
  if (!canCreate.value) {
    errorMessage.value = `Llegaste al límite de ${MAX_OWNED_COMPANIES} empresas propias.`
    return
  }

  errorMessage.value = null
  isSaving.value = true
  try {
    const created = await createCompany({
      name: formData.value.name,
      currency: formData.value.currency,
      countryCode: formData.value.country_code
    })
    if (!created.id) { errorMessage.value = created.error; return }

    // La empresa ya existe. Si los datos opcionales no se guardan, se pueden
    // completar después en Configuración: no se bloquea el alta.
    const details = await updateCompany(created.id, buildDetails(formData.value))

    await authStore.fetchCompanies()
    authStore.selectCompany(created.id)
    await router.push(details ? '/admin' : '/admin/settings')
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <CardSheet
    title="Nueva empresa"
    subtitle="Quedarás como propietario. Empieza vacía: sus datos no se mezclan con los de tus otras empresas."
    :is-editing="true"
    :is-loading="isSaving"
    :show-edit-button="false"
    :show-options-button="false"
    :show-footer="false"
    @back="handleBack"
    @save="handleSave"
    @cancel="handleBack"
  >
    <div
      v-if="!canCreate"
      class="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-6 py-4 text-amber-800"
    >
      Llegaste al límite de {{ MAX_OWNED_COMPANIES }} empresas propias. Las empresas a las que te invitan no cuentan para el límite.
    </div>

    <div
      v-if="errorMessage"
      class="mb-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700"
      role="alert"
    >
      {{ errorMessage }}
    </div>

    <p class="mb-6 text-sm text-slate-500">
      Solo el nombre es obligatorio. Lo demás lo puedes completar después en Configuración.
    </p>

    <CompanyForm v-model="formData" />
  </CardSheet>
</template>
