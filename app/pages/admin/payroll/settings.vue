<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { HrSettingsRow, PayrollFiscalConfigRow } from '~/types/hr.types'
import type { ImssRates, PayrollFiscalParams } from '~/utils/payroll'

definePageMeta({ layout: 'admin' })

type Tab = 'fiscal' | 'hr'

const { selectedCompanyId, isSelectedCompanyAdmin } = storeToRefs(useAuthStore())
const { getConfigs, createConfig, updateConfig, lastError: payrollError } = usePayroll()
const { ensureDefaults, get: getSettings, update: updateSettings, lastError: settingsError } = useHrSettings()

const tab = ref<Tab>('fiscal')
const configs = ref<PayrollFiscalConfigRow[]>([])
const selectedYear = ref(new Date().getFullYear())
const params = ref<PayrollFiscalParams | null>(null)
const extra = ref({ employer_registration: '', employer_state: '', notes: '' })
const settings = ref<HrSettingsRow | null>(null)
const settingsForm = ref({
  timezone: 'America/Mexico_City',
  late_tolerance_minutes: 10 as number | string,
  overtime_min_minutes: 30 as number | string,
  overtime_requires_approval: true,
  kiosk_pin_min_length: 4 as number | string,
  payroll_frequency: 'biweekly' as HrSettingsRow['payroll_frequency']
})
const isLoading = ref(false)
const isSaving = ref(false)
const message = ref<{ kind: 'error' | 'success' | 'info'; text: string } | null>(null)

const currentConfig = computed(() => configs.value.find(c => c.fiscal_year === selectedYear.value) ?? null)

const yearOptions = computed(() => {
  const current = new Date().getFullYear()
  const years = new Set([current - 1, current, current + 1, ...configs.value.map(c => c.fiscal_year)])
  return [...years].sort((a, b) => b - a).map(y => ({
    value: y,
    label: configs.value.some(c => c.fiscal_year === y) ? String(y) : `${y} (sin configurar)`
  }))
})

const imssFields: { key: keyof ImssRates; label: string; who: 'Patrón' | 'Trabajador' }[] = [
  { key: 'fixedFeeEmployer', label: 'EyM cuota fija (% de la UMA)', who: 'Patrón' },
  { key: 'surplusEmployer', label: 'EyM excedente de 3 UMA', who: 'Patrón' },
  { key: 'surplusEmployee', label: 'EyM excedente de 3 UMA', who: 'Trabajador' },
  { key: 'cashBenefitsEmployer', label: 'EyM prestaciones en dinero', who: 'Patrón' },
  { key: 'cashBenefitsEmployee', label: 'EyM prestaciones en dinero', who: 'Trabajador' },
  { key: 'pensionersMedicalEmployer', label: 'EyM gastos médicos pensionados', who: 'Patrón' },
  { key: 'pensionersMedicalEmployee', label: 'EyM gastos médicos pensionados', who: 'Trabajador' },
  { key: 'disabilityLifeEmployer', label: 'Invalidez y vida', who: 'Patrón' },
  { key: 'disabilityLifeEmployee', label: 'Invalidez y vida', who: 'Trabajador' },
  { key: 'childcareEmployer', label: 'Guarderías y prestaciones sociales', who: 'Patrón' },
  { key: 'retirementEmployer', label: 'Retiro (SAR)', who: 'Patrón' },
  { key: 'oldAgeEmployee', label: 'Cesantía en edad avanzada y vejez', who: 'Trabajador' }
]

const loadConfigIntoForm = () => {
  const config = currentConfig.value
  params.value = config ? configToParams(config) : null
  extra.value = {
    employer_registration: config?.employer_registration ?? '',
    employer_state: config?.employer_state ?? '',
    notes: config?.notes ?? ''
  }
}

const load = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId || !isSelectedCompanyAdmin.value) return
  isLoading.value = true
  try {
    await ensureDefaults(companyId)
    const [c, s] = await Promise.all([getConfigs(companyId), getSettings(companyId)])
    configs.value = c
    settings.value = s
    if (s) {
      settingsForm.value = {
        timezone: s.timezone,
        late_tolerance_minutes: s.late_tolerance_minutes,
        overtime_min_minutes: s.overtime_min_minutes,
        overtime_requires_approval: s.overtime_requires_approval,
        kiosk_pin_min_length: s.kiosk_pin_min_length,
        payroll_frequency: s.payroll_frequency
      }
    }
    loadConfigIntoForm()
  } finally {
    isLoading.value = false
  }
}

const handleCreateYear = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) return
  const created = await createConfig(companyId, selectedYear.value)
  if (!created) {
    message.value = { kind: 'error', text: payrollError.value ?? 'No se pudo crear la configuración.' }
    return
  }
  message.value = {
    kind: 'info',
    text: `Se cargaron valores de referencia para ${selectedYear.value}. Verifica UMA, salarios mínimos, tarifa ISR y subsidio contra el DOF y el SAT antes de calcular.`
  }
  await load()
}

const addIsrRow = () => {
  if (!params.value) return
  const last = params.value.isrMonthlyTable[params.value.isrMonthlyTable.length - 1]
  params.value.isrMonthlyTable.push({ lower: last ? last.lower + 1 : 0.01, fixed: 0, rate: 0 })
}

const removeIsrRow = (index: number) => {
  params.value?.isrMonthlyTable.splice(index, 1)
}

const validateParams = (p: PayrollFiscalParams): string | null => {
  if (p.umaDaily <= 0 || p.minimumWageDaily <= 0 || p.minimumWageBorderDaily <= 0) return 'La UMA y los salarios mínimos deben ser mayores a cero.'
  if (p.isrMonthlyTable.length === 0) return 'La tarifa de ISR necesita al menos un rango.'
  const lowers = p.isrMonthlyTable.map(r => r.lower)
  if (lowers.some((l, i) => i > 0 && l <= lowers[i - 1]!)) return 'Los límites inferiores de la tarifa ISR deben ir de menor a mayor.'
  if (p.aguinaldoDays < 15) return 'El aguinaldo no puede ser menor a 15 días (art. 87 LFT).'
  if (p.vacationPremiumRate < 25) return 'La prima vacacional no puede ser menor a 25% (art. 80 LFT).'
  return null
}

const handleSaveFiscal = async () => {
  const config = currentConfig.value
  const p = params.value
  if (!config || !p) return
  // Los inputs numéricos pueden devolver texto: se normaliza antes de validar.
  const normalized: PayrollFiscalParams = {
    ...p,
    umaDaily: Number(p.umaDaily),
    minimumWageDaily: Number(p.minimumWageDaily),
    minimumWageBorderDaily: Number(p.minimumWageBorderDaily),
    subsidyUmaRate: Number(p.subsidyUmaRate),
    subsidyIncomeLimit: Number(p.subsidyIncomeLimit),
    riskPremiumRate: Number(p.riskPremiumRate),
    infonavitEmployerRate: Number(p.infonavitEmployerRate),
    isnRate: Number(p.isnRate),
    sbcCapUmas: Number(p.sbcCapUmas),
    vacationPremiumRate: Number(p.vacationPremiumRate),
    sundayPremiumRate: Number(p.sundayPremiumRate),
    aguinaldoDays: Number(p.aguinaldoDays),
    overtimeExemptUmasWeekly: Number(p.overtimeExemptUmasWeekly),
    vacationPremiumExemptUmas: Number(p.vacationPremiumExemptUmas),
    aguinaldoExemptUmas: Number(p.aguinaldoExemptUmas),
    isrMonthlyTable: p.isrMonthlyTable.map(r => ({ lower: Number(r.lower), fixed: Number(r.fixed), rate: Number(r.rate) })),
    cesantiaEmployerTable: p.cesantiaEmployerTable.map(r => ({ upTo: r.upTo === null ? null : Number(r.upTo), rate: Number(r.rate) })),
    imssRates: Object.fromEntries(Object.entries(p.imssRates).map(([k, v]) => [k, Number(v)])) as unknown as ImssRates
  }
  const error = validateParams(normalized)
  if (error) {
    message.value = { kind: 'error', text: error }
    return
  }
  isSaving.value = true
  try {
    const saved = await updateConfig(config.id, {
      ...paramsToConfig(normalized),
      employer_registration: trimToNull(extra.value.employer_registration),
      employer_state: trimToNull(extra.value.employer_state),
      notes: trimToNull(extra.value.notes)
    })
    if (!saved) {
      message.value = { kind: 'error', text: payrollError.value ?? 'No se pudo guardar.' }
      return
    }
    message.value = { kind: 'success', text: `Configuración fiscal ${selectedYear.value} guardada. Recalcula las nóminas abiertas para aplicarla.` }
    await load()
  } finally {
    isSaving.value = false
  }
}

const handleSaveSettings = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) return
  isSaving.value = true
  try {
    const saved = await updateSettings(companyId, {
      timezone: settingsForm.value.timezone,
      late_tolerance_minutes: Number(settingsForm.value.late_tolerance_minutes) || 0,
      overtime_min_minutes: Number(settingsForm.value.overtime_min_minutes) || 0,
      overtime_requires_approval: settingsForm.value.overtime_requires_approval,
      kiosk_pin_min_length: Number(settingsForm.value.kiosk_pin_min_length) || 4,
      payroll_frequency: settingsForm.value.payroll_frequency
    })
    message.value = saved
      ? { kind: 'success', text: 'Ajustes de RR. HH. guardados. Aplican a las marcas nuevas o editadas.' }
      : { kind: 'error', text: settingsError.value ?? 'No se pudo guardar.' }
  } finally {
    isSaving.value = false
  }
}

watch(selectedYear, loadConfigIntoForm)
watch(selectedCompanyId, load, { immediate: true })
</script>

<template>
  <div class="w-full py-4">
    <HrNotice v-if="!selectedCompanyId" kind="no-company" />
    <HrNotice v-else-if="!isSelectedCompanyAdmin" kind="admin-only" />
    <HrNotice v-else-if="isLoading" kind="loading" message="Cargando configuración…" />
    <template v-else>
      <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-semibold text-slate-800">
            Configuración de nómina
          </h1>
          <p class="text-sm text-slate-500">
            Parámetros fiscales por año y reglas de asistencia de la empresa
          </p>
        </div>
        <div class="flex gap-2">
          <BtnApp :variant="tab === 'fiscal' ? 'primary' : 'secondary'" size="sm" @click="tab = 'fiscal'">
            Fiscal (ISR, IMSS, INFONAVIT)
          </BtnApp>
          <BtnApp :variant="tab === 'hr' ? 'primary' : 'secondary'" size="sm" @click="tab = 'hr'">
            Asistencia y kiosco
          </BtnApp>
        </div>
      </div>

      <HrNotice v-if="message" :kind="message.kind" :message="message.text" class="mb-4" />

      <!-- ── Fiscal ─────────────────────────────────────────────── -->
      <template v-if="tab === 'fiscal'">
        <div class="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-lg shadow-slate-200/50">
          <div class="w-56">
            <FormSelect v-model="selectedYear" label="Ejercicio fiscal" :options="yearOptions" size="md" />
          </div>
          <BtnApp v-if="!currentConfig" variant="primary" size="md" @click="handleCreateYear">
            Configurar {{ selectedYear }}
          </BtnApp>
          <BtnApp v-else variant="primary" size="md" :loading="isSaving" @click="handleSaveFiscal">
            Guardar {{ selectedYear }}
          </BtnApp>
        </div>

        <HrNotice
          v-if="!currentConfig"
          kind="info"
          :message="`No hay parámetros para ${selectedYear}. Al configurarlo se cargan valores de referencia (o los de tu empresa del año anterior para prima de riesgo e ISN) que debes revisar.`"
        />

        <div v-else-if="params" class="space-y-6">
          <HrNotice
            kind="info"
            message="Los valores cambian cada año (UMA en febrero, salario mínimo en enero, tarifas ISR y subsidio por publicación del SAT). Verifícalos contra el DOF antes de calcular. Flowbit no los actualiza solo."
          />

          <section class="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/50">
            <h2 class="mb-4 font-semibold text-slate-800">
              Valores base
            </h2>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FormInput v-model="params.umaDaily" type="number" step="0.01" label="UMA diaria" size="md" />
              <FormInput v-model="params.minimumWageDaily" type="number" step="0.01" label="Salario mínimo general" size="md" />
              <FormInput v-model="params.minimumWageBorderDaily" type="number" step="0.01" label="Salario mínimo zona libre frontera" size="md" />
              <label class="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
                <input v-model="params.useBorderZone" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-indigo-600">
                La empresa está en zona libre de la frontera norte
              </label>
              <FormInput v-model="params.sbcCapUmas" type="number" step="0.01" label="Tope del SBC (veces UMA)" size="md" />
              <FormInput v-model="extra.employer_registration" label="Registro patronal IMSS" size="md" />
              <FormSelect v-model="extra.employer_state" label="Estado (ISN)" :options="CFDI_STATE_OPTIONS" clearable size="md" />
              <FormInput v-model="params.isnRate" type="number" step="0.01" label="Impuesto sobre nómina (%)" hint="Tasa estatal sobre el total de percepciones." size="md" />
            </div>
          </section>

          <section class="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/50">
            <h2 class="mb-1 font-semibold text-slate-800">
              ISR — tarifa mensual (art. 96 LISR)
            </h2>
            <p class="mb-4 text-sm text-slate-500">
              El cálculo la proporciona a los días del periodo (tarifa ÷ 30.4 × días).
            </p>
            <div class="overflow-x-auto">
              <table class="w-full min-w-[32rem] text-sm">
                <thead>
                  <tr class="text-left text-xs text-slate-500">
                    <th class="pb-2 font-medium">Límite inferior</th>
                    <th class="pb-2 font-medium">Cuota fija</th>
                    <th class="pb-2 font-medium">% sobre excedente</th>
                    <th class="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, i) in params.isrMonthlyTable" :key="i">
                    <td class="pr-2 py-1"><FormInput v-model="row.lower" type="number" step="0.01" size="sm" /></td>
                    <td class="pr-2 py-1"><FormInput v-model="row.fixed" type="number" step="0.01" size="sm" /></td>
                    <td class="pr-2 py-1"><FormInput v-model="row.rate" type="number" step="0.01" size="sm" /></td>
                    <td class="py-1 text-right">
                      <BtnApp variant="ghost" size="sm" @click="removeIsrRow(i)">
                        Quitar
                      </BtnApp>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <BtnApp variant="secondary" size="sm" class="mt-3" @click="addIsrRow">
              Agregar rango
            </BtnApp>

            <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormInput v-model="params.subsidyUmaRate" type="number" step="0.01" label="Subsidio para el empleo (% de la UMA mensual)" size="md" />
              <FormInput v-model="params.subsidyIncomeLimit" type="number" step="0.01" label="Ingreso mensual máximo para subsidio" size="md" />
            </div>
          </section>

          <section class="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/50">
            <h2 class="mb-4 font-semibold text-slate-800">
              IMSS — cuotas obrero-patronales (%)
            </h2>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormInput
                v-for="field in imssFields"
                :key="field.key"
                v-model="params.imssRates[field.key]"
                type="number"
                step="0.001"
                :label="`${field.label} · ${field.who}`"
                size="md"
              />
              <FormInput
                v-model="params.riskPremiumRate"
                type="number"
                step="0.00001"
                label="Prima de riesgo de trabajo · Patrón"
                hint="La que determinó tu empresa ante el IMSS (mínimo 0.5%)."
                size="md"
              />
            </div>

            <h3 class="mt-6 mb-1 text-sm font-semibold text-slate-800">
              Cesantía en edad avanzada y vejez · cuota patronal progresiva
            </h3>
            <p class="mb-3 text-sm text-slate-500">
              Según el SBC en veces UMA. El primer rango aplica a quien gana el salario mínimo.
            </p>
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div v-for="(row, i) in params.cesantiaEmployerTable" :key="i" class="rounded-xl border border-slate-200 p-3">
                <p class="mb-2 text-xs text-slate-500">
                  {{ i === 0 ? 'Salario mínimo' : row.upTo === null ? `Más de ${params.cesantiaEmployerTable[i - 1]?.upTo} UMA` : `Hasta ${row.upTo} UMA` }}
                </p>
                <FormInput v-model="row.rate" type="number" step="0.001" size="sm" />
              </div>
            </div>

            <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormInput v-model="params.infonavitEmployerRate" type="number" step="0.01" label="INFONAVIT aportación patronal (%)" size="md" />
            </div>
          </section>

          <section class="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/50">
            <h2 class="mb-4 font-semibold text-slate-800">
              Prestaciones y exenciones
            </h2>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormInput v-model="params.aguinaldoDays" type="number" label="Días de aguinaldo" hint="Mínimo de ley: 15." size="md" />
              <FormInput v-model="params.vacationPremiumRate" type="number" step="0.01" label="Prima vacacional (%)" hint="Mínimo de ley: 25%." size="md" />
              <FormInput v-model="params.sundayPremiumRate" type="number" step="0.01" label="Prima dominical (%)" size="md" />
              <FormInput v-model="params.overtimeExemptUmasWeekly" type="number" step="0.01" label="Horas extra exentas (UMA por semana)" size="md" />
              <FormInput v-model="params.vacationPremiumExemptUmas" type="number" step="0.01" label="Prima vacacional exenta (UMA)" size="md" />
              <FormInput v-model="params.aguinaldoExemptUmas" type="number" step="0.01" label="Aguinaldo exento (UMA)" size="md" />
            </div>
            <div class="mt-4">
              <FormTextArea v-model="extra.notes" label="Notas" placeholder="Ej: Valores verificados con el DOF del 10 de enero" :rows="2" size="md" />
            </div>
          </section>
        </div>
      </template>

      <!-- ── Asistencia y kiosco ───────────────────────────────── -->
      <section v-else class="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg shadow-slate-200/50">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormSelect v-model="settingsForm.timezone" label="Zona horaria" :options="TIMEZONE_OPTIONS" size="md" />
          <FormSelect v-model="settingsForm.payroll_frequency" label="Periodicidad de nómina" :options="PAYROLL_FREQUENCY_OPTIONS" size="md" />
          <FormInput
            v-model="settingsForm.late_tolerance_minutes"
            type="number"
            min="0"
            max="240"
            label="Tolerancia de retardo (min)"
            hint="Cada horario puede tener la suya."
            size="md"
          />
          <FormInput
            v-model="settingsForm.overtime_min_minutes"
            type="number"
            min="0"
            max="240"
            label="Mínimo para contar horas extra (min)"
            hint="Por debajo de este tiempo extra no se registran."
            size="md"
          />
          <FormInput
            v-model="settingsForm.kiosk_pin_min_length"
            type="number"
            min="4"
            max="8"
            label="Longitud mínima del NIP"
            size="md"
          />
          <label class="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
            <input v-model="settingsForm.overtime_requires_approval" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-indigo-600">
            Las horas extra requieren aprobación antes de pagarse
          </label>
        </div>
        <div class="mt-6 flex justify-end">
          <BtnApp variant="primary" size="md" :loading="isSaving" @click="handleSaveSettings">
            Guardar ajustes
          </BtnApp>
        </div>
      </section>
    </template>
  </div>
</template>
