<script setup lang="ts">
import type { DocArticle, DocField } from '~/composables/useManual'

interface Props {
  article: DocArticle
  /** Habilita favoritos y "marcar como leído" (se guardan en el navegador). */
  interactive?: boolean
  /** Sección a la que se hace scroll al abrir (llega en el ancla del enlace compartido). */
  initialSection?: string
}

const props = withDefaults(defineProps<Props>(), {
  interactive: true,
  initialSection: undefined
})

const emit = defineEmits<{
  /** El lector abrió otro artículo relacionado. */
  select: [articleId: string]
  /** El lector pulsó una etiqueta y quiere buscarla. */
  search: [term: string]
}>()

const authStore = useAuthStore()
const { levelLabel, levelClass, viewTypeLabel, viewTypeClass, readMinutes, getRelatedArticles } = useManual()
const { isFavorite, toggleFavorite, isRead, toggleRead, trackVisit, hydrate } = useManualProgress()
const { copy, markdown } = useManualShare()

const openFaq = ref<number | null>(0)

const related = computed(() => getRelatedArticles(props.article))
const minutes = computed(() => readMinutes(props.article))

/** Índice de secciones presentes en este artículo, para el menú de navegación rápida. */
const tableOfContents = computed(() => {
  const toc: { id: string; label: string }[] = [{ id: 'resumen', label: 'Resumen' }]
  if (props.article.wizard) toc.push({ id: 'guia', label: 'Guía paso a paso' })
  if (props.article.process?.length) toc.push({ id: 'proceso', label: 'Proceso' })
  if (props.article.tips.length) toc.push({ id: 'consejos', label: 'Consejos' })
  if (props.article.fields?.length) toc.push({ id: 'campos', label: 'Campos' })
  if (props.article.shortcuts?.length) toc.push({ id: 'atajos', label: 'Atajos' })
  if (props.article.faqs?.length) toc.push({ id: 'faq', label: 'Preguntas frecuentes' })
  if (related.value.length) toc.push({ id: 'relacionados', label: 'Relacionados' })
  return toc
})

function fieldTypeLabel(type: DocField['type']): string {
  const labels: Record<DocField['type'], string> = {
    text: 'Texto',
    select: 'Selección',
    date: 'Fecha',
    number: 'Número',
    textarea: 'Texto largo',
    boolean: 'Sí / No',
    relation: 'Relación'
  }
  return labels[type] ?? type
}

function scrollToSection(id: string) {
  document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// ── Textos compartibles por sección ──────────────────────────────────────────

const tipsText = computed(() =>
  `${props.article.title} — consejos\n\n${props.article.tips.map(t => `• ${t}`).join('\n')}`
)
const processText = computed(() =>
  `${props.article.title} — proceso\n\n${(props.article.process ?? []).map(s => `${s.step}. ${s.title}: ${s.description}`).join('\n')}`
)
const fieldsText = computed(() =>
  `${props.article.title} — campos\n\n${(props.article.fields ?? [])
    .map(f => `• ${f.label} (${f.required ? 'requerido' : 'opcional'}): ${f.description}`)
    .join('\n')}`
)
const shortcutsText = computed(() =>
  `${props.article.title} — atajos\n\n${(props.article.shortcuts ?? []).map(s => `${s.keys} → ${s.action}`).join('\n')}`
)
const faqText = computed(() =>
  `${props.article.title} — preguntas frecuentes\n\n${(props.article.faqs ?? [])
    .map(f => `${f.question}\n${f.answer}`)
    .join('\n\n')}`
)
const summaryText = computed(() =>
  `${props.article.title}\n\n${props.article.description}\n\n¿Por qué importa? ${props.article.importance}`
)

async function copyWholeArticle() {
  await copy(markdown(props.article), 'Documentación copiada')
}

function printArticle() {
  window.print()
}

/**
 * Los accesos a las vistas del panel solo se ofrecen a quien tiene sesión.
 * Es reactivo porque el layout resuelve la sesión después del montaje.
 */
const canOpenPanel = computed(() => authStore.isAuthenticated)

onMounted(() => {
  hydrate()
  if (props.interactive) trackVisit(props.article.id)
  if (props.initialSection) {
    nextTick(() => setTimeout(() => scrollToSection(props.initialSection!), 120))
  }
})

watch(() => props.article.id, id => {
  openFaq.value = 0
  if (props.interactive) trackVisit(id)
})
</script>

<template>
  <article class="space-y-5">
    <!-- Encabezado -->
    <header class="rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden">
      <div class="p-5 sm:p-6">
        <div class="flex items-start gap-4">
          <div class="w-14 h-14 flex-shrink-0 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-100 border border-indigo-100 flex items-center justify-center text-3xl">
            {{ article.moduleEmoji }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap mb-1.5">
              <span class="text-xs text-slate-500 font-medium">{{ article.moduleLabel }}</span>
              <span class="text-slate-300">·</span>
              <span :class="['text-[11px] font-semibold px-2 py-0.5 rounded-full', viewTypeClass(article.viewType)]">
                {{ viewTypeLabel(article.viewType) }}
              </span>
              <span :class="['text-[11px] font-semibold px-2 py-0.5 rounded-full', levelClass(article.level)]">
                {{ levelLabel(article.level) }}
              </span>
              <span class="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {{ minutes }} min
              </span>
              <span
                v-if="article.isNew"
                class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-600 text-white"
              >
                NUEVO
              </span>
            </div>
            <h1 class="text-xl sm:text-2xl font-bold text-slate-900 mb-2 leading-tight">{{ article.title }}</h1>
            <p class="text-sm text-slate-600 leading-relaxed">{{ article.summary ?? article.description }}</p>
          </div>
        </div>
      </div>

      <!-- Barra de acciones -->
      <div class="flex flex-wrap items-center gap-2 px-5 sm:px-6 py-3 border-t border-slate-100 bg-slate-50/70 print:hidden">
        <ManualShareMenu :article="article" align="left" />

        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:border-indigo-200 hover:text-indigo-700 hover:bg-indigo-50/60 transition-colors"
          @click="copyWholeArticle"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copiar todo
        </button>

        <template v-if="interactive">
          <button
            type="button"
            :class="[
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
              isFavorite(article.id)
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-white border-slate-200 text-slate-600 hover:border-amber-200 hover:text-amber-700'
            ]"
            @click="toggleFavorite(article.id)"
          >
            <svg class="w-3.5 h-3.5" :fill="isFavorite(article.id) ? 'currentColor' : 'none'" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            {{ isFavorite(article.id) ? 'Favorito' : 'Guardar' }}
          </button>

          <button
            type="button"
            :class="[
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
              isRead(article.id)
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-200 hover:text-emerald-700'
            ]"
            @click="toggleRead(article.id)"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
            </svg>
            {{ isRead(article.id) ? 'Leído' : 'Marcar leído' }}
          </button>
        </template>

        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800 transition-colors"
          title="Imprimir o guardar como PDF"
          @click="printArticle"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Imprimir
        </button>
      </div>

      <!-- Índice rápido -->
      <nav v-if="tableOfContents.length > 2" class="flex flex-wrap gap-1.5 px-5 sm:px-6 py-2.5 border-t border-slate-100 print:hidden">
        <button
          v-for="item in tableOfContents"
          :key="item.id"
          type="button"
          class="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-500 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
          @click="scrollToSection(item.id)"
        >
          {{ item.label }}
        </button>
      </nav>
    </header>

    <!-- Resumen y relevancia -->
    <section id="section-resumen" class="group scroll-mt-24 rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-200 p-5 sm:p-6">
      <div class="flex items-start justify-between gap-3 mb-3">
        <h2 class="text-base font-bold text-slate-800 flex items-center gap-2">
          <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          ¿Qué es esta vista?
        </h2>
        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity print:hidden">
          <ManualCopyButton :text="summaryText" icon-only size="xs" label="Copiar resumen" />
          <ManualShareMenu :article="article" section-id="resumen" :section-text="summaryText" compact />
        </div>
      </div>
      <p class="text-sm text-slate-600 leading-relaxed">{{ article.description }}</p>

      <div class="mt-4 rounded-xl bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200 p-4">
        <p class="text-[11px] font-bold uppercase tracking-wider text-violet-600 mb-1">¿Por qué es importante?</p>
        <p class="text-sm text-slate-700 leading-relaxed">{{ article.importance }}</p>
      </div>
    </section>

    <!-- Guía paso a paso -->
    <section v-if="article.wizard" id="section-guia" class="scroll-mt-24">
      <ManualWizard :wizard="article.wizard" :article="article" />
    </section>

    <!-- Diagrama de proceso -->
    <section
      v-if="article.process?.length"
      id="section-proceso"
      class="group scroll-mt-24 rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-200 p-5 sm:p-6"
    >
      <div class="flex items-start justify-between gap-3 mb-5">
        <h2 class="text-base font-bold text-slate-800 flex items-center gap-2">
          <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
          Cómo fluye el proceso
        </h2>
        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity print:hidden">
          <ManualCopyButton :text="processText" icon-only size="xs" label="Copiar proceso" />
          <ManualShareMenu :article="article" section-id="proceso" :section-text="processText" compact />
        </div>
      </div>

      <div class="flex flex-col sm:flex-row items-stretch sm:items-start gap-0">
        <template v-for="(step, idx) in article.process" :key="step.step">
          <div class="flex sm:flex-col items-center gap-3 sm:gap-2 flex-1">
            <div class="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-sm font-bold flex items-center justify-center shadow-md shadow-indigo-200/50">
              {{ step.step }}
            </div>
            <div class="sm:text-center flex-1 sm:flex-none sm:px-1">
              <p class="text-xs font-bold text-slate-800 leading-tight">{{ step.title }}</p>
              <p class="text-[11px] text-slate-500 leading-relaxed mt-0.5">{{ step.description }}</p>
            </div>
          </div>
          <div v-if="idx < article.process!.length - 1" class="flex-shrink-0 hidden sm:flex sm:pt-2">
            <svg class="w-5 h-5 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <div v-if="idx < article.process!.length - 1" class="sm:hidden flex-shrink-0 w-0.5 h-4 bg-indigo-200 ml-4" />
        </template>
      </div>
    </section>

    <!-- Consejos -->
    <section
      v-if="article.tips.length"
      id="section-consejos"
      class="group scroll-mt-24 rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-200 p-5 sm:p-6"
    >
      <div class="flex items-start justify-between gap-3 mb-4">
        <h2 class="text-base font-bold text-slate-800 flex items-center gap-2">
          <svg class="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
          </svg>
          Consejos y buenas prácticas
        </h2>
        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity print:hidden">
          <ManualCopyButton :text="tipsText" icon-only size="xs" label="Copiar consejos" />
          <ManualShareMenu :article="article" section-id="consejos" :section-text="tipsText" compact />
        </div>
      </div>

      <ul class="space-y-2.5">
        <li
          v-for="(tip, i) in article.tips"
          :key="i"
          class="group/tip flex items-start gap-3 rounded-xl p-2 -m-2 hover:bg-amber-50/50 transition-colors"
        >
          <div class="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center mt-0.5">
            {{ i + 1 }}
          </div>
          <p class="flex-1 text-sm text-slate-700 leading-relaxed">{{ tip }}</p>
          <div class="opacity-0 group-hover/tip:opacity-100 focus-within:opacity-100 transition-opacity flex-shrink-0 print:hidden">
            <ManualCopyButton :text="`${tip}\n\n— ${article.title} · Flowbit`" icon-only size="xs" label="Copiar consejo" />
          </div>
        </li>
      </ul>
    </section>

    <!-- Campos del formulario -->
    <section
      v-if="article.fields?.length"
      id="section-campos"
      class="group scroll-mt-24 rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden"
    >
      <div class="flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/80">
        <div>
          <h2 class="text-base font-bold text-slate-800 flex items-center gap-2">
            <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Campos del formulario
          </h2>
          <p class="text-xs text-slate-500 mt-1">Qué escribir en cada campo y por qué importa.</p>
        </div>
        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity print:hidden">
          <ManualCopyButton :text="fieldsText" icon-only size="xs" label="Copiar campos" />
          <ManualShareMenu :article="article" section-id="campos" :section-text="fieldsText" compact />
        </div>
      </div>

      <div class="divide-y divide-slate-100">
        <div
          v-for="field in article.fields"
          :key="field.label"
          class="px-5 sm:px-6 py-4 hover:bg-slate-50/60 transition-colors"
        >
          <div class="flex items-center gap-2 flex-wrap mb-2">
            <p class="text-sm font-bold text-slate-800">{{ field.label }}</p>
            <span class="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
              {{ fieldTypeLabel(field.type) }}
            </span>
            <span
              :class="[
                'text-[11px] px-2 py-0.5 rounded-full font-semibold',
                field.required ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'
              ]"
            >
              {{ field.required ? 'Requerido' : 'Opcional' }}
            </span>
          </div>
          <p class="text-sm text-slate-600 leading-relaxed mb-2">{{ field.description }}</p>
          <div v-if="field.tip" class="flex items-start gap-2 bg-indigo-50/60 rounded-lg px-3 py-2 border border-indigo-100">
            <svg class="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
            </svg>
            <p class="text-xs text-indigo-700 leading-relaxed">{{ field.tip }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Atajos de teclado -->
    <section
      v-if="article.shortcuts?.length"
      id="section-atajos"
      class="group scroll-mt-24 rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden"
    >
      <div class="flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/80">
        <h2 class="text-base font-bold text-slate-800 flex items-center gap-2">
          <svg class="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9h8m-8 3h4m-7 6h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Atajos de teclado
        </h2>
        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity print:hidden">
          <ManualCopyButton :text="shortcutsText" icon-only size="xs" label="Copiar atajos" />
          <ManualShareMenu :article="article" section-id="atajos" :section-text="shortcutsText" compact />
        </div>
      </div>
      <div class="grid sm:grid-cols-2 divide-y sm:divide-y-0 divide-slate-100">
        <div
          v-for="shortcut in article.shortcuts"
          :key="shortcut.keys"
          class="flex items-center gap-3 px-5 sm:px-6 py-2.5 sm:border-b sm:border-slate-100"
        >
          <kbd class="flex-shrink-0 min-w-[3.5rem] text-center px-2 py-1 rounded-lg bg-slate-800 text-white text-[11px] font-bold font-mono shadow-sm">
            {{ shortcut.keys }}
          </kbd>
          <span class="text-xs text-slate-600 leading-snug">{{ shortcut.action }}</span>
        </div>
      </div>
    </section>

    <!-- Preguntas frecuentes -->
    <section
      v-if="article.faqs?.length"
      id="section-faq"
      class="group scroll-mt-24 rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden"
    >
      <div class="flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/80">
        <h2 class="text-base font-bold text-slate-800 flex items-center gap-2">
          <svg class="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Preguntas frecuentes
        </h2>
        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity print:hidden">
          <ManualCopyButton :text="faqText" icon-only size="xs" label="Copiar preguntas" />
          <ManualShareMenu :article="article" section-id="faq" :section-text="faqText" compact />
        </div>
      </div>
      <div class="divide-y divide-slate-100">
        <div v-for="(faq, i) in article.faqs" :key="faq.question">
          <button
            type="button"
            class="w-full flex items-center justify-between gap-3 px-5 sm:px-6 py-3.5 text-left hover:bg-slate-50/60 transition-colors"
            @click="openFaq = openFaq === i ? null : i"
          >
            <span class="text-sm font-semibold text-slate-800 leading-snug">{{ faq.question }}</span>
            <svg
              :class="['w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200', openFaq === i ? 'rotate-180' : '']"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0 -translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <div v-if="openFaq === i" class="px-5 sm:px-6 pb-4 flex items-start gap-2">
              <p class="flex-1 text-sm text-slate-600 leading-relaxed">{{ faq.answer }}</p>
              <ManualCopyButton
                :text="`${faq.question}\n${faq.answer}\n\n— ${article.title} · Flowbit`"
                icon-only
                size="xs"
                label="Copiar respuesta"
                class="print:hidden"
              />
            </div>
          </Transition>
        </div>
      </div>
    </section>

    <!-- Relacionados -->
    <section
      v-if="related.length || (canOpenPanel && article.relatedModules?.length)"
      id="section-relacionados"
      class="scroll-mt-24 rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-200 p-5 sm:p-6 print:hidden"
    >
      <h2 class="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
        <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        Sigue aprendiendo
      </h2>

      <!-- Otros artículos -->
      <div v-if="related.length" class="grid sm:grid-cols-2 gap-2.5 mb-4">
        <button
          v-for="item in related"
          :key="item.id"
          type="button"
          class="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 text-left hover:border-indigo-200 hover:bg-indigo-50/40 transition-colors group"
          @click="emit('select', item.id)"
        >
          <span class="text-lg flex-shrink-0">{{ item.moduleEmoji }}</span>
          <div class="min-w-0">
            <p class="text-xs font-semibold text-slate-800 group-hover:text-indigo-700 leading-snug">{{ item.title }}</p>
            <p class="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{{ item.summary ?? item.description }}</p>
          </div>
        </button>
      </div>

      <!-- Ir al módulo (solo con sesión iniciada) -->
      <template v-if="canOpenPanel && article.relatedModules?.length">
        <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Abrir en el panel</p>
        <div class="flex flex-wrap gap-2">
          <NuxtLink
            v-for="mod in article.relatedModules"
            :key="mod.route"
            :to="mod.route"
            class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 transition-all"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            {{ mod.label }}
          </NuxtLink>
        </div>
      </template>
    </section>

    <!-- Etiquetas -->
    <div v-if="article.tags?.length" class="flex flex-wrap gap-1.5 print:hidden">
      <button
        v-for="tag in article.tags"
        :key="tag"
        type="button"
        class="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 font-medium hover:bg-indigo-100 hover:text-indigo-600 transition-colors"
        @click="emit('search', tag)"
      >
        #{{ tag }}
      </button>
    </div>
  </article>
</template>
