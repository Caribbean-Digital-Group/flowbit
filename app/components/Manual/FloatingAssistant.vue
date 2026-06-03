<script setup lang="ts">
import type { DocArticle, DocField } from '~/composables/useManual'

const route = useRoute()
const { getContextForRoute } = useManual()

const isOpen = ref(false)
const activeTab = ref<'info' | 'fields'>('info')
const searchQuery = ref('')
const { searchArticles } = useManual()

const currentArticle = computed<DocArticle | undefined>(() =>
  getContextForRoute(route.path)
)

const searchResults = computed(() =>
  searchQuery.value.trim()
    ? searchArticles(searchQuery.value).slice(0, 5)
    : []
)

const visibleTips = computed(() => currentArticle.value?.tips?.slice(0, 3) ?? [])
const hasFields = computed(() => (currentArticle.value?.fields?.length ?? 0) > 0)

watch(() => route.path, () => {
  activeTab.value = 'info'
  searchQuery.value = ''
})

function toggle() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    searchQuery.value = ''
    activeTab.value = hasFields.value ? activeTab.value : 'info'
  }
}

function close() {
  isOpen.value = false
}

function navigateToManual(articleId?: string) {
  close()
  navigateTo(articleId ? `/admin/manual?article=${articleId}` : '/admin/manual')
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
</script>

<template>
  <div class="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
    <!-- Panel expandido -->
    <Transition
      enter-active-class="transition duration-250 ease-out"
      enter-from-class="opacity-0 scale-95 translate-y-2"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-95 translate-y-2"
    >
      <div
        v-if="isOpen"
        class="w-80 max-h-[calc(100vh-8rem)] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-indigo-200/40 overflow-hidden"
      >
        <!-- Cabecera del panel -->
        <div class="flex-shrink-0 bg-gradient-to-r from-indigo-500 via-violet-600 to-fuchsia-600 px-4 py-3">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2.5 min-w-0">
              <!-- Mascota mini -->
              <div class="w-8 h-8 flex-shrink-0">
                <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full h-full">
                  <circle cx="20" cy="20" r="20" fill="rgba(255,255,255,0.15)" />
                  <line x1="20" y1="4" x2="20" y2="9" stroke="white" stroke-width="1.5" stroke-linecap="round" />
                  <circle cx="20" cy="3.5" r="1.5" fill="white" />
                  <rect x="8" y="9" width="24" height="17" rx="5" fill="white" fill-opacity="0.25" />
                  <rect x="8" y="9" width="24" height="17" rx="5" stroke="white" stroke-width="1" />
                  <circle cx="15" cy="17" r="3.5" fill="white" />
                  <circle cx="25" cy="17" r="3.5" fill="white" />
                  <circle cx="15.5" cy="17" r="2" fill="#6366f1" />
                  <circle cx="25.5" cy="17" r="2" fill="#6366f1" />
                  <circle cx="16" cy="16.2" r="0.8" fill="white" />
                  <circle cx="26" cy="16.2" r="0.8" fill="white" />
                  <path d="M15 23.5 Q20 26.5 25 23.5" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round" />
                  <rect x="5" y="14" width="3" height="5" rx="1.5" fill="white" fill-opacity="0.4" />
                  <rect x="32" y="14" width="3" height="5" rx="1.5" fill="white" fill-opacity="0.4" />
                  <rect x="13" y="27" width="14" height="9" rx="3.5" fill="white" fill-opacity="0.2" stroke="white" stroke-width="1" />
                </svg>
              </div>
              <div class="min-w-0">
                <p class="text-[11px] font-semibold text-white/70 uppercase tracking-wider leading-none">
                  Asistente Flowbit
                </p>
                <p class="text-sm font-bold text-white truncate leading-tight mt-0.5">
                  {{ currentArticle?.title ?? 'Ayuda contextual' }}
                </p>
              </div>
            </div>
            <button
              type="button"
              class="flex-shrink-0 p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-colors"
              @click="close"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Buscador -->
        <div class="flex-shrink-0 px-3 pt-3 pb-1 border-b border-slate-100">
          <div class="relative">
            <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Buscar en el manual..."
              class="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
            />
          </div>
        </div>

        <!-- Resultados de búsqueda -->
        <template v-if="searchQuery.trim()">
          <div class="flex-1 overflow-y-auto py-1">
            <template v-if="searchResults.length === 0">
              <p class="px-4 py-6 text-center text-xs text-slate-400">
                Sin resultados para "{{ searchQuery }}"
              </p>
            </template>
            <ul v-else class="divide-y divide-slate-50">
              <li
                v-for="result in searchResults"
                :key="result.id"
              >
                <button
                  type="button"
                  class="w-full px-4 py-2.5 text-left hover:bg-indigo-50/60 transition-colors"
                  @click="navigateToManual(result.id)"
                >
                  <p class="text-sm font-medium text-slate-800 leading-snug">
                    {{ result.moduleEmoji }} {{ result.title }}
                  </p>
                  <p class="mt-0.5 text-xs text-slate-500 line-clamp-2">
                    {{ result.description }}
                  </p>
                </button>
              </li>
            </ul>
          </div>
        </template>

        <!-- Contenido contextual -->
        <template v-else-if="currentArticle">
          <!-- Tabs -->
          <div v-if="hasFields" class="flex-shrink-0 flex border-b border-slate-100 px-3 pt-2 gap-1">
            <button
              type="button"
              :class="[
                'px-3 py-1.5 text-xs font-semibold rounded-t-lg border-b-2 transition-colors',
                activeTab === 'info'
                  ? 'border-indigo-500 text-indigo-700 bg-indigo-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              ]"
              @click="activeTab = 'info'"
            >
              Descripción
            </button>
            <button
              type="button"
              :class="[
                'px-3 py-1.5 text-xs font-semibold rounded-t-lg border-b-2 transition-colors',
                activeTab === 'fields'
                  ? 'border-indigo-500 text-indigo-700 bg-indigo-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              ]"
              @click="activeTab = 'fields'"
            >
              Campos ({{ currentArticle.fields!.length }})
            </button>
          </div>

          <div class="flex-1 overflow-y-auto">
            <!-- Tab: Info -->
            <template v-if="activeTab === 'info'">
              <div class="p-4 space-y-3">
                <!-- Descripción -->
                <div class="rounded-xl bg-indigo-50/70 border border-indigo-100 p-3">
                  <p class="text-[11px] font-bold uppercase tracking-wider text-indigo-500 mb-1">¿Qué es esta vista?</p>
                  <p class="text-xs text-slate-700 leading-relaxed">{{ currentArticle.description }}</p>
                </div>

                <!-- Importancia -->
                <div class="rounded-xl bg-violet-50/70 border border-violet-100 p-3">
                  <p class="text-[11px] font-bold uppercase tracking-wider text-violet-500 mb-1">¿Por qué es importante?</p>
                  <p class="text-xs text-slate-700 leading-relaxed">{{ currentArticle.importance }}</p>
                </div>

                <!-- Tips -->
                <div v-if="visibleTips.length > 0" class="rounded-xl bg-amber-50/70 border border-amber-100 p-3">
                  <p class="text-[11px] font-bold uppercase tracking-wider text-amber-600 mb-2 flex items-center gap-1">
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                    </svg>
                    Consejos
                  </p>
                  <ul class="space-y-1.5">
                    <li
                      v-for="(tip, i) in visibleTips"
                      :key="i"
                      class="flex items-start gap-1.5 text-xs text-slate-700"
                    >
                      <span class="mt-0.5 flex-shrink-0 w-3.5 h-3.5 rounded-full bg-amber-200 text-amber-700 text-[10px] font-bold flex items-center justify-center leading-none">{{ i + 1 }}</span>
                      <span class="leading-relaxed">{{ tip }}</span>
                    </li>
                  </ul>
                </div>

                <!-- Módulos relacionados -->
                <div v-if="currentArticle.relatedModules && currentArticle.relatedModules.length > 0">
                  <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Ver también</p>
                  <div class="flex flex-wrap gap-1.5">
                    <NuxtLink
                      v-for="mod in currentArticle.relatedModules"
                      :key="mod.route"
                      :to="mod.route"
                      class="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-indigo-100 hover:text-indigo-700 transition-colors"
                      @click="close"
                    >
                      {{ mod.label }}
                    </NuxtLink>
                  </div>
                </div>
              </div>
            </template>

            <!-- Tab: Campos -->
            <template v-else-if="activeTab === 'fields' && hasFields">
              <div class="p-4 space-y-2">
                <div
                  v-for="field in currentArticle.fields"
                  :key="field.label"
                  class="rounded-xl border border-slate-100 bg-slate-50/60 p-3"
                >
                  <div class="flex items-start justify-between gap-2 mb-1">
                    <p class="text-xs font-semibold text-slate-800 leading-snug">{{ field.label }}</p>
                    <div class="flex items-center gap-1 flex-shrink-0">
                      <span class="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-600 font-medium">
                        {{ fieldTypeLabel(field.type) }}
                      </span>
                      <span
                        v-if="field.required"
                        class="text-[10px] px-1.5 py-0.5 rounded-md bg-red-100 text-red-600 font-semibold"
                      >
                        Requerido
                      </span>
                    </div>
                  </div>
                  <p class="text-[11px] text-slate-600 leading-relaxed">{{ field.description }}</p>
                  <p v-if="field.tip" class="mt-1.5 text-[11px] text-indigo-600 leading-relaxed flex items-start gap-1">
                    <svg class="w-3 h-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                    </svg>
                    {{ field.tip }}
                  </p>
                </div>
              </div>
            </template>
          </div>
        </template>

        <!-- Sin artículo para la ruta actual -->
        <template v-else>
          <div class="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div class="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
              <svg class="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <p class="text-sm font-semibold text-slate-700 mb-1">Documentación no disponible</p>
            <p class="text-xs text-slate-500 leading-relaxed">
              No hay documentación específica para esta vista. Usa el buscador o explora el manual completo.
            </p>
          </div>
        </template>

        <!-- Footer -->
        <div class="flex-shrink-0 border-t border-slate-100 bg-slate-50/80 px-4 py-2.5">
          <button
            type="button"
            class="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-900 py-1 rounded-lg hover:bg-white transition-colors"
            @click="navigateToManual(currentArticle?.id)"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Ver manual completo
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </Transition>

    <!-- Botón flotante (mascota) -->
    <button
      type="button"
      :class="[
        'group relative flex items-center justify-center w-14 h-14 rounded-2xl shadow-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
        isOpen
          ? 'bg-white border-2 border-indigo-200 shadow-indigo-200/60'
          : 'bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 shadow-indigo-500/40 hover:shadow-indigo-500/60 hover:scale-105'
      ]"
      :title="isOpen ? 'Cerrar asistente' : 'Abrir asistente Flowbit'"
      @click="toggle"
    >
      <!-- Mascota SVG (modo cerrado) -->
      <Transition
        enter-active-class="transition duration-200"
        enter-from-class="opacity-0 scale-75 rotate-12"
        enter-to-class="opacity-100 scale-100 rotate-0"
        leave-active-class="transition duration-150"
        leave-from-class="opacity-100 scale-100 rotate-0"
        leave-to-class="opacity-0 scale-75 rotate-12"
        mode="out-in"
      >
        <!-- Icono cerrar (modo abierto) -->
        <svg v-if="isOpen" class="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
        </svg>

        <!-- Mascota robot (modo cerrado) -->
        <svg v-else viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-9 h-9">
          <!-- Antena -->
          <line x1="20" y1="3" x2="20" y2="8" stroke="white" stroke-width="1.8" stroke-linecap="round" />
          <circle cx="20" cy="2.5" r="2" fill="white" />

          <!-- Cabeza -->
          <rect x="7" y="8" width="26" height="18" rx="6" fill="rgba(255,255,255,0.9)" />

          <!-- Ojos -->
          <circle cx="14.5" cy="16" r="4" fill="white" />
          <circle cx="25.5" cy="16" r="4" fill="white" />
          <circle cx="14.5" cy="16" r="2.5" fill="#4f46e5" />
          <circle cx="25.5" cy="16" r="2.5" fill="#4f46e5" />
          <circle cx="15.2" cy="15" r="1" fill="white" />
          <circle cx="26.2" cy="15" r="1" fill="white" />

          <!-- Sonrisa -->
          <path d="M14.5 22.5 Q20 26 25.5 22.5" stroke="#4f46e5" stroke-width="1.8" fill="none" stroke-linecap="round" />

          <!-- Orejas -->
          <rect x="4" y="13" width="3" height="6" rx="1.5" fill="rgba(255,255,255,0.7)" />
          <rect x="33" y="13" width="3" height="6" rx="1.5" fill="rgba(255,255,255,0.7)" />

          <!-- Cuerpo -->
          <rect x="13" y="28" width="14" height="10" rx="4" fill="rgba(255,255,255,0.6)" />

          <!-- Botones cuerpo -->
          <circle cx="17" cy="33" r="1.5" fill="rgba(255,255,255,0.9)" />
          <circle cx="23" cy="33" r="1.5" fill="rgba(255,255,255,0.9)" />
        </svg>
      </Transition>

      <!-- Pulso animado cuando está cerrado -->
      <span
        v-if="!isOpen"
        class="absolute -top-1 -right-1 flex h-4 w-4"
      >
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-fuchsia-400 opacity-60" />
        <span class="relative inline-flex rounded-full h-4 w-4 bg-fuchsia-500" />
      </span>
    </button>
  </div>
</template>
