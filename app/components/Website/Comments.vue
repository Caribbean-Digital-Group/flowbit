<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { WebsiteCommentInfo } from '~/composables/useWebsite'

interface Props {
  postSlug: string
  comments: WebsiteCommentInfo[]
  enabled: boolean
}

const props = defineProps<Props>()
const websiteStore = useWebsiteStore()
const { slug } = storeToRefs(websiteStore)
const { submitComment } = useWebsite()

const form = reactive({ name: '', email: '', body: '', website: '' })
const replyTo = ref<WebsiteCommentInfo | null>(null)
const isSending = ref(false)
const notice = ref<string | null>(null)
const errorMessage = ref<string | null>(null)

const roots = computed(() => props.comments.filter(c => !c.parent_id))
const repliesOf = (id: string) => props.comments.filter(c => c.parent_id === id)

const ERROR_LABELS: Record<string, string> = {
  invalid_name: 'Escribe tu nombre.',
  invalid_body: 'El comentario debe tener al menos 2 caracteres.',
  invalid_email: 'El correo no parece válido.',
  rate_limited: 'Has comentado varias veces seguidas. Espera unos minutos.',
  invalid_parent: 'El comentario al que respondes ya no está disponible.',
  network: 'No pudimos enviar el comentario. Intenta de nuevo.'
}

const handleSubmit = async () => {
  if (!slug.value) return
  errorMessage.value = null
  notice.value = null
  isSending.value = true
  try {
    const result = await submitComment(slug.value, props.postSlug, {
      name: form.name.trim(),
      email: form.email.trim(),
      body: form.body.trim(),
      parentId: replyTo.value?.id ?? null,
      visitorId: getWebsiteVisitorId(),
      honeypot: form.website
    })
    if (result.status === 'ok') {
      notice.value = result.comment_status === 'approved'
        ? 'Tu comentario se publicó. Recarga la página para verlo.'
        : 'Gracias. Tu comentario se publicará cuando sea aprobado.'
      form.body = ''
      replyTo.value = null
    } else if (result.status === 'disabled') {
      errorMessage.value = 'Los comentarios están desactivados en esta publicación.'
    } else {
      errorMessage.value = ERROR_LABELS[result.code ?? ''] ?? 'No pudimos enviar el comentario.'
    }
  } finally {
    isSending.value = false
  }
}
</script>

<template>
  <section class="mt-14" aria-labelledby="comentarios">
    <h2 id="comentarios" class="sf-heading text-2xl font-bold mb-6">
      Comentarios <span class="sf-muted text-base font-normal">({{ comments.length }})</span>
    </h2>

    <div v-if="roots.length" class="space-y-6">
      <article v-for="comment in roots" :key="comment.id" class="ws-card p-5">
        <header class="flex items-center gap-2 text-sm">
          <span class="font-semibold">{{ comment.author_name }}</span>
          <span v-if="comment.is_staff" class="ws-chip text-[10px]">Equipo</span>
          <time class="sf-subtle text-xs" :datetime="comment.created_at">{{ formatWebsiteDate(comment.created_at, { day: 'numeric', month: 'short', year: 'numeric' }) }}</time>
        </header>
        <p class="mt-2 text-sm leading-relaxed whitespace-pre-line">{{ comment.body }}</p>
        <button v-if="enabled" type="button" class="sf-link text-xs mt-3" @click="replyTo = comment">Responder</button>
        <div v-if="repliesOf(comment.id).length" class="mt-4 pl-4 space-y-4" :style="{ borderLeft: '2px solid var(--sf-border)' }">
          <article v-for="reply in repliesOf(comment.id)" :key="reply.id">
            <header class="flex items-center gap-2 text-sm">
              <span class="font-semibold">{{ reply.author_name }}</span>
              <span v-if="reply.is_staff" class="ws-chip text-[10px]">Equipo</span>
              <time class="sf-subtle text-xs" :datetime="reply.created_at">{{ formatWebsiteDate(reply.created_at, { day: 'numeric', month: 'short', year: 'numeric' }) }}</time>
            </header>
            <p class="mt-1.5 text-sm leading-relaxed whitespace-pre-line">{{ reply.body }}</p>
          </article>
        </div>
      </article>
    </div>
    <p v-else class="sf-muted text-sm">Sé el primero en comentar.</p>

    <form v-if="enabled" class="ws-card p-6 mt-8 space-y-4" @submit.prevent="handleSubmit">
      <div class="flex items-center justify-between gap-3">
        <p class="font-semibold">{{ replyTo ? `Responder a ${replyTo.author_name}` : 'Deja un comentario' }}</p>
        <button v-if="replyTo" type="button" class="sf-link text-xs" @click="replyTo = null">Cancelar respuesta</button>
      </div>
      <div class="grid sm:grid-cols-2 gap-4">
        <input v-model="form.name" type="text" class="sf-input" placeholder="Tu nombre *" required maxlength="120" />
        <input v-model="form.email" type="email" class="sf-input" placeholder="Correo (no se publica)" maxlength="255" />
      </div>
      <textarea v-model="form.body" class="sf-input" rows="4" placeholder="Escribe tu comentario…" required minlength="2" maxlength="4000" />
      <div class="absolute opacity-0 -z-10 h-0 overflow-hidden" aria-hidden="true">
        <label>Sitio web <input v-model="form.website" type="text" tabindex="-1" autocomplete="off" /></label>
      </div>
      <p v-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>
      <p v-if="notice" class="text-sm font-medium" :style="{ color: 'var(--sf-primary-readable)' }">{{ notice }}</p>
      <button type="submit" class="sf-btn sf-btn--primary sf-btn--sm" :disabled="isSending">{{ isSending ? 'Enviando…' : 'Publicar comentario' }}</button>
    </form>
    <p v-else class="sf-subtle text-xs mt-6">Los comentarios están cerrados en esta publicación.</p>
  </section>
</template>
