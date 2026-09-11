<script setup lang="ts">
import type { CompanyMember } from '~/composables/useMembership'
import type { InventorySettingsRow } from '~/types/inventory.types'

interface Props {
  companyId: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  /** Los ajustes se guardaron: la página puede recargar sus datos. */
  saved: [settings: InventorySettingsRow]
}>()

const { getSettings, saveSettings, lastError } = useInventory()
const { getCompanyMembers } = useMembership()

const isLoading = ref(true)
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

const members = ref<CompanyMember[]>([])

const form = ref({
  auto_restock_tasks: true,
  restock_responsible_partner_id: '' as string,
  restock_lead_days: 3
})

const memberOptions = computed(() => [
  { value: '', label: 'Propietario del equipo (por defecto)' },
  ...members.value.map(m => ({
    value: m.partner_id,
    label: `${m.partner_name}${m.role === 'owner' ? ' · propietario' : m.role === 'admin' ? ' · administrador' : ''}`
  }))
])

const load = async () => {
  isLoading.value = true
  try {
    const [settings, team] = await Promise.all([
      getSettings(props.companyId),
      getCompanyMembers(props.companyId, 'team')
    ])

    members.value = team.filter(m => m.is_active)

    if (settings) {
      form.value = {
        auto_restock_tasks: settings.auto_restock_tasks ?? true,
        restock_responsible_partner_id: settings.restock_responsible_partner_id ?? '',
        restock_lead_days: settings.restock_lead_days ?? 3
      }
    }
  } finally {
    isLoading.value = false
  }
}

onMounted(load)

const handleSave = async () => {
  errorMessage.value = null

  const leadDays = Number(form.value.restock_lead_days)
  if (!Number.isFinite(leadDays) || leadDays < 0 || leadDays > 90) {
    errorMessage.value = 'Los días para surtir deben estar entre 0 y 90.'
    return
  }

  isSaving.value = true
  try {
    const saved = await saveSettings(props.companyId, {
      auto_restock_tasks: form.value.auto_restock_tasks,
      restock_responsible_partner_id: form.value.restock_responsible_partner_id || null,
      restock_lead_days: leadDays
    })

    if (!saved) {
      errorMessage.value = lastError.value ?? 'No se pudieron guardar los ajustes.'
      return
    }

    emit('saved', saved)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      @click.self="emit('close')"
    >
      <div class="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div class="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <h3 class="text-base font-bold text-slate-800">Ajustes de inventario</h3>
            <p class="text-xs text-slate-500 mt-0.5">
              Cómo se generan las tareas cuando un producto cae bajo su mínimo.
            </p>
          </div>
          <button
            type="button"
            class="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            aria-label="Cerrar"
            @click="emit('close')"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div v-if="isLoading" class="py-16 text-center">
          <div class="w-7 h-7 mx-auto rounded-full border-4 border-slate-200 border-t-indigo-500 animate-spin" />
        </div>

        <div v-else class="p-5 space-y-5 overflow-y-auto">
          <!-- Automatización -->
          <label class="flex items-start gap-3 rounded-xl border border-slate-200 p-3.5 cursor-pointer hover:border-indigo-200 transition-colors">
            <input
              v-model="form.auto_restock_tasks"
              type="checkbox"
              class="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <div class="min-w-0">
              <p class="text-sm font-semibold text-slate-800">Crear tareas automáticamente</p>
              <p class="text-xs text-slate-500 mt-0.5 leading-relaxed">
                En cuanto un producto queda por debajo de su mínimo, se agenda su reabastecimiento.
                La tarea se cierra sola cuando vuelve a tener existencias.
              </p>
            </div>
          </label>

          <!-- Responsable -->
          <div>
            <FormSelect
              v-model="form.restock_responsible_partner_id"
              label="Responsable de surtir"
              :options="memberOptions"
              size="md"
              hint="Las tareas aparecen en la agenda de esta persona."
            />
            <div
              v-if="!members.length"
              class="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5"
            >
              <svg class="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
              <p class="text-xs text-amber-800 leading-relaxed">
                No hay miembros en el equipo. Invita a alguien desde
                <NuxtLink to="/admin/team" class="font-semibold underline">Equipo</NuxtLink>
                para poder asignarle las tareas.
              </p>
            </div>
          </div>

          <!-- Días para surtir -->
          <FormInput
            v-model.number="form.restock_lead_days"
            label="Días para surtir"
            type="number"
            :min="0"
            :max="90"
            size="md"
            hint="Plazo que se pone como fecha límite de la tarea. Usa el tiempo real que tarda tu proveedor."
          />

          <div class="rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-3">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Cómo funciona</p>
            <ul class="space-y-1 text-xs text-slate-600 leading-relaxed">
              <li>· Las tareas viven en el proyecto interno «Reabastecimiento de inventario».</li>
              <li>· Cada producto tiene como máximo una tarea abierta: no se duplican.</li>
              <li>· La prioridad sube sola: urgente si el stock es negativo, alta si está agotado.</li>
              <li>· Un producto sin mínimo definido nunca genera tarea.</li>
            </ul>
          </div>

          <div v-if="errorMessage" class="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5">
            <p class="text-xs text-red-800 leading-relaxed">{{ errorMessage }}</p>
          </div>
        </div>

        <div class="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 flex-shrink-0">
          <button
            type="button"
            class="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            @click="emit('close')"
          >
            Cancelar
          </button>
          <button
            type="button"
            :disabled="isSaving || isLoading"
            class="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25 disabled:opacity-50"
            @click="handleSave"
          >
            {{ isSaving ? 'Guardando…' : 'Guardar ajustes' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
