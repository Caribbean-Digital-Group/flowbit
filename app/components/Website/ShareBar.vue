<script setup lang="ts">
interface Props {
  title: string
  path: string
}

const props = defineProps<Props>()
const config = useRuntimeConfig()
const websiteStore = useWebsiteStore()

const absoluteUrl = computed(() => {
  if (typeof window !== 'undefined') return `${window.location.origin}${props.path}`
  return `${String(config.public.siteUrl).replace(/\/$/, '')}${props.path}`
})

const encoded = computed(() => ({ url: encodeURIComponent(absoluteUrl.value), title: encodeURIComponent(props.title) }))

const links = computed(() => [
  { id: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${encoded.value.title}%20${encoded.value.url}`, icon: 'M8 10h.01M12 10h.01M16 10h.01M21 12a8 8 0 01-11.6 7.1L4 20l1-4.2A8 8 0 1121 12z' },
  { id: 'x', label: 'X', href: `https://twitter.com/intent/tweet?text=${encoded.value.title}&url=${encoded.value.url}`, icon: 'M4 4l16 16M20 4L4 20' },
  { id: 'facebook', label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encoded.value.url}`, icon: 'M14 8h3V4h-3c-2.8 0-4 1.7-4 4v2H7v4h3v6h4v-6h3l1-4h-4V8.5c0-.3.2-.5.5-.5z' },
  { id: 'linkedin', label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${encoded.value.url}`, icon: 'M6 9v10M6 5v.01M11 19v-6a3 3 0 016 0v6M11 9v10' }
])

const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(absoluteUrl.value)
    websiteStore.notify('Enlace copiado')
  } catch {
    websiteStore.notify('No se pudo copiar el enlace')
  }
}
</script>

<template>
  <div class="flex items-center gap-1.5">
    <span class="sf-subtle text-xs font-semibold uppercase tracking-wider mr-1">Compartir</span>
    <a v-for="link in links" :key="link.id" :href="link.href" target="_blank" rel="noopener" class="sf-icon-btn" :aria-label="`Compartir en ${link.label}`">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" :d="link.icon" /></svg>
    </a>
    <button type="button" class="sf-icon-btn" aria-label="Copiar enlace" @click="copyLink">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M13.8 10.2a4 4 0 010 5.6l-2.8 2.8a4 4 0 01-5.6-5.6l1.4-1.4m3.4-1.4a4 4 0 010-5.6l2.8-2.8a4 4 0 015.6 5.6l-1.4 1.4" /></svg>
    </button>
  </div>
</template>
