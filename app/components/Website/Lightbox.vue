<script setup lang="ts">
interface LightboxItem {
  image_url: string
  alt_text: string | null
  caption: string | null
}

interface Props {
  items: LightboxItem[]
  index: number
}

const props = defineProps<Props>()
const emit = defineEmits<{ close: []; navigate: [index: number] }>()

const current = computed(() => props.items[props.index])
const prev = () => emit('navigate', (props.index - 1 + props.items.length) % props.items.length)
const next = () => emit('navigate', (props.index + 1) % props.items.length)

const onKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape') emit('close')
  if (event.key === 'ArrowLeft') prev()
  if (event.key === 'ArrowRight') next()
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" role="dialog" aria-modal="true" @click.self="emit('close')">
      <button type="button" class="absolute top-4 right-4 text-white/80 hover:text-white p-2" aria-label="Cerrar" @click="emit('close')">
        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
      <button v-if="items.length > 1" type="button" class="absolute left-3 sm:left-6 text-white/80 hover:text-white p-2" aria-label="Anterior" @click="prev">
        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
      </button>
      <figure v-if="current" class="max-w-5xl max-h-full flex flex-col items-center">
        <img :src="current.image_url" :alt="current.alt_text || current.caption || ''" class="max-h-[80vh] max-w-full object-contain rounded-lg" />
        <figcaption v-if="current.caption" class="text-white/80 text-sm mt-3 text-center">{{ current.caption }}</figcaption>
        <p v-if="items.length > 1" class="text-white/50 text-xs mt-2">{{ index + 1 }} / {{ items.length }}</p>
      </figure>
      <button v-if="items.length > 1" type="button" class="absolute right-3 sm:right-6 text-white/80 hover:text-white p-2" aria-label="Siguiente" @click="next">
        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
      </button>
    </div>
  </Teleport>
</template>
