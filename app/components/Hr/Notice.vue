<script setup lang="ts">
/**
 * Aviso de estado para las vistas de RR. HH. y Nómina: sin empresa,
 * acceso restringido, cargando o error.
 */
interface Props {
  kind: 'no-company' | 'admin-only' | 'loading' | 'error' | 'success' | 'info'
  message?: string
}

const props = withDefaults(defineProps<Props>(), {
  message: ''
})

const styles: Record<Props['kind'], string> = {
  'no-company': 'border-amber-100 bg-amber-50 text-amber-900',
  'admin-only': 'border-slate-200 bg-slate-50 text-slate-700',
  loading: 'border-slate-100 bg-white text-slate-500 shadow-lg shadow-slate-200/50 justify-center py-16',
  error: 'border-red-100 bg-red-50 text-red-700',
  success: 'border-emerald-100 bg-emerald-50 text-emerald-800',
  info: 'border-indigo-100 bg-indigo-50 text-indigo-800'
}

const defaults: Record<Props['kind'], string> = {
  'no-company': 'Elige una empresa en el selector del panel superior.',
  'admin-only': 'Solo los propietarios y administradores de la empresa pueden ver esta sección.',
  loading: 'Cargando…',
  error: 'Ocurrió un error.',
  success: '',
  info: ''
}

const text = computed(() => props.message || defaults[props.kind])
</script>

<template>
  <div :class="['flex rounded-2xl border px-6 py-4', styles[kind]]">
    <div>
      <p v-if="kind === 'no-company'" class="font-semibold">
        Sin empresa seleccionada
      </p>
      <p v-else-if="kind === 'admin-only'" class="font-semibold">
        Acceso restringido
      </p>
      <p :class="kind === 'no-company' || kind === 'admin-only' ? 'mt-1 text-sm' : 'text-sm'">
        {{ text }}
      </p>
      <slot />
    </div>
  </div>
</template>
