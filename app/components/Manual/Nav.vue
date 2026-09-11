<script setup lang="ts">
import type { DocArticle } from '~/composables/useManual'

interface Props {
  /** Artículo abierto actualmente, para resaltarlo y abrir su módulo. */
  activeId?: string
}

const props = withDefaults(defineProps<Props>(), { activeId: undefined })

const { modules, getArticleById } = useManual()
const { hydrate, favorites, isRead } = useManualProgress()

const expandedModules = ref<Set<string>>(new Set())

const favoriteArticles = computed(() =>
  favorites.value.map(id => getArticleById(id)).filter((a): a is DocArticle => Boolean(a))
)

const readCountByModule = (moduleId: string): number =>
  modules.value.find(m => m.id === moduleId)?.articles.filter(a => isRead(a.id)).length ?? 0

function toggleModule(moduleId: string) {
  if (expandedModules.value.has(moduleId)) expandedModules.value.delete(moduleId)
  else expandedModules.value.add(moduleId)
}

/** Abre el módulo del artículo activo; si no hay ninguno, los primeros del índice. */
function syncExpanded() {
  const article = props.activeId ? getArticleById(props.activeId) : undefined
  if (article) {
    expandedModules.value.add(article.module)
    return
  }
  if (expandedModules.value.size === 0) {
    expandedModules.value = new Set(['core', 'storefront', 'pos'])
  }
}

onMounted(() => {
  hydrate()
  syncExpanded()
})

watch(() => props.activeId, syncExpanded)
</script>

<template>
  <div class="rounded-2xl bg-white shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden lg:sticky lg:top-24">
    <NuxtLink
      to="/manual"
      :class="[
        'w-full flex items-center gap-2 px-4 py-3 text-left border-b border-slate-100 transition-colors',
        activeId ? 'hover:bg-slate-50 text-slate-600' : 'bg-indigo-50/60 text-indigo-700'
      ]"
    >
      <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
      <span class="text-sm font-bold">Inicio del manual</span>
    </NuxtLink>

    <nav class="overflow-y-auto max-h-[calc(100vh-16rem)]">
      <!-- Guardados -->
      <div v-if="favoriteArticles.length" class="border-b border-slate-100">
        <p class="px-4 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
          <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.539 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          Guardados
        </p>
        <ul class="pb-2">
          <li v-for="item in favoriteArticles" :key="item.id">
            <NuxtLink
              :to="`/manual/${item.id}`"
              :class="[
                'w-full flex items-center gap-2 px-4 py-1.5 text-left text-xs transition-colors',
                activeId === item.id ? 'text-indigo-700 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              ]"
            >
              <span class="flex-shrink-0">{{ item.moduleEmoji }}</span>
              <span class="truncate">{{ item.title }}</span>
            </NuxtLink>
          </li>
        </ul>
      </div>

      <!-- Módulos -->
      <div v-for="mod in modules" :key="mod.id" class="border-b border-slate-50 last:border-0">
        <button
          type="button"
          class="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
          @click="toggleModule(mod.id)"
        >
          <span class="flex items-center gap-2 min-w-0">
            <span class="text-base flex-shrink-0">{{ mod.emoji }}</span>
            <span class="text-sm font-semibold text-slate-700 truncate">{{ mod.label }}</span>
          </span>
          <span class="flex items-center gap-1.5 flex-shrink-0">
            <span class="text-[10px] font-semibold text-slate-400">
              {{ readCountByModule(mod.id) }}/{{ mod.articles.length }}
            </span>
            <svg
              :class="['w-4 h-4 text-slate-300 transition-transform duration-200', expandedModules.has(mod.id) ? 'rotate-90' : '']"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </button>

        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 -translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <ul v-if="expandedModules.has(mod.id)" class="bg-slate-50/60 border-t border-slate-100">
            <li v-for="article in mod.articles" :key="article.id">
              <NuxtLink
                :to="`/manual/${article.id}`"
                :class="[
                  'w-full flex items-center gap-2 px-5 py-2 text-left text-sm transition-colors',
                  activeId === article.id
                    ? 'bg-indigo-50 text-indigo-700 font-semibold border-l-2 border-indigo-500'
                    : 'text-slate-600 hover:bg-white hover:text-slate-800 border-l-2 border-transparent'
                ]"
              >
                <svg
                  v-if="isRead(article.id)"
                  class="w-3 h-3 text-emerald-500 flex-shrink-0"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                </svg>
                <span class="truncate flex-1">{{ article.title }}</span>
                <span v-if="article.wizard" class="flex-shrink-0 text-[9px] font-bold text-indigo-500">GUÍA</span>
                <span v-else-if="article.isNew" class="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-fuchsia-500" />
              </NuxtLink>
            </li>
          </ul>
        </Transition>
      </div>
    </nav>
  </div>
</template>
