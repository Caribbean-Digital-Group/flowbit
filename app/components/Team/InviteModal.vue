<script setup lang="ts">
import type { Database } from '~/types/database.types'

type PartnerCompanyRole = Database['public']['Enums']['partner_company_role']

interface Props {
  modelValue: boolean
  companyId: string | null
  companyName?: string
  canAssignOwner?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  companyName: '',
  canAssignOwner: false
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  invited: [relationshipId: string | null]
}>()

const { inviteByEmail } = useMembership()

const email = ref('')
const role = ref<PartnerCompanyRole>('member')
const isSubmitting = ref(false)
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)

interface RoleOption {
  value: PartnerCompanyRole
  label: string
  description: string
}

const roleOptions = computed<RoleOption[]>(() => {
  const base: RoleOption[] = [
    { value: 'admin', label: 'Administrador', description: 'Puede gestionar miembros, datos y configuración.' },
    { value: 'member', label: 'Miembro', description: 'Acceso estándar al panel.' },
    { value: 'viewer', label: 'Lector', description: 'Solo lectura.' },
    { value: 'guest', label: 'Invitado', description: 'Acceso limitado.' }
  ]
  if (props.canAssignOwner) {
    base.unshift({ value: 'owner', label: 'Owner', description: 'Control total de la empresa.' })
  }
  return base
})

const resetForm = () => {
  email.value = ''
  role.value = 'member'
  errorMessage.value = null
  successMessage.value = null
}

const close = () => {
  if (isSubmitting.value) return
  emit('update:modelValue', false)
  setTimeout(resetForm, 200)
}

watch(() => props.modelValue, (open) => {
  if (open) {
    resetForm()
  }
})

const handleSubmit = async () => {
  errorMessage.value = null
  successMessage.value = null

  if (!props.companyId) {
    errorMessage.value = 'Selecciona una empresa en el panel superior antes de invitar.'
    return
  }

  const trimmed = email.value.trim().toLowerCase()
  if (!trimmed) {
    errorMessage.value = 'Ingresa el correo electrónico del usuario que quieres invitar.'
    return
  }
  const isValid = /.+@.+\..+/.test(trimmed)
  if (!isValid) {
    errorMessage.value = 'El correo electrónico no es válido.'
    return
  }

  isSubmitting.value = true
  try {
    const result = await inviteByEmail(props.companyId, trimmed, role.value)
    if (!result.success) {
      errorMessage.value = result.error ?? 'No se pudo enviar la invitación.'
      return
    }
    successMessage.value = `Invitación enviada a ${trimmed}.`
    emit('invited', result.relationshipId)
    setTimeout(() => {
      emit('update:modelValue', false)
      resetForm()
    }, 1100)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-200"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-150"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      @click.self="close"
    >
      <Transition
        appear
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 scale-95 translate-y-2"
        enter-to-class="opacity-100 scale-100 translate-y-0"
      >
        <div class="w-full max-w-lg rounded-2xl bg-white shadow-2xl shadow-slate-900/20 border border-slate-100 overflow-hidden">
          <!-- Header -->
          <div class="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 to-violet-50/60 flex items-start justify-between gap-4">
            <div class="min-w-0">
              <h3 class="text-lg font-semibold text-slate-900">
                Invitar a un miembro
              </h3>
              <p v-if="companyName" class="mt-1 text-sm text-slate-500 truncate">
                Empresa: <span class="font-medium text-slate-700">{{ companyName }}</span>
              </p>
              <p v-else class="mt-1 text-sm text-slate-500">
                Envía una invitación por correo electrónico para sumar a tu equipo.
              </p>
            </div>
            <button
              type="button"
              class="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-slate-800 transition-colors"
              :disabled="isSubmitting"
              aria-label="Cerrar"
              @click="close"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Body -->
          <form class="px-6 py-6 space-y-5" @submit.prevent="handleSubmit">
            <FormInput
              v-model="email"
              type="email"
              label="Correo electrónico"
              placeholder="persona@empresa.com"
              required
              :disabled="isSubmitting"
              size="md"
            />

            <div>
              <label class="block text-base font-medium text-slate-700 mb-2">
                Rol
                <span class="text-red-500 ml-1">*</span>
              </label>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  v-for="opt in roleOptions"
                  :key="opt.value"
                  type="button"
                  :class="[
                    'text-left px-4 py-3 rounded-xl border transition-all',
                    role === opt.value
                      ? 'border-indigo-500 bg-indigo-50/70 ring-2 ring-indigo-100'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  ]"
                  :disabled="isSubmitting"
                  @click="role = opt.value"
                >
                  <p
                    class="text-sm font-semibold"
                    :class="role === opt.value ? 'text-indigo-700' : 'text-slate-800'"
                  >
                    {{ opt.label }}
                  </p>
                  <p class="mt-0.5 text-xs text-slate-500 leading-snug">
                    {{ opt.description }}
                  </p>
                </button>
              </div>
            </div>

            <div
              v-if="errorMessage"
              class="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {{ errorMessage }}
            </div>

            <div
              v-if="successMessage"
              class="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
            >
              {{ successMessage }}
            </div>

            <p class="text-xs text-slate-500 leading-relaxed">
              Si el correo aún no tiene cuenta en Flowbit, se creará un partner ligado a esa dirección.
              Cuando esa persona se registre con el mismo correo, su acceso quedará vinculado automáticamente.
            </p>

            <!-- Footer actions -->
            <div class="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                class="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-60"
                :disabled="isSubmitting"
                @click="close"
              >
                Cancelar
              </button>
              <button
                type="submit"
                class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 via-violet-600 to-fuchsia-600 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all disabled:opacity-60"
                :disabled="isSubmitting"
              >
                <svg v-if="isSubmitting" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12l-4-4m0 0L8 12m4-4v12m9-7a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {{ isSubmitting ? 'Enviando...' : 'Enviar invitación' }}
              </button>
            </div>
          </form>
        </div>
      </Transition>
    </div>
  </Transition>
</template>
