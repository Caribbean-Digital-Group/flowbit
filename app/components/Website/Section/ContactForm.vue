<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { WebsiteSection } from '~/utils/website/sections'

interface ContactProps {
  title?: string
  text?: string
  show_contact_info?: boolean
  show_map?: boolean
  subject_options?: string
  success_message?: string
}

const props = defineProps<{ section: WebsiteSection; pageId?: string | null }>()
const p = computed(() => props.section.props as ContactProps)

const websiteStore = useWebsiteStore()
const { site, slug } = storeToRefs(websiteStore)
const { submitContact } = useWebsite()
const route = useRoute()

const subjects = computed(() => (p.value.subject_options ?? '').split('\n').map(s => s.trim()).filter(Boolean))

const form = reactive({ name: '', email: '', phone: '', subject: '', message: '', website: '' })
const isSending = ref(false)
const sent = ref(false)
const errorMessage = ref<string | null>(null)

const mapUrl = computed(() => (p.value.show_map && isAllowedMapEmbed(site.value?.map_embed_url) ? site.value?.map_embed_url ?? null : null))

const ERROR_LABELS: Record<string, string> = {
  invalid_name: 'Escribe tu nombre.',
  invalid_message: 'El mensaje debe tener al menos 5 caracteres.',
  contact_required: 'Indica un correo o un teléfono para poder responderte.',
  invalid_email: 'El correo no parece válido.',
  rate_limited: 'Has enviado varios mensajes seguidos. Intenta de nuevo más tarde.',
  network: 'No pudimos enviar el mensaje. Revisa tu conexión e intenta de nuevo.'
}

const handleSubmit = async () => {
  if (!slug.value) return
  errorMessage.value = null
  isSending.value = true
  try {
    const result = await submitContact(slug.value, {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      subject: form.subject.trim(),
      message: form.message.trim(),
      sourceUrl: route.fullPath,
      visitorId: getWebsiteVisitorId(),
      honeypot: form.website,
      pageId: props.pageId ?? null
    })
    if (result.status === 'ok') {
      sent.value = true
      form.name = ''; form.email = ''; form.phone = ''; form.subject = ''; form.message = ''
    } else {
      errorMessage.value = ERROR_LABELS[result.code ?? ''] ?? 'No pudimos enviar tu mensaje. Intenta de nuevo.'
    }
  } finally {
    isSending.value = false
  }
}
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-left">
    <div :class="['grid gap-10', p.show_contact_info || mapUrl ? 'lg:grid-cols-5' : '']">
      <div :class="p.show_contact_info || mapUrl ? 'lg:col-span-3' : 'max-w-2xl mx-auto w-full'">
        <p v-if="p.title" class="sf-heading text-3xl font-bold">{{ p.title }}</p>
        <p v-if="p.text" class="sf-muted mt-3 leading-relaxed">{{ p.text }}</p>

        <div v-if="sent" class="ws-card p-8 mt-8 text-center">
          <span class="ws-icon-badge mx-auto mb-4">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
          </span>
          <p class="font-semibold text-lg">{{ p.success_message || '¡Gracias! Recibimos tu mensaje.' }}</p>
          <button type="button" class="sf-link text-sm mt-4" @click="sent = false">Enviar otro mensaje</button>
        </div>

        <form v-else class="mt-8 space-y-4" @submit.prevent="handleSubmit">
          <div class="grid sm:grid-cols-2 gap-4">
            <label class="block">
              <span class="text-sm font-medium mb-1.5 block">Nombre *</span>
              <input v-model="form.name" type="text" class="sf-input" required maxlength="160" autocomplete="name" />
            </label>
            <label class="block">
              <span class="text-sm font-medium mb-1.5 block">Correo electrónico</span>
              <input v-model="form.email" type="email" class="sf-input" maxlength="255" autocomplete="email" />
            </label>
            <label class="block">
              <span class="text-sm font-medium mb-1.5 block">Teléfono</span>
              <input v-model="form.phone" type="tel" class="sf-input" maxlength="50" autocomplete="tel" />
            </label>
            <label class="block">
              <span class="text-sm font-medium mb-1.5 block">Asunto</span>
              <select v-if="subjects.length" v-model="form.subject" class="sf-input">
                <option value="">Selecciona…</option>
                <option v-for="s in subjects" :key="s" :value="s">{{ s }}</option>
              </select>
              <input v-else v-model="form.subject" type="text" class="sf-input" maxlength="200" />
            </label>
          </div>
          <label class="block">
            <span class="text-sm font-medium mb-1.5 block">Mensaje *</span>
            <textarea v-model="form.message" class="sf-input" rows="5" required minlength="5" maxlength="5000" />
          </label>
          <!-- Honeypot: campo invisible para bots -->
          <div class="absolute opacity-0 -z-10 h-0 overflow-hidden" aria-hidden="true">
            <label>Sitio web <input v-model="form.website" type="text" tabindex="-1" autocomplete="off" /></label>
          </div>
          <p v-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>
          <button type="submit" class="sf-btn sf-btn--primary" :disabled="isSending">
            {{ isSending ? 'Enviando…' : 'Enviar mensaje' }}
          </button>
        </form>
      </div>

      <aside v-if="p.show_contact_info || mapUrl" class="lg:col-span-2 space-y-6">
        <div v-if="p.show_contact_info && site" class="ws-card p-6">
          <p class="sf-eyebrow mb-3">Contacto</p>
          <ul class="space-y-3 text-sm">
            <li v-if="site.contact_email" class="flex items-start gap-3">
              <svg class="w-4 h-4 mt-0.5 flex-shrink-0" :style="{ color: 'var(--sf-primary-readable)' }" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.9 5.3a2 2 0 002.2 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              <a :href="`mailto:${site.contact_email}`" class="sf-hover-text break-all">{{ site.contact_email }}</a>
            </li>
            <li v-if="site.contact_phone" class="flex items-start gap-3">
              <svg class="w-4 h-4 mt-0.5 flex-shrink-0" :style="{ color: 'var(--sf-primary-readable)' }" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.3a1 1 0 01.9.7l1.5 4.5a1 1 0 01-.5 1.2l-2.3 1.1a11 11 0 005.6 5.6l1.1-2.3a1 1 0 011.2-.5l4.5 1.5a1 1 0 01.7.9V19a2 2 0 01-2 2h-1C9.7 21 3 14.3 3 6V5z" /></svg>
              <a :href="`tel:${site.contact_phone}`" class="sf-hover-text">{{ site.contact_phone }}</a>
            </li>
            <li v-if="site.contact_address" class="flex items-start gap-3">
              <svg class="w-4 h-4 mt-0.5 flex-shrink-0" :style="{ color: 'var(--sf-primary-readable)' }" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.7 16.7L12 22l-5.7-5.3a8 8 0 1111.4 0zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" /></svg>
              <span class="leading-relaxed">{{ site.contact_address }}</span>
            </li>
            <li v-if="site.contact_hours" class="flex items-start gap-3">
              <svg class="w-4 h-4 mt-0.5 flex-shrink-0" :style="{ color: 'var(--sf-primary-readable)' }" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span class="leading-relaxed">{{ site.contact_hours }}</span>
            </li>
          </ul>
        </div>
        <div v-if="mapUrl" class="ws-card overflow-hidden">
          <iframe :src="mapUrl" class="w-full h-64 border-0" title="Mapa" loading="lazy" referrerpolicy="no-referrer-when-downgrade" />
        </div>
      </aside>
    </div>
  </div>
</template>
