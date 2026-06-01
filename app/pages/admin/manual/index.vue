<script setup lang="ts">
import type { DocArticle, DocField } from '~/composables/useManual'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const { articles, modules, searchArticles } = useManual()

const searchQuery = ref('')
const selectedArticleId = ref<string | null>(null)
const expandedModules = ref<Set<string>>(new Set(['core', 'partners', 'orders', 'pickings', 'projects']))

const searchResults = computed<DocArticle[]>(() =>
  searchQuery.value.trim() ? searchArticles(searchQuery.value) : []
)

const selectedArticle = computed<DocArticle | undefined>(() =>
  selectedArticleId.value
    ? articles.find(a => a.id === selectedArticleId.value)
    : undefined
)

function selectArticle(article: DocArticle) {
  selectedArticleId.value = article.id
  searchQuery.value = ''
  if (window.innerWidth < 1024) {
    nextTick(() => {
      document.getElementById('article-content')?.scrollIntoView({ behavior: 'smooth' })
    })
  }
}

function toggleModule(moduleId: string) {
  if (expandedModules.value.has(moduleId)) {
    expandedModules.value.delete(moduleId)
  } else {
    expandedModules.value.add(moduleId)
  }
}

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

function viewTypeLabel(type: DocArticle['viewType']): string {
  const labels: Record<DocArticle['viewType'], string> = {
    list: 'Vista Lista',
    create: 'Formulario Creación',
    detail: 'Vista Detalle',
    scan: 'Vista Escaneo',
    dashboard: 'Panel Principal',
    config: 'Configuración',
    team: 'Gestión Equipo'
  }
  return labels[type] ?? type
}

function viewTypeBadgeClass(type: DocArticle['viewType']): string {
  const classes: Record<DocArticle['viewType'], string> = {
    list: 'bg-blue-100 text-blue-700',
    create: 'bg-green-100 text-green-700',
    detail: 'bg-violet-100 text-violet-700',
    scan: 'bg-amber-100 text-amber-700',
    dashboard: 'bg-indigo-100 text-indigo-700',
    config: 'bg-slate-100 text-slate-700',
    team: 'bg-fuchsia-100 text-fuchsia-700'
  }
  return classes[type] ?? 'bg-slate-100 text-slate-700'
}

// Seleccionar artículo desde query param
onMounted(() => {
  const articleParam = route.query.article as string | undefined
  if (articleParam) {
    selectedArticleId.value = articleParam
    const article = articles.find(a => a.id === articleParam)
    if (article) {
      expandedModules.value.add(article.module)
    }
  }
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Header -->
    <div class="rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 p-6 shadow-lg shadow-indigo-200/50">
      <div class="flex items-center gap-4">
        <!-- Mascota grande -->
        <div class="flex-shrink-0 w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
          <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-12 h-12">
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
        </div>
        <div class="flex-1 min-w-0">
          <h1 class="text-2xl font-bold text-white mb-1">Manual de Usuario</h1>
          <p class="text-white/75 text-sm leading-relaxed">
            Documentación completa de Flowbit. Encuentra guías detalladas de cada módulo, procesos, campos y consejos para usar la plataforma correctamente.
          </p>
        </div>
      </div>

      <!-- Buscador principal -->
      <div class="mt-5 relative">
        <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar en toda la documentación..."
          class="w-full pl-12 pr-4 py-3 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 text-sm font-medium"
        />
        <button
          v-if="searchQuery"
          type="button"
          class="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-white/60 hover:text-white transition-colors"
          @click="searchQuery = ''"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Resultados de búsqueda -->
    <template v-if="searchQuery.trim()">
      <div class="rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <p class="text-sm font-semibold text-slate-700">
            {{ searchResults.length }} resultado{{ searchResults.length !== 1 ? 's' : '' }} para "{{ searchQuery }}"
          </p>
        </div>
        <div v-if="searchResults.length === 0" class="py-16 text-center">
          <div class="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <svg class="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p class="text-sm font-semibold text-slate-700 mb-1">Sin resultados</p>
          <p class="text-xs text-slate-500">Intenta con otros términos de búsqueda.</p>
        </div>
        <ul v-else class="divide-y divide-slate-100">
          <li
            v-for="result in searchResults"
            :key="result.id"
          >
            <button
              type="button"
              class="w-full px-6 py-4 text-left hover:bg-indigo-50/50 transition-colors group"
              @click="selectArticle(result)"
            >
              <div class="flex items-start gap-3">
                <span class="text-2xl flex-shrink-0 mt-0.5">{{ result.moduleEmoji }}</span>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <p class="text-sm font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors">
                      {{ result.title }}
                    </p>
                    <span :class="['text-[10px] font-semibold px-2 py-0.5 rounded-full', viewTypeBadgeClass(result.viewType)]">
                      {{ viewTypeLabel(result.viewType) }}
                    </span>
                  </div>
                  <p class="text-xs text-slate-500 line-clamp-2">{{ result.description }}</p>
                  <p class="mt-1 text-[11px] text-slate-400">{{ result.moduleLabel }}</p>
                </div>
                <svg class="w-4 h-4 text-slate-400 group-hover:text-indigo-500 flex-shrink-0 mt-1 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          </li>
        </ul>
      </div>
    </template>

    <!-- Layout principal: Sidebar + Contenido -->
    <template v-else>
      <div class="flex flex-col lg:flex-row gap-6 min-h-[600px]">
        <!-- Sidebar de navegación -->
        <aside class="lg:w-72 flex-shrink-0">
          <div class="rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden sticky top-24">
            <div class="px-4 py-3 border-b border-slate-100 bg-slate-50/80">
              <p class="text-xs font-bold uppercase tracking-wider text-slate-500">Módulos</p>
            </div>
            <nav class="overflow-y-auto max-h-[calc(100vh-16rem)]">
              <div
                v-for="mod in modules"
                :key="mod.id"
                class="border-b border-slate-50 last:border-0"
              >
                <!-- Header del módulo -->
                <button
                  type="button"
                  class="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
                  @click="toggleModule(mod.id)"
                >
                  <span class="flex items-center gap-2">
                    <span class="text-base">{{ mod.emoji }}</span>
                    <span class="text-sm font-semibold text-slate-700">{{ mod.label }}</span>
                  </span>
                  <svg
                    :class="[
                      'w-4 h-4 text-slate-400 transition-transform duration-200',
                      expandedModules.has(mod.id) ? 'rotate-90' : ''
                    ]"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                <!-- Artículos del módulo -->
                <Transition
                  enter-active-class="transition duration-200 ease-out"
                  enter-from-class="opacity-0 -translate-y-1"
                  enter-to-class="opacity-100 translate-y-0"
                  leave-active-class="transition duration-150 ease-in"
                  leave-from-class="opacity-100 translate-y-0"
                  leave-to-class="opacity-0 -translate-y-1"
                >
                  <ul v-if="expandedModules.has(mod.id)" class="bg-slate-50/60 border-t border-slate-100">
                    <li
                      v-for="article in mod.articles"
                      :key="article.id"
                    >
                      <button
                        type="button"
                        :class="[
                          'w-full flex items-center gap-2 px-5 py-2 text-left text-sm transition-colors',
                          selectedArticleId === article.id
                            ? 'bg-indigo-50 text-indigo-700 font-semibold border-l-2 border-indigo-500'
                            : 'text-slate-600 hover:bg-white hover:text-slate-800 border-l-2 border-transparent'
                        ]"
                        @click="selectArticle(article)"
                      >
                        <span class="truncate">{{ article.title }}</span>
                      </button>
                    </li>
                  </ul>
                </Transition>
              </div>
            </nav>
          </div>
        </aside>

        <!-- Área de contenido del artículo -->
        <main id="article-content" class="flex-1 min-w-0">
          <!-- Estado vacío: ningún artículo seleccionado -->
          <template v-if="!selectedArticle">
            <div class="rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-200 p-12 text-center">
              <div class="w-20 h-20 mx-auto mb-6">
                <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full h-full opacity-30">
                  <line x1="20" y1="3" x2="20" y2="8" stroke="#6366f1" stroke-width="1.8" stroke-linecap="round" />
                  <circle cx="20" cy="2.5" r="2" fill="#6366f1" />
                  <rect x="7" y="8" width="26" height="18" rx="6" fill="#6366f1" />
                  <circle cx="14.5" cy="16" r="4" fill="white" />
                  <circle cx="25.5" cy="16" r="4" fill="white" />
                  <circle cx="14.5" cy="16" r="2.5" fill="#4f46e5" />
                  <circle cx="25.5" cy="16" r="2.5" fill="#4f46e5" />
                  <path d="M14.5 22.5 Q20 26 25.5 22.5" stroke="white" stroke-width="1.8" fill="none" stroke-linecap="round" />
                  <rect x="13" y="28" width="14" height="10" rx="4" fill="#6366f1" />
                </svg>
              </div>
              <h2 class="text-lg font-bold text-slate-700 mb-2">Selecciona un tema del menú</h2>
              <p class="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
                Elige un módulo en el panel izquierdo para ver su documentación detallada, o usa el buscador para encontrar un tema específico.
              </p>
              <div class="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-lg mx-auto">
                <button
                  v-for="mod in modules.slice(0, 6)"
                  :key="mod.id"
                  type="button"
                  class="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors group"
                  @click="() => { toggleModule(mod.id); if (mod.articles[0]) selectArticle(mod.articles[0]) }"
                >
                  <span class="text-2xl">{{ mod.emoji }}</span>
                  <span class="text-xs font-semibold text-slate-600 group-hover:text-indigo-700 text-center leading-tight">{{ mod.label }}</span>
                </button>
              </div>
            </div>
          </template>

          <!-- Artículo seleccionado -->
          <template v-else>
            <article class="space-y-6">
              <!-- Encabezado del artículo -->
              <div class="rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-200 p-6">
                <div class="flex items-start gap-4">
                  <div class="w-14 h-14 flex-shrink-0 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-100 border border-indigo-100 flex items-center justify-center text-3xl">
                    {{ selectedArticle.moduleEmoji }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap mb-1">
                      <span class="text-xs text-slate-500 font-medium">{{ selectedArticle.moduleLabel }}</span>
                      <span class="text-slate-300">·</span>
                      <span :class="['text-[11px] font-semibold px-2 py-0.5 rounded-full', viewTypeBadgeClass(selectedArticle.viewType)]">
                        {{ viewTypeLabel(selectedArticle.viewType) }}
                      </span>
                    </div>
                    <h2 class="text-xl font-bold text-slate-900 mb-2">{{ selectedArticle.title }}</h2>
                    <p class="text-sm text-slate-600 leading-relaxed">{{ selectedArticle.description }}</p>
                  </div>
                </div>
              </div>

              <!-- Importancia -->
              <div class="rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200 p-5">
                <div class="flex items-start gap-3">
                  <div class="flex-shrink-0 w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
                    <svg class="w-4 h-4 text-violet-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p class="text-xs font-bold uppercase tracking-wider text-violet-600 mb-1">¿Por qué es importante?</p>
                    <p class="text-sm text-slate-700 leading-relaxed">{{ selectedArticle.importance }}</p>
                  </div>
                </div>
              </div>

              <!-- Proceso (diagrama de flujo) -->
              <div v-if="selectedArticle.process && selectedArticle.process.length > 0" class="rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-200 p-6">
                <h3 class="text-base font-bold text-slate-800 mb-5 flex items-center gap-2">
                  <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                  Diagrama de Proceso
                </h3>
                <div class="flex flex-col sm:flex-row items-start sm:items-center gap-0">
                  <template v-for="(step, idx) in selectedArticle.process" :key="step.step">
                    <div class="flex sm:flex-col items-center sm:items-center gap-3 sm:gap-2 flex-1">
                      <!-- Círculo de paso -->
                      <div class="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-sm font-bold flex items-center justify-center shadow-md shadow-indigo-200/50">
                        {{ step.step }}
                      </div>
                      <div class="sm:text-center flex-1 sm:flex-none sm:px-1">
                        <p class="text-xs font-bold text-slate-800 leading-tight">{{ step.title }}</p>
                        <p class="text-[11px] text-slate-500 leading-relaxed mt-0.5">{{ step.description }}</p>
                      </div>
                    </div>
                    <!-- Conector -->
                    <div
                      v-if="idx < selectedArticle.process!.length - 1"
                      class="flex-shrink-0 hidden sm:block"
                    >
                      <svg class="w-5 h-5 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <div
                      v-if="idx < selectedArticle.process!.length - 1"
                      class="sm:hidden flex-shrink-0 w-0.5 h-4 bg-indigo-200 ml-4"
                    />
                  </template>
                </div>
              </div>

              <!-- Consejos -->
              <div v-if="selectedArticle.tips.length > 0" class="rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-200 p-6">
                <h3 class="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <svg class="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                  </svg>
                  Consejos y Buenas Prácticas
                </h3>
                <ul class="space-y-3">
                  <li
                    v-for="(tip, i) in selectedArticle.tips"
                    :key="i"
                    class="flex items-start gap-3"
                  >
                    <div class="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center mt-0.5">
                      {{ i + 1 }}
                    </div>
                    <p class="text-sm text-slate-700 leading-relaxed">{{ tip }}</p>
                  </li>
                </ul>
              </div>

              <!-- Tabla de Campos -->
              <div v-if="selectedArticle.fields && selectedArticle.fields.length > 0" class="rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden">
                <div class="px-6 py-4 border-b border-slate-100 bg-slate-50/80">
                  <h3 class="text-base font-bold text-slate-800 flex items-center gap-2">
                    <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Campos del Formulario
                  </h3>
                  <p class="text-xs text-slate-500 mt-1">Descripción y consejos de uso para cada campo del formulario.</p>
                </div>
                <div class="divide-y divide-slate-100">
                  <div
                    v-for="field in selectedArticle.fields"
                    :key="field.label"
                    class="px-6 py-4 hover:bg-slate-50/60 transition-colors"
                  >
                    <div class="flex items-start justify-between gap-4 mb-2">
                      <div class="flex items-center gap-2 flex-wrap">
                        <p class="text-sm font-bold text-slate-800">{{ field.label }}</p>
                        <span class="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                          {{ fieldTypeLabel(field.type) }}
                        </span>
                        <span
                          v-if="field.required"
                          class="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold"
                        >
                          Requerido
                        </span>
                        <span
                          v-else
                          class="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 font-medium"
                        >
                          Opcional
                        </span>
                      </div>
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
              </div>

              <!-- Módulos Relacionados -->
              <div v-if="selectedArticle.relatedModules && selectedArticle.relatedModules.length > 0" class="rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-200 p-6">
                <h3 class="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Módulos Relacionados
                </h3>
                <div class="flex flex-wrap gap-3">
                  <NuxtLink
                    v-for="mod in selectedArticle.relatedModules"
                    :key="mod.route"
                    :to="mod.route"
                    class="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 transition-all"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    {{ mod.label }}
                  </NuxtLink>
                </div>
              </div>

              <!-- Tags -->
              <div v-if="selectedArticle.tags && selectedArticle.tags.length > 0" class="flex flex-wrap gap-2">
                <span
                  v-for="tag in selectedArticle.tags"
                  :key="tag"
                  class="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 font-medium cursor-pointer hover:bg-indigo-100 hover:text-indigo-600 transition-colors"
                  @click="searchQuery = tag"
                >
                  #{{ tag }}
                </span>
              </div>
            </article>
          </template>
        </main>
      </div>
    </template>
  </div>
</template>
