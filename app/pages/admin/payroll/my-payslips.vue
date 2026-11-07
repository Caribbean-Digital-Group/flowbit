<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'

definePageMeta({ layout: 'admin' })

const { selectedCompanyId, partner } = storeToRefs(useAuthStore())
const { getByPartner } = useEmployee()
const { getSlipsByEmployee } = usePayroll()
const { getBalances } = useLeave()

const rows = ref<Record<string, unknown>[]>([])
const vacationBalance = ref<number | null>(null)
const isEmployee = ref(true)
const isLoading = ref(false)

const columns: Column[] = [
  { key: 'period', label: 'Periodo', type: 'text' },
  { key: 'payment_date', label: 'Fecha de pago', type: 'date' },
  { key: 'perceptions', label: 'Percepciones', type: 'currency', currency: 'MXN', align: 'right' },
  { key: 'deductions', label: 'Deducciones', type: 'currency', currency: 'MXN', align: 'right' },
  { key: 'net', label: 'Neto', type: 'currency', currency: 'MXN', align: 'right' }
]

const load = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId || !partner.value) return
  isLoading.value = true
  try {
    const employee = await getByPartner(partner.value.id, companyId)
    isEmployee.value = Boolean(employee)
    if (!employee) return
    const [slips, balances] = await Promise.all([
      getSlipsByEmployee(companyId, employee.id),
      getBalances(companyId, employee.id)
    ])
    rows.value = slips
      .filter(s => s.period_status === 'approved' || s.period_status === 'paid')
      .map(s => ({
        id: s.id,
        period: s.period_name,
        payment_date: s.payment_date ?? s.period_end,
        perceptions: Number(s.total_perceptions),
        deductions: Number(s.total_deductions),
        net: Number(s.net_pay)
      }))
    vacationBalance.value = balances.length ? balances.reduce((sum, b) => sum + b.remaining_days, 0) : null
  } finally {
    isLoading.value = false
  }
}

watch([selectedCompanyId, partner], load, { immediate: true })
</script>

<template>
  <div class="w-full py-4">
    <HrNotice v-if="!selectedCompanyId" kind="no-company" />
    <HrNotice v-else-if="isLoading" kind="loading" message="Cargando tus recibos…" />
    <HrNotice
      v-else-if="!isEmployee"
      kind="info"
      message="Tu usuario no está registrado como empleado de esta empresa."
    />
    <template v-else>
      <div class="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-6 py-4 shadow-lg shadow-slate-200/50">
        <div>
          <p class="text-sm text-slate-500">
            Vacaciones disponibles
          </p>
          <p class="text-2xl font-semibold text-slate-800">
            {{ vacationBalance === null ? '—' : `${vacationBalance} días` }}
          </p>
        </div>
        <BtnApp variant="primary" size="sm" @click="navigateTo('/admin/leaves/create')">
          Solicitar vacaciones o permiso
        </BtnApp>
      </div>
      <Datatable
        title="Mis recibos de nómina"
        description="Recibos de nóminas aprobadas o pagadas"
        :data="rows"
        :columns="columns"
        :exportable="false"
        empty-title="Sin recibos"
        empty-message="Aquí aparecerán tus recibos cuando se apruebe una nómina."
        @row-click="row => navigateTo(`/admin/payroll/slips/${row.id}`)"
      >
        <template #actions="{ row }">
          <BtnApp variant="ghost" size="sm" title="Ver detalle" @click="navigateTo(`/admin/payroll/slips/${row.id}`)">
            <template #iconLeft>
              <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </template>
          </BtnApp>
        </template>
      </Datatable>
    </template>
  </div>
</template>
