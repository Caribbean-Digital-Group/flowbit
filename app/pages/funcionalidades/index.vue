<script setup lang="ts">
import { BRAND_NAME, FEATURE_CATEGORIES, FEATURE_MODULES, PLATFORM_FAQS } from '~/utils/features'
import { breadcrumbJsonLd, faqJsonLd, organizationJsonLd, serializeJsonLd } from '~/utils/seo'

definePageMeta({ layout: 'marketing' })

const config = useRuntimeConfig()
const siteUrl = config.public.siteUrl as string
const canonical = `${siteUrl}/funcionalidades`

const pageTitle = `Módulos del ERP open source para México | ${BRAND_NAME}`
const pageDescription = `Los ${FEATURE_MODULES.length} módulos de Flowbit, el ERP open source en español para México: nómina, CRM, punto de venta, inventario, tienda y RR. HH.`

useSeoMeta({
  title: pageTitle,
  description: pageDescription,
  ogTitle: pageTitle,
  ogDescription: pageDescription,
  ogUrl: canonical,
  twitterTitle: pageTitle,
  twitterDescription: pageDescription
})

useHead({
  link: [{ rel: 'canonical', href: canonical }],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: serializeJsonLd([
        organizationJsonLd(siteUrl),
        breadcrumbJsonLd(siteUrl, [
          { name: 'Inicio', path: '/' },
          { name: 'Funcionalidades', path: '/funcionalidades' }
        ]),
        {
          '@type': 'ItemList',
          name: `Módulos de ${BRAND_NAME}`,
          itemListElement: FEATURE_MODULES.map((module, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: module.name,
            url: `${siteUrl}/funcionalidades/${module.slug}`
          }))
        },
        faqJsonLd(PLATFORM_FAQS)
      ])
    }
  ]
})

const groups = FEATURE_CATEGORIES
  .map(category => ({ category, modules: FEATURE_MODULES.filter(module => module.category === category) }))
  .filter(group => group.modules.length > 0)
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="relative overflow-hidden bg-slate-950">
      <div class="absolute inset-0 pointer-events-none">
        <div class="absolute -top-20 -left-40 w-[500px] h-[500px] bg-indigo-600/25 rounded-full blur-[120px]"></div>
        <div class="absolute top-10 right-0 w-[420px] h-[420px] bg-fuchsia-600/20 rounded-full blur-[120px]"></div>
      </div>
      <div class="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
        <nav aria-label="Migas de pan" class="mb-6 text-xs text-slate-400">
          <NuxtLink to="/" class="hover:text-white transition-colors">Inicio</NuxtLink>
          <span class="mx-1.5 text-slate-600">/</span>
          <span class="text-slate-300">Funcionalidades</span>
        </nav>
        <h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-tight mb-6">
          Todo lo que tu empresa necesita,
          <span class="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300">en un ERP open source hecho para México</span>
        </h1>
        <p class="text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed">
          Flowbit ERP reúne {{ FEATURE_MODULES.length }} módulos en español que comparten los mismos datos: lo que capturas
          en un lugar aparece en todos los demás. Con nómina mexicana, IVA y datos del SAT incluidos, sin licencias
          y sin límite de usuarios.
        </p>
      </div>
    </section>

    <!-- Módulos por categoría -->
    <section class="bg-white px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
      <div class="max-w-7xl mx-auto space-y-14">
        <div v-for="group in groups" :key="group.category">
          <h2 class="text-sm font-bold uppercase tracking-wider text-indigo-600 mb-5">{{ group.category }}</h2>
          <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <NuxtLink
              v-for="module in group.modules"
              :key="module.slug"
              :to="`/funcionalidades/${module.slug}`"
              class="group relative flex flex-col bg-white rounded-2xl p-6 border border-slate-200 shadow-lg shadow-slate-200/50 hover:border-indigo-300 hover:shadow-indigo-500/15 transition-all"
            >
              <div :class="['w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shadow-lg mb-4', module.gradient]">
                <FeatureIcon :icon="module.icon" />
              </div>
              <h3 class="text-lg font-bold text-slate-800 mb-1.5">{{ module.name }}</h3>
              <p class="text-sm text-slate-500 leading-relaxed flex-1">{{ module.tagline }}</p>
              <span class="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 group-hover:gap-2 transition-all">
                Ver funcionalidades
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section class="bg-slate-50 px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
      <div class="max-w-3xl mx-auto">
        <h2 class="text-3xl sm:text-4xl font-bold text-slate-800 tracking-tight mb-8 text-center">Preguntas frecuentes</h2>
        <FeatureFaqList :faqs="PLATFORM_FAQS" />
      </div>
    </section>

    <FeatureCta />
  </div>
</template>
