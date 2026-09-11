<script setup lang="ts">
definePageMeta({ layout: 'manual' })

const route = useRoute()
const router = useRouter()
const config = useRuntimeConfig()

const { getArticleById, getArticleNeighbors } = useManual()
const { feedback } = useManualShare()

const articleId = computed(() => route.params.id as string)
const article = computed(() => getArticleById(articleId.value))

// El ancla del enlace compartido apunta a la sección concreta que se envió.
const initialSection = computed(() => route.hash.replace(/^#(section-)?/, '') || undefined)

const neighbors = computed(() => getArticleNeighbors(articleId.value))

if (!article.value) {
  throw createError({ statusCode: 404, statusMessage: 'Guía no encontrada', fatal: true })
}

const canonical = computed(() => `${config.public.siteUrl}/manual/${articleId.value}`)

useSeoMeta({
  title: () => `${article.value?.title} — Manual de Flowbit`,
  description: () => article.value?.summary ?? article.value?.description,
  ogTitle: () => `${article.value?.title} — Flowbit`,
  ogDescription: () => article.value?.summary ?? article.value?.description,
  ogUrl: () => canonical.value,
  ogType: 'article',
  twitterTitle: () => `${article.value?.title} — Flowbit`,
  twitterDescription: () => article.value?.summary ?? article.value?.description
})

useHead({
  link: [{ rel: 'canonical', href: canonical }]
})

function openArticle(id: string) {
  router.push(`/manual/${id}`)
}

function searchTag(term: string) {
  router.push({ path: '/manual', query: { q: term } })
}
</script>

<template>
  <div v-if="article" class="flex flex-col lg:flex-row gap-6">
    <!-- Aviso de copiado -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0"
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

    <!-- Menú lateral -->
    <aside class="lg:w-72 flex-shrink-0 print:hidden">
      <ManualNav :active-id="articleId" />
    </aside>

    <!-- Contenido -->
    <main class="flex-1 min-w-0 space-y-4">
      <nav class="flex items-center gap-1.5 text-xs text-slate-500 print:hidden">
        <NuxtLink to="/manual" class="hover:text-indigo-600 font-medium transition-colors">Manual</NuxtLink>
        <span class="text-slate-300">/</span>
        <span class="font-medium">{{ article.moduleLabel }}</span>
        <span class="text-slate-300">/</span>
        <span class="font-semibold text-slate-700 truncate">{{ article.title }}</span>
      </nav>

      <ManualArticleView
        :key="article.id"
        :article="article"
        :initial-section="initialSection"
        @select="openArticle"
        @search="searchTag"
      />

      <!-- Anterior / siguiente -->
      <div class="grid sm:grid-cols-2 gap-3 print:hidden">
        <NuxtLink
          v-if="neighbors.prev"
          :to="`/manual/${neighbors.prev.id}`"
          class="flex items-center gap-2.5 p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/40 transition-colors group"
        >
          <svg class="w-4 h-4 text-slate-400 group-hover:text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          <div class="min-w-0">
            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Anterior</p>
            <p class="text-xs font-semibold text-slate-700 group-hover:text-indigo-700 truncate">{{ neighbors.prev.title }}</p>
          </div>
        </NuxtLink>
        <div v-else class="hidden sm:block" />

        <NuxtLink
          v-if="neighbors.next"
          :to="`/manual/${neighbors.next.id}`"
          class="flex items-center justify-end gap-2.5 p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/40 transition-colors group text-right"
        >
          <div class="min-w-0">
            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Siguiente</p>
            <p class="text-xs font-semibold text-slate-700 group-hover:text-indigo-700 truncate">{{ neighbors.next.title }}</p>
          </div>
          <svg class="w-4 h-4 text-slate-400 group-hover:text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </NuxtLink>
      </div>

      <!-- Llamado a la acción: solo para quien aún no usa Flowbit -->
      <ManualGuestCta />
    </main>
  </div>
</template>
