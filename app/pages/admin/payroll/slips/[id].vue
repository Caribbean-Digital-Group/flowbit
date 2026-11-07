<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { PayrollSlipLineRow, PayrollSlipViewRow } from '~/types/hr.types'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId, isSelectedCompanyAdmin, selectedCompany } = storeToRefs(authStore)
const { getSlip, getSlipLines } = usePayroll()

const slip = ref<PayrollSlipViewRow | null>(null)
const lines = ref<PayrollSlipLineRow[]>([])
const isLoading = ref(false)

const slipId = computed(() => String(route.params.id ?? ''))
const perceptions = computed(() => lines.value.filter(l => l.category === 'perception'))
const deductions = computed(() => lines.value.filter(l => l.category === 'deduction'))
const employerLines = computed(() => lines.value.filter(l => l.category === 'employer'))

const load = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId || !slipId.value) return
  isLoading.value = true
  try {
    slip.value = await getSlip(slipId.value, companyId)
    lines.value = slip.value ? await getSlipLines(slip.value.id) : []
  } finally {
    isLoading.value = false
  }
}

const goBack = () => {
  if (isSelectedCompanyAdmin.value && slip.value) router.push(`/admin/payroll/${slip.value.period_id}`)
  else router.push('/admin/payroll/my-payslips')
}

const print = () => {
  if (import.meta.client) window.print()
}

watch([slipId, selectedCompanyId], load, { immediate: true })
</script>

<template>
  <div class="w-full py-4">
    <HrNotice v-if="isLoading" kind="loading" message="Cargando recibo…" />
    <HrNotice v-else-if="!slip" kind="error" message="No se encontró el recibo o todavía no está disponible." />
    <template v-else>
      <div class="mb-4 flex flex-wrap justify-between gap-2 print:hidden">
        <BtnApp variant="ghost" size="sm" @click="goBack">
          ← Volver
        </BtnApp>
        <BtnApp variant="secondary" size="sm" @click="print">
          Imprimir
        </BtnApp>
      </div>

      <article class="rounded-2xl bg-white p-6 shadow-lg shadow-slate-200/50 sm:p-8 print:shadow-none">
        <header class="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:justify-between">
          <div>
            <p class="text-sm text-slate-500">
              Recibo de nómina
            </p>
            <h1 class="text-xl font-semibold text-slate-800">
              {{ selectedCompany?.name }}
            </h1>
            <p class="text-sm text-slate-500">
              {{ slip.period_name }}
            </p>
          </div>
          <div class="text-sm text-slate-600 sm:text-right">
            <p>Del {{ formatHrDate(slip.period_start) }} al {{ formatHrDate(slip.period_end) }}</p>
            <p>Fecha de pago: {{ formatHrDate(slip.payment_date) }}</p>
            <p>Estado: {{ PAYROLL_STATUS_LABELS[slip.period_status] }}</p>
          </div>
        </header>

        <section class="grid grid-cols-1 gap-4 border-b border-slate-200 py-6 text-sm sm:grid-cols-3">
          <div>
            <p class="text-slate-500">Empleado</p>
            <p class="font-medium text-slate-800">{{ slip.employee_name }}</p>
            <p class="text-slate-500">{{ slip.job_title ?? '' }} {{ slip.department_name ? `· ${slip.department_name}` : '' }}</p>
          </div>
          <div>
            <p class="text-slate-500">RFC / Número</p>
            <p class="text-slate-800">{{ slip.employee_rfc ?? '—' }} · {{ slip.employee_number ?? '—' }}</p>
          </div>
          <div>
            <p class="text-slate-500">Salario diario / SBC</p>
            <p class="text-slate-800">{{ formatMoney(slip.daily_salary) }} / {{ formatMoney(slip.contribution_base) }}</p>
          </div>
          <div>
            <p class="text-slate-500">Días pagados</p>
            <p class="text-slate-800">{{ Number(slip.paid_days) }} de {{ Number(slip.period_days) }}</p>
          </div>
          <div>
            <p class="text-slate-500">Faltas / vacaciones</p>
            <p class="text-slate-800">{{ Number(slip.absence_days) }} / {{ Number(slip.vacation_days) }}</p>
          </div>
          <div>
            <p class="text-slate-500">Horas extra (dobles / triples)</p>
            <p class="text-slate-800">{{ Number(slip.overtime_double_hours) }} / {{ Number(slip.overtime_triple_hours) }}</p>
          </div>
        </section>

        <section class="grid grid-cols-1 gap-6 py-6 md:grid-cols-2">
          <div>
            <h2 class="mb-3 font-semibold text-slate-800">Percepciones</h2>
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs text-slate-500">
                  <th class="pb-2 font-medium">Concepto</th>
                  <th class="pb-2 text-right font-medium">Gravado</th>
                  <th class="pb-2 text-right font-medium">Exento</th>
                  <th class="pb-2 text-right font-medium">Importe</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="l in perceptions" :key="l.id">
                  <td class="py-2 text-slate-700">
                    {{ l.name }}
                    <span v-if="l.sat_code" class="text-xs text-slate-400">({{ l.sat_code }})</span>
                    <span v-if="Number(l.quantity) !== 1" class="block text-xs text-slate-400">{{ Number(l.quantity) }} {{ l.code.startsWith('overtime') ? 'h' : 'días' }}</span>
                  </td>
                  <td class="py-2 text-right text-slate-500">{{ formatMoney(l.taxable_amount) }}</td>
                  <td class="py-2 text-right text-slate-500">{{ formatMoney(l.exempt_amount) }}</td>
                  <td class="py-2 text-right text-slate-800">{{ formatMoney(l.amount) }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="border-t border-slate-200 font-semibold">
                  <td class="pt-2">Total</td>
                  <td class="pt-2 text-right">{{ formatMoney(slip.total_taxable) }}</td>
                  <td class="pt-2 text-right">{{ formatMoney(slip.total_exempt) }}</td>
                  <td class="pt-2 text-right">{{ formatMoney(slip.total_perceptions) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div>
            <h2 class="mb-3 font-semibold text-slate-800">Deducciones</h2>
            <table class="w-full text-sm">
              <tbody class="divide-y divide-slate-100">
                <tr v-for="l in deductions" :key="l.id">
                  <td class="py-2 text-slate-700">
                    {{ l.name }}
                    <span v-if="l.sat_code" class="text-xs text-slate-400">({{ l.sat_code }})</span>
                  </td>
                  <td class="py-2 text-right text-slate-800">{{ formatMoney(l.amount) }}</td>
                </tr>
                <tr v-if="deductions.length === 0">
                  <td class="py-2 text-slate-400" colspan="2">Sin deducciones</td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="border-t border-slate-200 font-semibold">
                  <td class="pt-2">Total</td>
                  <td class="pt-2 text-right">{{ formatMoney(slip.total_deductions) }}</td>
                </tr>
              </tfoot>
            </table>
            <p v-if="Number(slip.subsidy) > 0" class="mt-3 text-xs text-slate-500">
              Subsidio para el empleo aplicado contra el ISR: {{ formatMoney(slip.subsidy) }}
            </p>
          </div>
        </section>

        <div class="flex items-center justify-between rounded-2xl bg-gradient-to-r from-indigo-500 via-violet-600 to-fuchsia-600 px-6 py-4 text-white">
          <span class="font-medium">Neto a pagar</span>
          <span class="text-2xl font-bold">{{ formatMoney(slip.net_pay) }}</span>
        </div>

        <section v-if="isSelectedCompanyAdmin" class="mt-8 print:hidden">
          <h2 class="mb-3 font-semibold text-slate-800">Costo para la empresa</h2>
          <div class="divide-y divide-slate-100 rounded-2xl border border-slate-200 text-sm">
            <div v-for="l in employerLines" :key="l.id" class="flex justify-between px-4 py-2">
              <span class="text-slate-600">{{ l.name }}</span>
              <span class="text-slate-800">{{ formatMoney(l.amount) }}</span>
            </div>
            <div class="flex justify-between px-4 py-2 font-semibold">
              <span>Costo total (percepciones + cuotas + ISN)</span>
              <span>{{ formatMoney(slip.employer_cost) }}</span>
            </div>
          </div>
        </section>

        <p class="mt-6 text-xs text-slate-400">
          Documento informativo. No sustituye al CFDI de nómina timbrado.
        </p>
      </article>
    </template>
  </div>
</template>
