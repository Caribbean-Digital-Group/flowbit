<script setup lang="ts">
import type { DocArticle, LearningPath } from '~/composables/useManual'

definePageMeta({ layout: 'manual' })

const route = useRoute()
const router = useRouter()
const config = useRuntimeConfig()

const {
  articles,
  modules,
  learningPaths,
  wizardArticles,
  newArticles,
  searchArticles,
  getArticleById,
  getPathArticles,
  levelLabel,
  levelClass,
  viewTypeLabel,
  viewTypeClass,
  readMinutes
} = useManual()

const { hydrate, recent, isRead, wizardProgress, readArticles } = useManualProgress()
const { feedback } = useManualShare()

const searchQuery = ref((route.query.q as string) ?? '')
const searchInput = ref<HTMLInputElement | null>(null)

const searchResults = computed<DocArticle[]>(() =>
  searchQuery.value.trim() ? searchArticles(searchQuery.value) : []
)

const recentArticles = computed(() =>
  recent.value
    .map(id => getArticleById(id))
    .filter((a): a is DocArticle => Boolean(a))
    .slice(0, 5)
)

/** Porcentaje de la documentación ya marcada como leída en este dispositivo. */
const overallProgress = computed(() =>
  articles.length ? Math.round((readArticles.value.length / articles.length) * 100) : 0
)

function pathProgress(path: LearningPath): number {
  const items = getPathArticles(path)
  if (!items.length) return 0
  return Math.round((items.filter(a => isRead(a.id)).length / items.length) * 100)
}

function pathStartId(path: LearningPath): string {
  return getPathArticles(path)[0]?.id ?? path.articleIds[0] ?? ''
}

function focusSearch() {
  searchInput.value?.focus()
}

/** La tecla «/» enfoca el buscador, salvo que ya se esté escribiendo en un campo. */
function handleKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

  if (event.key === '/' && !typing) {
    event.preventDefault()
    focusSearch()
  }
  if (event.key === 'Escape' && searchQuery.value) {
    searchQuery.value = ''
  }
}

onMounted(() => {
  hydrate()

  // Compatibilidad con los enlaces antiguos del panel: /manual?article=id
  const articleParam = route.query.article as string | undefined
  if (articleParam && getArticleById(articleParam)) {
    router.replace(`/manual/${articleParam}`)
    return
  }

  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

useSeoMeta({
  title: 'Manual de Flowbit — guías de uso del ERP open source',
  description: `${articles.length} guías paso a paso para usar Flowbit: ventas, tienda en línea, punto de venta, inventario, CRM, proyectos y aprobaciones.`,
  ogTitle: 'Manual de usuario de Flowbit',
  ogDescription: 'Guías paso a paso para operar tu empresa con Flowbit: tienda en línea, punto de venta, inventario, CRM y más.',
  ogUrl: `${config.public.siteUrl}/manual`,
  ogType: 'website'
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Aviso de copiado / compartido -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div
        v-if="feedback"
        class="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 shadow-xl print:hidden"
      >
        <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
        </svg>
        {{ feedback }}
      </div>
    </Transition>

    <!-- Portada -->
    <section class="rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 p-5 sm:p-7 shadow-lg shadow-indigo-200/50">
      <div class="flex items-start gap-4">
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
          <h1 class="text-2xl font-bold text-white mb-1">Manual de Flowbit</h1>
          <p class="text-white/80 text-sm leading-relaxed">
            {{ articles.length }} guías con procesos, campos, atajos y preguntas frecuentes.
            Abiertas para cualquiera: léelas, síguelas paso a paso y compártelas con quien las necesite.
          </p>

          <div class="mt-3 flex items-center gap-3 max-w-sm">
            <div class="flex-1 h-1.5 rounded-full bg-white/25 overflow-hidden">
              <div class="h-full rounded-full bg-white transition-all duration-500" :style="{ width: `${overallProgress}%` }" />
            </div>
            <span class="text-[11px] font-semibold text-white/85 whitespace-nowrap">
              {{ readArticles.length }} / {{ articles.length }} leídas
            </span>
          </div>
        </div>
      </div>

      <!-- Buscador -->
      <div class="mt-5 relative">
        <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref="searchInput"
          v-model="searchQuery"
          type="text"
          placeholder="Busca lo que necesites: cupón, corte de caja, Stripe, picking…"
          class="w-full pl-12 pr-20 py-3 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 text-sm font-medium"
        />
        <div class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <button
            v-if="searchQuery"
            type="button"
            class="p-1 rounded-lg text-white/70 hover:text-white transition-colors"
            aria-label="Limpiar búsqueda"
            @click="searchQuery = ''"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <kbd v-else class="hidden sm:block px-1.5 py-0.5 rounded-md bg-white/20 text-white/70 text-[10px] font-bold">/</kbd>
        </div>
      </div>
    </section>

    <!-- Resultados de búsqueda -->
    <template v-if="searchQuery.trim()">
      <div class="rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <p class="text-sm font-semibold text-slate-700">
            {{ searchResults.length }} resultado{{ searchResults.length !== 1 ? 's' : '' }} para «{{ searchQuery }}»
          </p>
        </div>

        <div v-if="searchResults.length === 0" class="py-16 px-6 text-center">
          <div class="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <svg class="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p class="text-sm font-semibold text-slate-700 mb-1">Sin resultados</p>
          <p class="text-xs text-slate-500 mb-4">Prueba con otra palabra.</p>
          <div class="flex flex-wrap justify-center gap-2">
            <button
              v-for="suggestion in ['tienda', 'caja', 'inventario', 'aprobación', 'cliente']"
              :key="suggestion"
              type="button"
              class="px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-semibold text-slate-600 hover:bg-indigo-100 hover:text-indigo-700 transition-colors"
              @click="searchQuery = suggestion"
            >
              {{ suggestion }}
            </button>
          </div>
        </div>

        <ul v-else class="divide-y divide-slate-100">
          <li v-for="result in searchResults" :key="result.id">
            <NuxtLink
              :to="`/manual/${result.id}`"
              class="block px-5 sm:px-6 py-4 hover:bg-indigo-50/50 transition-colors group"
            >
              <div class="flex items-start gap-3">
                <span class="text-2xl flex-shrink-0 mt-0.5">{{ result.moduleEmoji }}</span>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1 flex-wrap">
                    <p class="text-sm font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors">
                      {{ result.title }}
                    </p>
                    <span :class="['text-[10px] font-semibold px-2 py-0.5 rounded-full', viewTypeClass(result.viewType)]">
                      {{ viewTypeLabel(result.viewType) }}
                    </span>
                    <span v-if="result.wizard" class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                      Guía paso a paso
                    </span>
                    <span v-if="result.isNew" class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-fuchsia-100 text-fuchsia-700">
                      Nuevo
                    </span>
                  </div>
                  <p class="text-xs text-slate-500 line-clamp-2">{{ result.summary ?? result.description }}</p>
                  <p class="mt-1 text-[11px] text-slate-400">{{ result.moduleLabel }} · {{ readMinutes(result) }} min</p>
                </div>
                <svg class="w-4 h-4 text-slate-300 group-hover:text-indigo-500 flex-shrink-0 mt-1 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </template>

    <!-- Índice -->
    <template v-else>
      <div class="flex flex-col lg:flex-row gap-6">
        <aside class="lg:w-72 flex-shrink-0">
          <ManualNav />
        </aside>

        <main class="flex-1 min-w-0 space-y-6">
          <!-- Rutas de aprendizaje -->
          <section>
            <h2 class="text-lg font-bold text-slate-800">Rutas de aprendizaje</h2>
            <p class="text-xs text-slate-500 mt-0.5 mb-3">Secuencias listas para dominar un objetivo completo, paso a paso.</p>
            <div class="grid sm:grid-cols-2 gap-3">
              <NuxtLink
                v-for="path in learningPaths"
                :key="path.id"
                :to="`/manual/${pathStartId(path)}`"
                class="rounded-2xl bg-white border border-slate-200 p-4 shadow-lg shadow-slate-200/40 hover:border-indigo-300 hover:shadow-indigo-100 transition-all group"
              >
                <div class="flex items-start gap-3">
                  <span class="text-2xl flex-shrink-0">{{ path.emoji }}</span>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-bold text-slate-800 group-hover:text-indigo-700 transition-colors leading-snug">
                      {{ path.title }}
                    </p>
                    <p class="text-xs text-slate-500 leading-relaxed mt-1">{{ path.description }}</p>

                    <div class="flex items-center gap-2 mt-2.5 flex-wrap">
                      <span :class="['text-[10px] font-semibold px-2 py-0.5 rounded-full', levelClass(path.level)]">
                        {{ levelLabel(path.level) }}
                      </span>
                      <span class="text-[10px] text-slate-400 font-medium">{{ path.articleIds.length }} guías · ~{{ path.estimatedMinutes }} min</span>
                    </div>

                    <div class="mt-2.5 flex items-center gap-2">
                      <div class="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          class="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-600 transition-all duration-500"
                          :style="{ width: `${pathProgress(path)}%` }"
                        />
                      </div>
                      <span class="text-[10px] font-semibold text-slate-400">{{ pathProgress(path) }}%</span>
                    </div>
                  </div>
                </div>
              </NuxtLink>
            </div>
          </section>

          <!-- Novedades -->
          <section v-if="newArticles.length" class="rounded-2xl bg-gradient-to-br from-indigo-50 via-violet-50 to-fuchsia-50 border border-violet-200 p-5">
            <div class="flex items-center gap-2 mb-3">
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-600 text-white">NUEVO</span>
              <h2 class="text-sm font-bold text-slate-800">Documentación recién agregada</h2>
            </div>
            <div class="flex flex-wrap gap-2">
              <NuxtLink
                v-for="item in newArticles"
                :key="item.id"
                :to="`/manual/${item.id}`"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 border border-white text-xs font-semibold text-slate-700 hover:bg-white hover:text-indigo-700 hover:shadow-sm transition-all"
              >
                <span>{{ item.moduleEmoji }}</span>
                {{ item.title }}
              </NuxtLink>
            </div>
          </section>

          <!-- Guías paso a paso -->
          <section>
            <h2 class="text-lg font-bold text-slate-800">Guías paso a paso</h2>
            <p class="text-xs text-slate-500 mt-0.5 mb-3">Marca cada paso conforme lo completas; el avance se guarda solo.</p>
            <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <NuxtLink
                v-for="item in wizardArticles"
                :key="item.id"
                :to="`/manual/${item.id}#guia`"
                class="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all group"
              >
                <div class="flex items-start justify-between gap-2 mb-2">
                  <span class="text-xl">{{ item.moduleEmoji }}</span>
                  <span class="text-[10px] font-semibold text-slate-400">~{{ item.wizard!.estimatedMinutes }} min</span>
                </div>
                <p class="text-xs font-bold text-slate-800 group-hover:text-indigo-700 leading-snug">
                  {{ item.wizard!.title }}
                </p>
                <p class="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">{{ item.wizard!.description }}</p>
                <div class="mt-2.5 flex items-center gap-2">
                  <div class="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      class="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      :style="{ width: `${wizardProgress(item.wizard!.id, item.wizard!.steps.length)}%` }"
                    />
                  </div>
                  <span class="text-[10px] font-semibold text-slate-400">
                    {{ wizardProgress(item.wizard!.id, item.wizard!.steps.length) }}%
                  </span>
                </div>
              </NuxtLink>
            </div>
          </section>

          <!-- Vistos recientemente -->
          <section v-if="recentArticles.length">
            <h2 class="text-sm font-bold text-slate-800 mb-2">Vistos recientemente</h2>
            <div class="flex flex-wrap gap-2">
              <NuxtLink
                v-for="item in recentArticles"
                :key="item.id"
                :to="`/manual/${item.id}`"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-600 hover:border-indigo-200 hover:text-indigo-700 transition-colors"
              >
                <span>{{ item.moduleEmoji }}</span>
                {{ item.title }}
              </NuxtLink>
            </div>
          </section>

          <!-- Todos los módulos -->
          <section v-for="mod in modules" :key="mod.id">
            <div class="flex items-center gap-2">
              <span class="text-xl">{{ mod.emoji }}</span>
              <h2 class="text-base font-bold text-slate-800">{{ mod.label }}</h2>
              <span class="text-[10px] font-semibold text-slate-400">{{ mod.articles.length }} guías</span>
            </div>
            <p class="text-xs text-slate-500 mt-0.5 mb-2.5">{{ mod.description }}</p>
            <div class="grid sm:grid-cols-2 gap-2.5">
              <NuxtLink
                v-for="item in mod.articles"
                :key="item.id"
                :to="`/manual/${item.id}`"
                class="flex items-start justify-between gap-3 p-3.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-sm transition-all group"
              >
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-slate-800 group-hover:text-indigo-700 leading-snug">{{ item.title }}</p>
                  <p class="text-xs text-slate-500 line-clamp-1 mt-0.5">{{ item.summary ?? item.description }}</p>
                </div>
                <span :class="['flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full', viewTypeClass(item.viewType)]">
                  {{ viewTypeLabel(item.viewType) }}
                </span>
              </NuxtLink>
            </div>
          </section>
        </main>
      </div>
    </template>
  </div>
</template>
