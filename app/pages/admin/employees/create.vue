<script setup lang="ts">
import { storeToRefs } from 'pinia'
import {
  createEmptyEmployeeForm,
  mapFormToEmployeeRegistration,
  type EmployeeFormData
} from '~/components/Employee/Form.vue'
import type { EmployeeNewContact } from '~/types/employee.types'

definePageMeta({ layout: 'admin' })

type ContactMode = 'existing' | 'new'

const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId, isSelectedCompanyAdmin } = storeToRefs(authStore)
const { getAll, getEligiblePartners, register, lastError } = useEmployee()
const { getAll: getDepartments } = useEmployeeDepartment()

const contactMode = ref<ContactMode>('existing')
const partnerId = ref('')
const newContact = ref<EmployeeNewContact>({ name: '', email: '', phone: '', vat: '' })
const formData = ref<EmployeeFormData>(createEmptyEmployeeForm())
const partnerOptions = ref<EmployeeOption[]>([])
const departmentOptions = ref<EmployeeOption[]>([])
const managerOptions = ref<EmployeeOption[]>([])
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

const loadOptions = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) return
  const [partners, departments, employees] = await Promise.all([
    getEligiblePartners(companyId),
    getDepartments(companyId),
    getAll(companyId)
  ])
  partnerOptions.value = partners.map(p => ({
    value: p.id,
    label: p.email ? `${p.name} (${p.email})` : p.name
  }))
  departmentOptions.value = departments.map(d => ({ value: d.id, label: d.name }))
  managerOptions.value = employees.map(e => ({ value: e.id, label: e.partner_name ?? '—' }))
}

watch(selectedCompanyId, loadOptions, { immediate: true })

const handleBack = () => {
  router.push('/admin/employees')
}

const handleSave = async () => {
  errorMessage.value = null

  const companyId = selectedCompanyId.value
  if (!companyId) {
    errorMessage.value = 'Selecciona una empresa antes de crear un empleado.'
    return
  }
  if (contactMode.value === 'existing' && !partnerId.value) {
    errorMessage.value = 'Selecciona un contacto.'
    return
  }
  if (contactMode.value === 'new' && !newContact.value.name.trim()) {
    errorMessage.value = 'El nombre es obligatorio.'
    return
  }

  isSaving.value = true
  try {
    const source = contactMode.value === 'existing'
      ? { partnerId: partnerId.value }
      : { newContact: newContact.value }
    const employee = await register(companyId, source, mapFormToEmployeeRegistration(formData.value))
    if (employee) {
      router.push(`/admin/employees/${employee.id}`)
    } else {
      errorMessage.value = lastError.value
    }
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <CardSheet
    title="Nuevo Empleado"
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
      v-if="!isSelectedCompanyAdmin"
      class="mb-6 rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900"
    >
      Solo los propietarios y administradores pueden registrar empleados.
    </div>

    <div
      v-if="errorMessage"
      class="mb-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700"
    >
      {{ errorMessage }}
    </div>

    <div class="space-y-8">
      <section class="space-y-4">
        <h3 class="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2">
          Contacto
        </h3>

        <div class="flex gap-2">
          <BtnApp
            :variant="contactMode === 'existing' ? 'primary' : 'secondary'"
            size="sm"
            @click="contactMode = 'existing'"
          >
            Contacto existente
          </BtnApp>
          <BtnApp
            :variant="contactMode === 'new' ? 'primary' : 'secondary'"
            size="sm"
            @click="contactMode = 'new'"
          >
            Contacto nuevo
          </BtnApp>
        </div>

        <FormSelect
          v-if="contactMode === 'existing'"
          v-model="partnerId"
          label="Contacto"
          :options="partnerOptions"
          placeholder="Busca por nombre o correo"
          no-results-text="No hay contactos disponibles"
          required
          size="md"
        />

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="sm:col-span-2">
            <FormInput v-model="newContact.name" label="Nombre" required size="md" />
          </div>
          <FormInput v-model="newContact.email" type="email" label="Email" size="md" />
          <FormInput v-model="newContact.phone" type="tel" label="Teléfono" size="md" />
          <FormInput v-model="newContact.vat" label="RFC" size="md" />
        </div>
      </section>

      <section class="space-y-4">
        <h3 class="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2">
          Información del trabajo
        </h3>
        <EmployeeForm
          v-model="formData"
          :department-options="departmentOptions"
          :manager-options="managerOptions"
        />
      </section>
    </div>
  </CardSheet>
</template>
