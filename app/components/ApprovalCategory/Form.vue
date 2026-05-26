<script lang="ts">
export interface ApprovalCategoryFormData {
  name: string
  internal_code: string
  description: string
  active: boolean
}

export const createEmptyApprovalCategoryForm = (): ApprovalCategoryFormData => ({
  name: '',
  internal_code: '',
  description: '',
  active: true
})
</script>

<script setup lang="ts">
interface Props {
  readonly?: boolean
  codeReadonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  codeReadonly: false
})

const formData = defineModel<ApprovalCategoryFormData>({ required: true })
</script>

<template>
  <div class="space-y-6">
    <FormInput
      v-model="formData.name"
      label="Nombre de la categoría"
      placeholder="Ej. Viaje de negocios"
      required
      :readonly="props.readonly"
    />

    <FormInput
      v-model="formData.internal_code"
      label="Código interno"
      placeholder="viaje-negocios"
      required
      :readonly="props.readonly || props.codeReadonly"
      maxlength="64"
    />

    <FormTextArea
      v-model="formData.description"
      label="Descripción"
      placeholder="Texto opcional visible en el equipo"
      :rows="4"
      :readonly="props.readonly"
    />

    <div
      class="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
    >
      <div>
        <p class="text-sm font-medium text-slate-800">
          Activa
        </p>
        <p class="text-xs text-slate-500">
          Si está desactivada, no estará disponible al crear nuevas solicitudes (además del archivado).
        </p>
      </div>
      <label class="relative inline-flex items-center cursor-pointer self-start sm:self-auto">
        <input
          v-model="formData.active"
          type="checkbox"
          class="sr-only peer"
          :disabled="props.readonly"
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
