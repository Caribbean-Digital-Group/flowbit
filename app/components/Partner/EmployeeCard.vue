<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { EmployeeViewRow } from '~/types/employee.types'

interface Props {
  partnerId: string
}

const props = defineProps<Props>()

const authStore = useAuthStore()
const { selectedCompanyId, isSelectedCompanyAdmin } = storeToRefs(authStore)
const { getByPartner, register, lastError } = useEmployee()

const employee = ref<EmployeeViewRow | null>(null)
const isLoading = ref(false)
const isSaving = ref(false)

const load = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) return
  isLoading.value = true
  try {
    employee.value = await getByPartner(props.partnerId, companyId)
  } finally {
    isLoading.value = false
  }
}

const markAsEmployee = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) return
  isSaving.value = true
  try {
    const created = await register(companyId, { partnerId: props.partnerId })
    if (created) await navigateTo(`/admin/employees/${created.id}`)
  } finally {
    isSaving.value = false
  }
}

watch([() => props.partnerId, selectedCompanyId], load, { immediate: true })
</script>

<template>
  <section
    v-if="!isLoading && (employee || isSelectedCompanyAdmin)"
    class="mt-8 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4"
  >
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="font-semibold text-slate-800">
          {{ employee ? 'Es empleado de esta empresa' : 'Empleado' }}
        </p>
        <p class="text-sm text-slate-500">
          {{ employee
            ? (employee.job_title || 'Sin puesto asignado')
            : 'Marca este contacto como empleado para llevar su expediente laboral.' }}
        </p>
      </div>
      <BtnApp
        v-if="employee"
        variant="secondary"
        size="sm"
        @click="navigateTo(`/admin/employees/${employee.id}`)"
      >
        Ver expediente
      </BtnApp>
      <BtnApp
        v-else
        variant="primary"
        size="sm"
        :disabled="isSaving"
        @click="markAsEmployee"
      >
        Marcar como empleado
      </BtnApp>
    </div>
    <p v-if="lastError" class="mt-3 text-sm text-red-700">
      {{ lastError }}
    </p>
  </section>
</template>
