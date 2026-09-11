<script setup lang="ts">
interface Props {
  /** Texto que se copiará al portapapeles. */
  text: string
  label?: string
  /** Muestra solo el icono, para botones que aparecen al pasar el cursor. */
  iconOnly?: boolean
  size?: 'xs' | 'sm'
}

const props = withDefaults(defineProps<Props>(), {
  label: 'Copiar',
  iconOnly: false,
  size: 'sm'
})

const { copy } = useManualShare()

const copied = ref(false)
let resetTimer: ReturnType<typeof setTimeout> | null = null

async function handleCopy() {
  const ok = await copy(props.text)
  if (!ok) return
  copied.value = true
  if (resetTimer) clearTimeout(resetTimer)
  resetTimer = setTimeout(() => { copied.value = false }, 1800)
}

onUnmounted(() => {
  if (resetTimer) clearTimeout(resetTimer)
})

const sizeClasses = computed(() =>
  props.size === 'xs' ? 'text-[10px] px-1.5 py-1 gap-1' : 'text-xs px-2 py-1.5 gap-1.5'
)
const iconClasses = computed(() => (props.size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'))
</script>

<template>
  <button
    type="button"
    :class="[
      'inline-flex items-center rounded-lg font-semibold transition-colors',
      sizeClasses,
      copied
        ? 'bg-emerald-50 text-emerald-600'
        : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
    ]"
    :title="copied ? 'Copiado' : label"
    :aria-label="label"
    @click.stop="handleCopy"
  >
    <svg v-if="copied" :class="iconClasses" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
    </svg>
    <svg v-else :class="iconClasses" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
    <span v-if="!iconOnly">{{ copied ? 'Copiado' : label }}</span>
  </button>
</template>
