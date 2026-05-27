<script lang="ts">
export interface ApprovalManagerFormData {
  partner_id: string
  notes: string
  active: boolean
  category_ids: string[]
}

export const createEmptyApprovalManagerForm = (): ApprovalManagerFormData => ({
  partner_id: '',
  notes: '',
  active: true,
  category_ids: []
})
</script>

<script setup lang="ts">
interface CategoryOption {
  id: string
  label: string
}

interface PartnerOption {
  value: string
  label: string
  /** Si no hay usuario enlazado, no podrá iniciar sesión para aprobar. */
  hasUser: boolean
}

interface Props {
  readonly?: boolean
  partnerOptions: PartnerOption[]
  categoryOptions: CategoryOption[]
  partnerLocked?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  partnerLocked: false
})

const formData = defineModel<ApprovalManagerFormData>({ required: true })

const partnerModel = computed({
  get: () => formData.value.partner_id,
  set: (v: string) => {
    formData.value.partner_id = v ?? ''
  }
})

const toggleCategory = (categoryId: string) => {
  if (props.readonly) return
  const idx = formData.value.category_ids.indexOf(categoryId)
  if (idx >= 0) {
    formData.value.category_ids.splice(idx, 1)
    return
  }
  formData.value.category_ids.push(categoryId)
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <FormSelect
        v-model="partnerModel"
        label="Miembro del equipo"
        placeholder="Selecciona un miembro con acceso confirmado"
        :options="partnerOptions.map(o => ({ value: o.value, label: o.label }))"
        :disabled="readonly || partnerLocked"
        searchable
        required
      />
      <p class="mt-2 text-xs text-slate-500">
        Solo aparecen miembros del equipo con invitación aceptada, rol de dueño o miembro y usuario vinculado.
        Los registrados aquí podrán ser asignados como aprobadores en las solicitudes.
      </p>
    </div>

    <FormTextArea
      v-model="formData.notes"
      label="Notas del rol"
      placeholder="Ámbitos, excepciones u observaciones"
      :rows="3"
      :readonly="readonly"
    />

    <div class="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/40">
      <p class="text-sm font-semibold text-slate-800 mb-1">
        Categorías que puede aprobar
      </p>
      <p class="text-xs text-slate-500 mb-4">
        Deja todas sin marcar si puede autorizar cualquier categoría disponible para solicitudes.
      </p>
      <div class="space-y-3 max-h-56 overflow-y-auto pr-1">
        <label
          v-for="c in categoryOptions"
          :key="c.id"
          class="flex items-start gap-3 cursor-pointer"
          :class="readonly ? 'cursor-default opacity-70' : ''"
        >
          <input
            type="checkbox"
            class="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            :checked="formData.category_ids.includes(c.id)"
            :disabled="readonly"
            @change="toggleCategory(c.id)"
          >
          <span class="text-sm text-slate-700">{{ c.label }}</span>
        </label>
      </div>
    </div>

    <div
      class="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
    >
      <div>
        <p class="text-sm font-medium text-slate-800">
          Registro activo
        </p>
        <p class="text-xs text-slate-500">
          Un gerente inactivo no aparece para nuevas asignaciones ni puede ejecutar acciones de aprobación.
        </p>
      </div>
      <label class="relative inline-flex items-center cursor-pointer self-start sm:self-auto">
        <input
          v-model="formData.active"
          type="checkbox"
          class="sr-only peer"
          :disabled="readonly"
        >
        <div
          class="w-11 h-6 bg-slate-200 peer-focus:ring-4 peer-focus:ring-indigo-100 rounded-full
            peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full
            peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px]
            after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full
            after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"
        />
      </label>
    </div>
  </div>
</template>
