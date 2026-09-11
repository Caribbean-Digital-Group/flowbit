<script setup lang="ts">
import type { DocArticle, DocFaq, DocField, DocShortcut } from '~/composables/useManual'

/**
 * Bit — asistente contextual del panel.
 * Conversa a partir de la documentación incluida en la plataforma: reconoce la
 * vista actual, responde con la sección que corresponde y abre las guías paso a paso.
 */

type BitBlock =
  | { type: 'text'; text: string }
  | { type: 'note'; label: string; text: string; tone: 'indigo' | 'violet' | 'amber' }
  | { type: 'list'; label: string; items: string[] }
  | { type: 'fields'; fields: DocField[] }
  | { type: 'faq'; faqs: DocFaq[] }
  | { type: 'shortcuts'; shortcuts: DocShortcut[] }
  | { type: 'wizard'; articleId: string }
  | { type: 'results'; articles: DocArticle[] }
  | { type: 'links'; links: { label: string; route: string }[] }
  | { type: 'share'; articleId: string }

interface BitMessage {
  id: number
  role: 'bit' | 'user'
  text?: string
  blocks?: BitBlock[]
}

interface Suggestion {
  label: string
  intent: string
}

const route = useRoute()
const authStore = useAuthStore()
const { getContextForRoute, searchArticles, getArticleById, getRelatedArticles, wizardArticles } = useManual()
const { hydrate, markAssistantSeen, assistantSeen, wizardProgress } = useManualProgress()
const { copyLink, feedback } = useManualShare()

const isOpen = ref(false)
const isTyping = ref(false)
const inputText = ref('')
const messages = ref<BitMessage[]>([])
const suggestions = ref<Suggestion[]>([])
const showTeaser = ref(false)
const teaserText = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const scrollArea = ref<HTMLElement | null>(null)

let messageSeq = 0
let teaserTimer: ReturnType<typeof setTimeout> | null = null
/** Rutas en las que ya se ofreció ayuda proactiva durante esta sesión. */
const teasedRoutes = new Set<string>()

const currentArticle = computed<DocArticle | undefined>(() => {
  // Dentro del manual, el contexto es la guía que se está leyendo.
  const manualMatch = route.path.match(/^\/manual\/([^/]+)$/)
  if (manualMatch?.[1]) return getArticleById(manualMatch[1])
  return getContextForRoute(route.path)
})

/** El asistente también acompaña dentro de la sección pública del manual. */
const isInsideManual = computed(() => route.path.startsWith('/manual'))

const firstName = computed(() => {
  const name = authStore.partnerDisplayName
  if (!name) return ''
  return name.split(' ')[0] ?? ''
})

// ── Construcción de respuestas ───────────────────────────────────────────────

function pushBit(text: string | undefined, blocks?: BitBlock[]) {
  messages.value.push({ id: ++messageSeq, role: 'bit', text, blocks })
  scrollToBottom()
}

function pushUser(text: string) {
  messages.value.push({ id: ++messageSeq, role: 'user', text })
  scrollToBottom()
}

function scrollToBottom() {
  nextTick(() => {
    if (scrollArea.value) scrollArea.value.scrollTop = scrollArea.value.scrollHeight
  })
}

/** Pequeña pausa antes de responder: hace la conversación más legible. */
async function withTyping(action: () => void) {
  isTyping.value = true
  scrollToBottom()
  await new Promise(resolve => setTimeout(resolve, 320))
  isTyping.value = false
  action()
}

/** Sugerencias disponibles según lo que documenta la vista actual. */
function contextSuggestions(): Suggestion[] {
  const article = currentArticle.value
  const list: Suggestion[] = []

  if (article) {
    list.push({ label: '¿Qué hago aquí?', intent: 'que-hago' })
    if (article.wizard) list.push({ label: 'Guíame paso a paso', intent: 'guiame' })
    if (article.fields?.length) list.push({ label: 'Explicar campos', intent: 'campos' })
    if (article.shortcuts?.length) list.push({ label: 'Ver atajos', intent: 'atajos' })
    list.push({ label: 'Dame consejos', intent: 'consejos' })
    if (article.faqs?.length) list.push({ label: 'Preguntas frecuentes', intent: 'faq' })
    list.push({ label: 'Compartir esta guía', intent: 'compartir' })
  } else {
    list.push({ label: '¿Por dónde empiezo?', intent: 'inicio' })
    list.push({ label: 'Ver guías disponibles', intent: 'guias' })
  }

  return list
}

function greet() {
  const article = currentArticle.value
  const hello = firstName.value ? `¡Hola, ${firstName.value}!` : '¡Hola!'

  if (article) {
    const wizardHint = article.wizard
      ? ' Tengo una guía paso a paso para esta vista si quieres que te acompañe.'
      : ''
    pushBit(`${hello} Soy Bit. Estás en **${article.title}**.${wizardHint} ¿Qué necesitas?`)
  } else {
    pushBit(`${hello} Soy Bit, tu asistente. Esta vista aún no tiene guía propia, pero puedo buscar en toda la documentación. Escribe lo que necesites.`)
  }
  suggestions.value = contextSuggestions()
}

// ── Intenciones ──────────────────────────────────────────────────────────────

function answerWhatIsThis(article: DocArticle) {
  pushBit(undefined, [
    { type: 'text', text: article.description },
    { type: 'note', label: '¿Por qué importa?', text: article.importance, tone: 'violet' },
    ...(article.relatedModules?.length
      ? [{ type: 'links', links: article.relatedModules } as BitBlock]
      : [])
  ])
}

function answerWizard(article: DocArticle) {
  if (!article.wizard) {
    pushBit('Esta vista no tiene guía paso a paso todavía. Te dejo los consejos clave.')
    answerTips(article)
    return
  }
  const progress = wizardProgress(article.wizard.id, article.wizard.steps.length)
  pushBit(
    progress > 0 && progress < 100
      ? `Retomamos donde te quedaste: llevas ${progress}% de la guía.`
      : 'Vamos paso a paso. Marca cada paso conforme lo completes; guardo tu avance.',
    [{ type: 'wizard', articleId: article.id }]
  )
}

function answerFields(article: DocArticle) {
  if (!article.fields?.length) {
    pushBit('Esta vista no tiene formulario documentado.')
    return
  }
  const required = article.fields.filter(f => f.required).length
  pushBit(
    `Son ${article.fields.length} campos, ${required} obligatorio${required === 1 ? '' : 's'}:`,
    [{ type: 'fields', fields: article.fields }]
  )
}

function answerTips(article: DocArticle) {
  pushBit('Estos son los consejos que más ayudan aquí:', [
    { type: 'list', label: 'Consejos', items: article.tips.slice(0, 5) }
  ])
}

function answerFaq(article: DocArticle) {
  if (!article.faqs?.length) {
    pushBit('No tengo preguntas frecuentes para esta vista. Pregúntame directamente y busco en el manual.')
    return
  }
  pushBit('Lo que más se pregunta sobre esta vista:', [{ type: 'faq', faqs: article.faqs }])
}

function answerShortcuts(article: DocArticle) {
  if (!article.shortcuts?.length) {
    pushBit('Esta vista no tiene atajos de teclado propios.')
    return
  }
  pushBit('Con estas teclas trabajas mucho más rápido:', [
    { type: 'shortcuts', shortcuts: article.shortcuts }
  ])
}

function answerShare(article: DocArticle) {
  pushBit('Puedes copiar el enlace público de esta guía o publicarla directo en tus redes:', [
    { type: 'share', articleId: article.id }
  ])
}

function answerStart() {
  const starter = getArticleById('getting-started')
  pushBit('Te recomiendo empezar por aquí:', [
    { type: 'results', articles: [starter, getArticleById('storefront-settings'), getArticleById('pos-terminal')].filter((a): a is DocArticle => Boolean(a)) }
  ])
}

function answerGuides() {
  pushBit('Estas son las guías paso a paso disponibles:', [
    { type: 'results', articles: wizardArticles.value.slice(0, 6) }
  ])
}

function answerSearch(query: string) {
  const results = searchArticles(query).slice(0, 5)
  if (!results.length) {
    pushBit(`No encontré nada sobre «${query}». Prueba con otra palabra, por ejemplo: cupón, corte de caja, picking o aprobación.`)
    return
  }
  pushBit(`Encontré ${results.length} guía${results.length === 1 ? '' : 's'} sobre «${query}»:`, [
    { type: 'results', articles: results }
  ])
}

function answerNoContext(query: string) {
  const related = currentArticle.value ? getRelatedArticles(currentArticle.value, 3) : []
  if (related.length) {
    pushBit(`No tengo una respuesta directa para «${query}», pero esto puede servirte:`, [
      { type: 'results', articles: related }
    ])
    return
  }
  answerSearch(query)
}

/** Reconoce la intención por palabras clave; si no hay coincidencia, busca. */
function resolveIntent(rawIntent: string, article?: DocArticle) {
  const intent = rawIntent.toLowerCase().trim()

  if (!article) {
    if (['inicio', 'empiezo', 'empezar'].some(k => intent.includes(k))) return answerStart()
    if (intent.includes('guia') || intent.includes('guía')) return answerGuides()
    return answerSearch(rawIntent)
  }

  if (intent === 'que-hago' || intent.includes('qué hago') || intent.includes('que es') || intent.includes('qué es') || intent.includes('para que'))
    return answerWhatIsThis(article)
  if (intent === 'guiame' || intent.includes('guía') || intent.includes('guiame') || intent.includes('paso a paso') || intent.includes('tutorial'))
    return answerWizard(article)
  if (intent === 'campos' || intent.includes('campo') || intent.includes('formulario') || intent.includes('llenar'))
    return answerFields(article)
  if (intent === 'consejos' || intent.includes('consejo') || intent.includes('tip') || intent.includes('recomend'))
    return answerTips(article)
  if (intent === 'faq' || intent.includes('pregunta') || intent.includes('duda'))
    return answerFaq(article)
  if (intent === 'atajos' || intent.includes('atajo') || intent.includes('teclado') || intent.includes('tecla'))
    return answerShortcuts(article)
  if (intent === 'compartir' || intent.includes('compartir') || intent.includes('enlace') || intent.includes('publicar'))
    return answerShare(article)
  if (intent === 'inicio' || intent.includes('empiezo'))
    return answerStart()

  // Sin intención reconocida: se trata como búsqueda libre.
  const results = searchArticles(rawIntent)
  if (results.length) return answerSearch(rawIntent)
  return answerNoContext(rawIntent)
}

async function runIntent(intent: string, label?: string) {
  pushUser(label ?? intent)
  await withTyping(() => {
    resolveIntent(intent, currentArticle.value)
    suggestions.value = contextSuggestions()
  })
}

async function handleSubmit() {
  const text = inputText.value.trim()
  if (!text) return
  inputText.value = ''
  pushUser(text)
  await withTyping(() => {
    resolveIntent(text, currentArticle.value)
    suggestions.value = contextSuggestions()
  })
}

// ── Apertura, cierre y aviso proactivo ───────────────────────────────────────

function open() {
  isOpen.value = true
  showTeaser.value = false
  markAssistantSeen()
  if (messages.value.length === 0) greet()
  nextTick(() => inputRef.value?.focus())
}

function close() {
  isOpen.value = false
}

function toggle() {
  if (isOpen.value) close()
  else open()
}

/** Reinicia la conversación al contexto de la vista actual. */
function restart() {
  messages.value = []
  greet()
}

function triggerTeaser(text: string) {
  if (isOpen.value) return
  teaserText.value = text
  showTeaser.value = true
  if (teaserTimer) clearTimeout(teaserTimer)
  teaserTimer = setTimeout(() => { showTeaser.value = false }, 8000)
}

function dismissTeaser() {
  showTeaser.value = false
  if (teaserTimer) clearTimeout(teaserTimer)
}

async function openWithIntent(intent: string, label: string) {
  dismissTeaser()
  open()
  await runIntent(intent, label)
}

function goToManual(articleId?: string, section?: string) {
  close()
  if (!articleId) return navigateTo('/manual')
  navigateTo(section ? `/manual/${articleId}#${section}` : `/manual/${articleId}`)
}

function openArticle(article: DocArticle) {
  goToManual(article.id)
}

function navigateAndClose(routePath: string) {
  close()
  navigateTo(routePath)
}

async function shareLink(articleId: string) {
  await copyLink(articleId)
}

/** La tecla «?» abre a Bit cuando no se está escribiendo en un campo. */
function handleKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

  if (event.key === '?' && !typing && !isOpen.value) {
    event.preventDefault()
    open()
  }
  if (event.key === 'Escape' && isOpen.value) {
    close()
  }
}

watch(() => route.path, path => {
  // Cada vista abre un contexto nuevo: se reinicia la conversación.
  messages.value = []
  suggestions.value = contextSuggestions()
  if (isOpen.value) {
    greet()
    return
  }

  const article = currentArticle.value
  if (!article || teasedRoutes.has(path)) return
  teasedRoutes.add(path)

  // Solo se ofrece ayuda proactiva donde hay algo concreto que aportar.
  if (article.wizard) {
    triggerTeaser(`¿Te guío paso a paso con «${article.wizard.title}»?`)
  } else if (article.isNew) {
    triggerTeaser(`«${article.title}» es nuevo. ¿Te cuento cómo funciona?`)
  }
})

onMounted(() => {
  hydrate()
  suggestions.value = contextSuggestions()
  window.addEventListener('keydown', handleKeydown)

  // Primera visita: se presenta una sola vez.
  setTimeout(() => {
    if (!assistantSeen.value && !isOpen.value) {
      triggerTeaser('¡Hola! Soy Bit. Pregúntame lo que sea sobre esta pantalla.')
    }
  }, 4000)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (teaserTimer) clearTimeout(teaserTimer)
})

/** Convierte los **destacados** del texto de Bit en fragmentos renderizables. */
function messageParts(text: string): { text: string; strong: boolean }[] {
  return text.split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map(part =>
      part.startsWith('**') && part.endsWith('**')
        ? { text: part.slice(2, -2), strong: true }
        : { text: part, strong: false }
    )
}

const noteToneClasses: Record<string, string> = {
  indigo: 'bg-indigo-50/70 border-indigo-100 text-indigo-700',
  violet: 'bg-violet-50/70 border-violet-100 text-violet-700',
  amber: 'bg-amber-50/70 border-amber-200 text-amber-800'
}
</script>

<template>
  <div class="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 print:hidden">
    <!-- Aviso de copiado -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="feedback && isOpen"
        class="rounded-xl bg-slate-900 text-white text-[11px] font-semibold px-3 py-2 shadow-lg"
      >
        {{ feedback }}
      </div>
    </Transition>

    <!-- Burbuja proactiva -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 translate-y-2 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="showTeaser && !isOpen"
        class="relative max-w-[17rem] rounded-2xl rounded-br-md bg-white border border-indigo-100 shadow-xl shadow-indigo-200/40 p-3.5"
      >
        <button
          type="button"
          class="absolute top-1.5 right-1.5 p-1 rounded-lg text-slate-300 hover:text-slate-500 transition-colors"
          aria-label="Cerrar aviso"
          @click="dismissTeaser"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <p class="text-xs text-slate-700 leading-relaxed pr-4">{{ teaserText }}</p>
        <div class="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            class="px-2.5 py-1 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-[11px] font-semibold hover:shadow-md hover:shadow-indigo-200 transition-shadow"
            @click="openWithIntent(currentArticle?.wizard ? 'guiame' : 'que-hago', currentArticle?.wizard ? 'Guíame paso a paso' : '¿Qué hago aquí?')"
          >
            Sí, ayúdame
          </button>
          <button
            type="button"
            class="text-[11px] font-medium text-slate-400 hover:text-slate-600 transition-colors"
            @click="dismissTeaser"
          >
            Ahora no
          </button>
        </div>
      </div>
    </Transition>

    <!-- Panel de conversación -->
    <Transition
      enter-active-class="transition duration-250 ease-out"
      enter-from-class="opacity-0 scale-95 translate-y-2"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95 translate-y-2"
    >
      <div
        v-if="isOpen"
        class="w-[21rem] sm:w-96 max-h-[calc(100vh-9rem)] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-indigo-200/40 overflow-hidden"
      >
        <!-- Cabecera -->
        <div class="flex-shrink-0 bg-gradient-to-r from-indigo-500 via-violet-600 to-fuchsia-600 px-4 py-3">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-9 h-9 flex-shrink-0">
                <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full h-full">
                  <circle cx="20" cy="20" r="20" fill="rgba(255,255,255,0.15)" />
                  <line x1="20" y1="4" x2="20" y2="9" stroke="white" stroke-width="1.5" stroke-linecap="round" />
                  <circle cx="20" cy="3.5" r="1.5" fill="white" />
                  <rect x="8" y="9" width="24" height="17" rx="5" fill="rgba(255,255,255,0.25)" stroke="white" stroke-width="1" />
                  <circle cx="15" cy="17" r="3.5" fill="white" />
                  <circle cx="25" cy="17" r="3.5" fill="white" />
                  <circle cx="15.5" cy="17" r="2" fill="#6366f1" />
                  <circle cx="25.5" cy="17" r="2" fill="#6366f1" />
                  <path d="M15 23.5 Q20 26.5 25 23.5" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round" />
                </svg>
              </div>
              <div class="min-w-0">
                <p class="text-sm font-bold text-white leading-tight flex items-center gap-1.5">
                  Bit
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                </p>
                <p class="text-[11px] text-white/75 truncate leading-tight">
                  {{ currentArticle?.title ?? 'Asistente de Flowbit' }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-0.5 flex-shrink-0">
              <button
                type="button"
                class="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-colors"
                title="Reiniciar conversación"
                @click="restart"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                type="button"
                class="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-colors"
                title="Cerrar (Esc)"
                @click="close"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Conversación -->
        <div ref="scrollArea" class="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-slate-50/50">
          <div
            v-for="message in messages"
            :key="message.id"
            :class="['flex', message.role === 'user' ? 'justify-end' : 'justify-start']"
          >
            <!-- Mensaje del usuario -->
            <div
              v-if="message.role === 'user'"
              class="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-xs font-medium px-3 py-2 shadow-sm"
            >
              {{ message.text }}
            </div>

            <!-- Mensaje de Bit -->
            <div v-else class="max-w-[92%] space-y-2">
              <div
                v-if="message.text"
                class="rounded-2xl rounded-bl-md bg-white border border-slate-200 px-3 py-2 shadow-sm"
              >
                <p class="text-xs text-slate-700 leading-relaxed">
                  <template v-for="(part, i) in messageParts(message.text)" :key="i">
                    <strong v-if="part.strong" class="font-bold text-slate-900">{{ part.text }}</strong>
                    <span v-else>{{ part.text }}</span>
                  </template>
                </p>
              </div>

              <!-- Bloques de contenido -->
              <template v-for="(block, bi) in message.blocks ?? []" :key="bi">
                <!-- Texto -->
                <div v-if="block.type === 'text'" class="rounded-2xl rounded-bl-md bg-white border border-slate-200 px-3 py-2 shadow-sm">
                  <p class="text-xs text-slate-700 leading-relaxed">{{ block.text }}</p>
                </div>

                <!-- Nota destacada -->
                <div
                  v-else-if="block.type === 'note'"
                  :class="['rounded-xl border px-3 py-2', noteToneClasses[block.tone]]"
                >
                  <p class="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-80">{{ block.label }}</p>
                  <p class="text-[11px] leading-relaxed text-slate-700">{{ block.text }}</p>
                </div>

                <!-- Lista de consejos -->
                <div v-else-if="block.type === 'list'" class="rounded-xl bg-white border border-slate-200 px-3 py-2.5 shadow-sm">
                  <ul class="space-y-2">
                    <li v-for="(item, i) in block.items" :key="i" class="flex items-start gap-2">
                      <span class="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-amber-100 text-amber-700 text-[9px] font-bold flex items-center justify-center">
                        {{ i + 1 }}
                      </span>
                      <span class="flex-1 text-[11px] text-slate-700 leading-relaxed">{{ item }}</span>
                      <ManualCopyButton :text="item" icon-only size="xs" label="Copiar consejo" />
                    </li>
                  </ul>
                </div>

                <!-- Campos del formulario -->
                <div v-else-if="block.type === 'fields'" class="space-y-1.5">
                  <div
                    v-for="field in block.fields"
                    :key="field.label"
                    class="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm"
                  >
                    <div class="flex items-start justify-between gap-2 mb-1">
                      <p class="text-[11px] font-bold text-slate-800 leading-snug">{{ field.label }}</p>
                      <span
                        v-if="field.required"
                        class="flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded-md bg-red-100 text-red-600 font-bold"
                      >
                        Requerido
                      </span>
                    </div>
                    <p class="text-[11px] text-slate-600 leading-relaxed">{{ field.description }}</p>
                    <p v-if="field.tip" class="mt-1 text-[11px] text-indigo-600 leading-relaxed">💡 {{ field.tip }}</p>
                  </div>
                </div>

                <!-- Preguntas frecuentes -->
                <div v-else-if="block.type === 'faq'" class="space-y-1.5">
                  <details
                    v-for="faq in block.faqs"
                    :key="faq.question"
                    class="group rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm"
                  >
                    <summary class="text-[11px] font-semibold text-slate-800 cursor-pointer list-none flex items-start gap-1.5">
                      <svg class="w-3 h-3 mt-0.5 flex-shrink-0 text-slate-400 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
                      </svg>
                      {{ faq.question }}
                    </summary>
                    <p class="mt-1.5 pl-4.5 text-[11px] text-slate-600 leading-relaxed">{{ faq.answer }}</p>
                  </details>
                </div>

                <!-- Atajos -->
                <div v-else-if="block.type === 'shortcuts'" class="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm space-y-1.5 max-h-56 overflow-y-auto">
                  <div v-for="shortcut in block.shortcuts" :key="shortcut.keys" class="flex items-center gap-2">
                    <kbd class="flex-shrink-0 min-w-[3rem] text-center px-1.5 py-0.5 rounded-md bg-slate-800 text-white text-[10px] font-bold font-mono">
                      {{ shortcut.keys }}
                    </kbd>
                    <span class="text-[11px] text-slate-600 leading-snug">{{ shortcut.action }}</span>
                  </div>
                </div>

                <!-- Guía paso a paso -->
                <div v-else-if="block.type === 'wizard'">
                  <ManualWizard
                    v-if="getArticleById(block.articleId)?.wizard"
                    :wizard="getArticleById(block.articleId)!.wizard!"
                    compact
                    @navigate="close"
                  />
                </div>

                <!-- Resultados de búsqueda -->
                <div v-else-if="block.type === 'results'" class="space-y-1.5">
                  <button
                    v-for="item in block.articles"
                    :key="item.id"
                    type="button"
                    class="w-full flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-2.5 text-left shadow-sm hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors group"
                    @click="openArticle(item)"
                  >
                    <span class="text-base flex-shrink-0">{{ item.moduleEmoji }}</span>
                    <div class="min-w-0 flex-1">
                      <p class="text-[11px] font-bold text-slate-800 group-hover:text-indigo-700 leading-snug">{{ item.title }}</p>
                      <p class="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">{{ item.summary ?? item.description }}</p>
                    </div>
                    <svg class="w-3 h-3 text-slate-300 group-hover:text-indigo-500 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                <!-- Accesos a otras vistas -->
                <div v-else-if="block.type === 'links'" class="flex flex-wrap gap-1.5">
                  <button
                    v-for="link in block.links"
                    :key="link.route"
                    type="button"
                    class="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-colors"
                    @click="navigateAndClose(link.route)"
                  >
                    {{ link.label }} →
                  </button>
                </div>

                <!-- Compartir -->
                <div v-else-if="block.type === 'share'" class="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-600 hover:border-indigo-200 hover:text-indigo-700 transition-colors"
                    @click="shareLink(block.articleId)"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    Copiar enlace
                  </button>
                  <ManualShareMenu
                    v-if="getArticleById(block.articleId)"
                    :article="getArticleById(block.articleId)!"
                    align="left"
                  />
                </div>
              </template>
            </div>
          </div>

          <!-- Indicador de escritura -->
          <div v-if="isTyping" class="flex justify-start">
            <div class="rounded-2xl rounded-bl-md bg-white border border-slate-200 px-3 py-2.5 shadow-sm flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style="animation-delay: 0ms" />
              <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style="animation-delay: 120ms" />
              <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style="animation-delay: 240ms" />
            </div>
          </div>
        </div>

        <!-- Sugerencias rápidas -->
        <div v-if="suggestions.length" class="flex-shrink-0 flex gap-1.5 px-3 py-2 border-t border-slate-100 bg-white overflow-x-auto">
          <button
            v-for="suggestion in suggestions"
            :key="suggestion.intent"
            type="button"
            class="flex-shrink-0 px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-[11px] font-semibold hover:bg-indigo-100 transition-colors whitespace-nowrap"
            @click="runIntent(suggestion.intent, suggestion.label)"
          >
            {{ suggestion.label }}
          </button>
        </div>

        <!-- Entrada de texto -->
        <form class="flex-shrink-0 flex items-center gap-2 px-3 py-2.5 border-t border-slate-100 bg-white" @submit.prevent="handleSubmit">
          <input
            ref="inputRef"
            v-model="inputText"
            type="text"
            placeholder="Pregúntale a Bit…"
            class="flex-1 min-w-0 px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
          />
          <button
            type="submit"
            :disabled="!inputText.trim()"
            class="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center shadow-sm hover:shadow-md hover:shadow-indigo-200 transition-all disabled:opacity-40 disabled:shadow-none"
            aria-label="Enviar"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>

        <!-- Pie -->
        <div class="flex-shrink-0 border-t border-slate-100 bg-slate-50/80 px-4 py-2">
          <button
            type="button"
            class="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 py-1 rounded-lg hover:bg-white transition-colors"
            @click="goToManual(isInsideManual ? undefined : currentArticle?.id)"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            {{ isInsideManual ? 'Ver todas las guías' : 'Abrir el manual completo' }}
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </Transition>

    <!-- Botón flotante -->
    <button
      type="button"
      :class="[
        'group relative flex items-center justify-center w-14 h-14 rounded-2xl shadow-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
        isOpen
          ? 'bg-white border-2 border-indigo-200 shadow-indigo-200/60'
          : 'bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 shadow-indigo-500/40 hover:shadow-indigo-500/60 hover:scale-105'
      ]"
      :title="isOpen ? 'Cerrar a Bit (Esc)' : 'Preguntar a Bit (?)'"
      :aria-label="isOpen ? 'Cerrar el asistente Bit' : 'Abrir el asistente Bit'"
      @click="toggle"
    >
      <Transition
        enter-active-class="transition duration-200"
        enter-from-class="opacity-0 scale-75 rotate-12"
        enter-to-class="opacity-100 scale-100 rotate-0"
        leave-active-class="transition duration-150"
        leave-from-class="opacity-100 scale-100 rotate-0"
        leave-to-class="opacity-0 scale-75 rotate-12"
        mode="out-in"
      >
        <svg v-if="isOpen" class="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
        </svg>

        <svg v-else viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-9 h-9">
          <line x1="20" y1="3" x2="20" y2="8" stroke="white" stroke-width="1.8" stroke-linecap="round" />
          <circle cx="20" cy="2.5" r="2" fill="white" />
          <rect x="7" y="8" width="26" height="18" rx="6" fill="rgba(255,255,255,0.9)" />
          <circle cx="14.5" cy="16" r="4" fill="white" />
          <circle cx="25.5" cy="16" r="4" fill="white" />
          <circle cx="14.5" cy="16" r="2.5" fill="#4f46e5" />
          <circle cx="25.5" cy="16" r="2.5" fill="#4f46e5" />
          <circle cx="15.2" cy="15" r="1" fill="white" />
          <circle cx="26.2" cy="15" r="1" fill="white" />
          <path d="M14.5 22.5 Q20 26 25.5 22.5" stroke="#4f46e5" stroke-width="1.8" fill="none" stroke-linecap="round" />
          <rect x="4" y="13" width="3" height="6" rx="1.5" fill="rgba(255,255,255,0.7)" />
          <rect x="33" y="13" width="3" height="6" rx="1.5" fill="rgba(255,255,255,0.7)" />
          <rect x="13" y="28" width="14" height="10" rx="4" fill="rgba(255,255,255,0.6)" />
          <circle cx="17" cy="33" r="1.5" fill="rgba(255,255,255,0.9)" />
          <circle cx="23" cy="33" r="1.5" fill="rgba(255,255,255,0.9)" />
        </svg>
      </Transition>

      <!-- Pulso solo hasta el primer uso -->
      <span v-if="!isOpen && !assistantSeen" class="absolute -top-1 -right-1 flex h-4 w-4">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-fuchsia-400 opacity-60" />
        <span class="relative inline-flex rounded-full h-4 w-4 bg-fuchsia-500" />
      </span>
    </button>
  </div>
</template>
