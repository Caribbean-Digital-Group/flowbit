<script lang="ts">
import type { EmployeePrivateRow, EmployeePrivateUpdate } from '~/types/employee.types'

export type EmployeeSensitiveSection = 'private' | 'hr' | 'cfdi'

export interface EmployeePrivateFormData {
  birth_date: string
  curp: string
  nss: string
  marital_status: string
  gender: string
  nationality: string
  birth_place: string
  dependents_count: string | number
  education_level: string
  emergency_contact_name: string
  emergency_contact_phone: string
  bank_name: string
  bank_clabe: string
  bank_account: string
  employee_type: string
  monthly_salary: string | number
  salary_currency: string
  weekly_hours: string | number
  vacation_days: string | number
  termination_reason: string
  hr_notes: string
  cfdi_tax_regime: string
  cfdi_tax_zip: string
  cfdi_contract_type: string
  cfdi_workday_type: string
  cfdi_payroll_regime: string
  cfdi_payment_frequency: string
  cfdi_job_risk: string
  cfdi_unionized: string
  cfdi_employer_registration: string
  cfdi_contribution_base: string | number
  cfdi_integrated_daily_wage: string | number
  cfdi_state: string
  infonavit_credit_number: string
  infonavit_discount_type: string
  infonavit_discount_value: string | number
}

export const createEmptyEmployeePrivateForm = (): EmployeePrivateFormData => ({
  birth_date: '',
  curp: '',
  nss: '',
  marital_status: '',
  gender: '',
  nationality: '',
  birth_place: '',
  dependents_count: 0,
  education_level: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  bank_name: '',
  bank_clabe: '',
  bank_account: '',
  employee_type: 'employee',
  monthly_salary: '',
  salary_currency: 'MXN',
  weekly_hours: '',
  vacation_days: '',
  termination_reason: '',
  hr_notes: '',
  cfdi_tax_regime: '605',
  cfdi_tax_zip: '',
  cfdi_contract_type: '',
  cfdi_workday_type: '',
  cfdi_payroll_regime: '',
  cfdi_payment_frequency: '',
  cfdi_job_risk: '',
  cfdi_unionized: 'no',
  cfdi_employer_registration: '',
  cfdi_contribution_base: '',
  cfdi_integrated_daily_wage: '',
  cfdi_state: '',
  infonavit_credit_number: '',
  infonavit_discount_type: 'none',
  infonavit_discount_value: ''
})

export const mapEmployeePrivateToForm = (row: EmployeePrivateRow): EmployeePrivateFormData => ({
  birth_date: row.birth_date ?? '',
  curp: row.curp ?? '',
  nss: row.nss ?? '',
  marital_status: row.marital_status ?? '',
  gender: row.gender ?? '',
  nationality: row.nationality ?? '',
  birth_place: row.birth_place ?? '',
  dependents_count: row.dependents_count,
  education_level: row.education_level ?? '',
  emergency_contact_name: row.emergency_contact_name ?? '',
  emergency_contact_phone: row.emergency_contact_phone ?? '',
  bank_name: row.bank_name ?? '',
  bank_clabe: row.bank_clabe ?? '',
  bank_account: row.bank_account ?? '',
  employee_type: row.employee_type,
  monthly_salary: row.monthly_salary ?? '',
  salary_currency: row.salary_currency,
  weekly_hours: row.weekly_hours ?? '',
  vacation_days: row.vacation_days ?? '',
  termination_reason: row.termination_reason ?? '',
  hr_notes: row.hr_notes ?? '',
  cfdi_tax_regime: row.cfdi_tax_regime ?? '',
  cfdi_tax_zip: row.cfdi_tax_zip ?? '',
  cfdi_contract_type: row.cfdi_contract_type ?? '',
  cfdi_workday_type: row.cfdi_workday_type ?? '',
  cfdi_payroll_regime: row.cfdi_payroll_regime ?? '',
  cfdi_payment_frequency: row.cfdi_payment_frequency ?? '',
  cfdi_job_risk: row.cfdi_job_risk ?? '',
  cfdi_unionized: row.cfdi_unionized ? 'yes' : 'no',
  cfdi_employer_registration: row.cfdi_employer_registration ?? '',
  cfdi_contribution_base: row.cfdi_contribution_base ?? '',
  cfdi_integrated_daily_wage: row.cfdi_integrated_daily_wage ?? '',
  cfdi_state: row.cfdi_state ?? '',
  infonavit_credit_number: row.infonavit_credit_number ?? '',
  infonavit_discount_type: row.infonavit_discount_type ?? 'none',
  infonavit_discount_value: row.infonavit_discount_value ?? ''
})

export const mapFormToEmployeePrivateUpdate = (form: EmployeePrivateFormData): EmployeePrivateUpdate => ({
  birth_date: form.birth_date || null,
  curp: trimToNull(form.curp)?.toUpperCase() ?? null,
  nss: trimToNull(form.nss),
  marital_status: form.marital_status || null,
  gender: form.gender || null,
  nationality: trimToNull(form.nationality),
  birth_place: trimToNull(form.birth_place),
  dependents_count: toNumberOrNull(form.dependents_count) ?? 0,
  education_level: form.education_level || null,
  emergency_contact_name: trimToNull(form.emergency_contact_name),
  emergency_contact_phone: trimToNull(form.emergency_contact_phone),
  bank_name: trimToNull(form.bank_name),
  bank_clabe: trimToNull(form.bank_clabe),
  bank_account: trimToNull(form.bank_account),
  employee_type: form.employee_type || 'employee',
  monthly_salary: toNumberOrNull(form.monthly_salary),
  salary_currency: trimToNull(form.salary_currency)?.toUpperCase() ?? 'MXN',
  weekly_hours: toNumberOrNull(form.weekly_hours),
  vacation_days: toNumberOrNull(form.vacation_days),
  termination_reason: trimToNull(form.termination_reason),
  hr_notes: trimToNull(form.hr_notes),
  cfdi_tax_regime: form.cfdi_tax_regime || null,
  cfdi_tax_zip: trimToNull(form.cfdi_tax_zip),
  cfdi_contract_type: form.cfdi_contract_type || null,
  cfdi_workday_type: form.cfdi_workday_type || null,
  cfdi_payroll_regime: form.cfdi_payroll_regime || null,
  cfdi_payment_frequency: form.cfdi_payment_frequency || null,
  cfdi_job_risk: form.cfdi_job_risk || null,
  cfdi_unionized: form.cfdi_unionized === 'yes',
  cfdi_employer_registration: trimToNull(form.cfdi_employer_registration),
  cfdi_contribution_base: toNumberOrNull(form.cfdi_contribution_base),
  cfdi_integrated_daily_wage: toNumberOrNull(form.cfdi_integrated_daily_wage),
  cfdi_state: form.cfdi_state || null,
  infonavit_credit_number: trimToNull(form.infonavit_credit_number),
  infonavit_discount_type: (form.infonavit_discount_type || 'none') as EmployeePrivateRow['infonavit_discount_type'],
  infonavit_discount_value: form.infonavit_discount_type === 'none' ? 0 : toNumberOrNull(form.infonavit_discount_value) ?? 0
})
</script>

<script setup lang="ts">
interface Props {
  section: EmployeeSensitiveSection
  readonly?: boolean
  showTerminationReason?: boolean
}

withDefaults(defineProps<Props>(), {
  readonly: false,
  showTerminationReason: false
})

const formData = defineModel<EmployeePrivateFormData>({ required: true })

const yesNoOptions: EmployeeOption[] = [
  { value: 'no', label: 'No' },
  { value: 'yes', label: 'Sí' }
]
</script>

<template>
  <!-- INFORMACIÓN PRIVADA -->
  <div v-if="section === 'private'" class="grid grid-cols-1 lg:grid-cols-2 gap-8">
    <div class="space-y-4">
      <h3 class="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2">
        Datos personales
      </h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormInput v-model="formData.birth_date" type="date" label="Fecha de nacimiento" :readonly="readonly" size="md" />
        <FormInput v-model="formData.birth_place" label="Lugar de nacimiento" :readonly="readonly" size="md" />
        <FormInput v-model="formData.curp" label="CURP" placeholder="18 caracteres" :maxlength="18" :readonly="readonly" size="md" />
        <FormInput v-model="formData.nss" label="NSS" placeholder="11 dígitos" :maxlength="11" :readonly="readonly" size="md" />
        <FormInput v-model="formData.nationality" label="Nacionalidad" placeholder="Ej: Mexicana" :readonly="readonly" size="md" />
        <FormSelect v-model="formData.gender" label="Género" :options="GENDER_OPTIONS" :disabled="readonly" :searchable="false" clearable size="md" />
        <FormSelect v-model="formData.marital_status" label="Estado civil" :options="MARITAL_STATUS_OPTIONS" :disabled="readonly" :searchable="false" clearable size="md" />
        <FormInput v-model="formData.dependents_count" type="number" label="Dependientes" min="0" :readonly="readonly" size="md" />
        <FormSelect v-model="formData.education_level" label="Escolaridad" :options="EDUCATION_LEVEL_OPTIONS" :disabled="readonly" :searchable="false" clearable size="md" />
      </div>
    </div>

    <div class="space-y-4">
      <h3 class="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2">
        Contacto de emergencia
      </h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormInput v-model="formData.emergency_contact_name" label="Nombre" :readonly="readonly" size="md" />
        <FormInput v-model="formData.emergency_contact_phone" type="tel" label="Teléfono" :readonly="readonly" size="md" />
      </div>

      <h3 class="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2">
        Datos bancarios
      </h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormInput v-model="formData.bank_name" label="Banco" :readonly="readonly" size="md" />
        <FormInput v-model="formData.bank_account" label="Cuenta" :readonly="readonly" size="md" />
        <div class="sm:col-span-2">
          <FormInput v-model="formData.bank_clabe" label="CLABE" placeholder="18 dígitos" :maxlength="18" :readonly="readonly" size="md" />
        </div>
      </div>
    </div>
  </div>

  <!-- AJUSTES DE RR. HH. -->
  <div v-else-if="section === 'hr'" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <FormSelect v-model="formData.employee_type" label="Tipo de empleado" :options="EMPLOYEE_TYPE_OPTIONS" :disabled="readonly" :searchable="false" required size="md" />
    <FormInput v-model="formData.monthly_salary" type="number" label="Sueldo mensual" min="0" step="0.01" hint="Se actualiza al registrar un salario en Recursos Humanos → Salarios." :readonly="readonly" size="md" />
    <FormInput v-model="formData.salary_currency" label="Moneda" placeholder="MXN" :maxlength="3" :readonly="readonly" size="md" />
    <FormInput v-model="formData.weekly_hours" type="number" label="Horas por semana" min="0" max="168" step="0.5" :readonly="readonly" size="md" />
    <FormInput v-model="formData.vacation_days" type="number" label="Días de vacaciones" min="0" hint="Vacío: los de ley según antigüedad. Con valor: se asignan estos días cada año." :readonly="readonly" size="md" />
    <div v-if="showTerminationReason" class="sm:col-span-2">
      <FormTextArea v-model="formData.termination_reason" label="Motivo de baja" :readonly="readonly" :rows="3" size="md" />
    </div>
    <div class="sm:col-span-2 mt-2 border-t border-slate-100 pt-4">
      <p class="mb-3 text-sm font-semibold text-slate-800">
        Crédito INFONAVIT
      </p>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FormInput v-model="formData.infonavit_credit_number" label="Número de crédito" :readonly="readonly" size="md" />
        <FormSelect v-model="formData.infonavit_discount_type" label="Tipo de descuento" :options="INFONAVIT_DISCOUNT_OPTIONS" :disabled="readonly" :searchable="false" size="md" />
        <FormInput
          v-if="formData.infonavit_discount_type !== 'none'"
          v-model="formData.infonavit_discount_value"
          type="number"
          min="0"
          step="0.0001"
          :label="formData.infonavit_discount_type === 'percentage' ? 'Porcentaje del SBC' : formData.infonavit_discount_type === 'fixed' ? 'Cuota fija mensual' : 'Factor (veces UMA)'"
          :readonly="readonly"
          size="md"
        />
      </div>
    </div>
    <div class="sm:col-span-2">
      <FormTextArea v-model="formData.hr_notes" label="Notas de RR. HH." :readonly="readonly" :rows="4" size="md" />
    </div>
  </div>

  <!-- CFDI -->
  <div v-else class="space-y-4">
    <p class="rounded-2xl border border-sky-100 bg-sky-50 px-5 py-3 text-sm text-sky-800">
      Estos datos se guardan para el CFDI de nómina. La nómina usa el SBC y el SDI del salario vigente (Recursos Humanos → Salarios). Flowbit todavía no timbra comprobantes.
    </p>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <FormSelect v-model="formData.cfdi_tax_regime" label="Régimen fiscal" :options="CFDI_TAX_REGIME_OPTIONS" :disabled="readonly" :searchable="false" clearable size="md" />
      <FormInput v-model="formData.cfdi_tax_zip" label="Código postal fiscal" placeholder="5 dígitos" :maxlength="5" :readonly="readonly" size="md" />
      <FormSelect v-model="formData.cfdi_contract_type" label="Tipo de contrato" :options="CFDI_CONTRACT_TYPE_OPTIONS" :disabled="readonly" clearable size="md" />
      <FormSelect v-model="formData.cfdi_workday_type" label="Tipo de jornada" :options="CFDI_WORKDAY_TYPE_OPTIONS" :disabled="readonly" clearable size="md" />
      <FormSelect v-model="formData.cfdi_payroll_regime" label="Tipo de régimen de nómina" :options="CFDI_PAYROLL_REGIME_OPTIONS" :disabled="readonly" clearable size="md" />
      <FormSelect v-model="formData.cfdi_payment_frequency" label="Periodicidad de pago" :options="CFDI_PAYMENT_FREQUENCY_OPTIONS" :disabled="readonly" clearable size="md" />
      <FormSelect v-model="formData.cfdi_job_risk" label="Riesgo del puesto" :options="CFDI_JOB_RISK_OPTIONS" :disabled="readonly" :searchable="false" clearable size="md" />
      <FormSelect v-model="formData.cfdi_state" label="Entidad federativa" :options="CFDI_STATE_OPTIONS" :disabled="readonly" clearable size="md" />
      <FormInput v-model="formData.cfdi_employer_registration" label="Registro patronal" :readonly="readonly" size="md" />
      <FormSelect v-model="formData.cfdi_unionized" label="Sindicalizado" :options="yesNoOptions" :disabled="readonly" :searchable="false" size="md" />
      <FormInput v-model="formData.cfdi_contribution_base" type="number" label="Salario base de cotización (SBC)" min="0" step="0.01" :readonly="readonly" size="md" />
      <FormInput v-model="formData.cfdi_integrated_daily_wage" type="number" label="Salario diario integrado (SDI)" min="0" step="0.01" :readonly="readonly" size="md" />
    </div>
  </div>
</template>
