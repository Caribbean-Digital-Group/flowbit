<script setup lang="ts">
import { BRAND_NAME, BRAND_POSITIONING, FEATURE_MODULES, getFeatureModule, type FeatureModule } from '~/utils/features'
import { breadcrumbJsonLd, faqJsonLd, organizationJsonLd, serializeJsonLd } from '~/utils/seo'

definePageMeta({ layout: 'marketing' })

const route = useRoute()
const config = useRuntimeConfig()
const siteUrl = config.public.siteUrl as string
const { getArticleById } = useManual()

const slug = computed(() => route.params.slug as string)
const feature = computed(() => getFeatureModule(slug.value))

if (!feature.value) {
  throw createError({ statusCode: 404, statusMessage: 'Módulo no encontrado', fatal: true })
}

const canonical = computed(() => `${siteUrl}/funcionalidades/${slug.value}`)

const guides = computed(() =>
  (feature.value?.manualArticles ?? [])
    .map(id => getArticleById(id))
    .filter((article): article is NonNullable<typeof article> => Boolean(article))
)

const relatedModules = computed(() =>
  (feature.value?.related ?? [])
    .map(relatedSlug => getFeatureModule(relatedSlug))
    .filter((module): module is FeatureModule => Boolean(module))
)

useSeoMeta({
  title: () => feature.value?.seoTitle,
  description: () => feature.value?.seoDescription,
  keywords: () => feature.value?.keywords.join(', '),
  ogTitle: () => feature.value?.seoTitle,
  ogDescription: () => feature.value?.seoDescription,
  ogUrl: () => canonical.value,
  twitterTitle: () => feature.value?.seoTitle,
  twitterDescription: () => feature.value?.seoDescription
})

useHead({
  link: [{ rel: 'canonical', href: canonical }],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: computed(() => {
        const module = feature.value
        if (!module) return ''
        return serializeJsonLd([
          organizationJsonLd(siteUrl),
          breadcrumbJsonLd(siteUrl, [
            { name: 'Inicio', path: '/' },
            { name: 'Funcionalidades', path: '/funcionalidades' },
            { name: module.name, path: `/funcionalidades/${module.slug}` }
          ]),
          {
            '@type': 'SoftwareApplication',
            '@id': `${canonical.value}#software`,
            name: `${BRAND_NAME} — ${module.name}`,
            description: module.seoDescription,
            url: canonical.value,
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            inLanguage: 'es-MX',
            areaServed: { '@type': 'Country', name: 'México' },
            availableLanguage: 'es',
            isAccessibleForFree: true,
            license: 'https://opensource.org/licenses/MIT',
            featureList: module.features.map(item => item.title),
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'MXN' },
            publisher: { '@id': `${siteUrl}/#organization` }
          },
          faqJsonLd(module.faqs)
        ])
      })
    }
  ]
})

const otherModules = computed(() => FEATURE_MODULES.filter(module => module.slug !== slug.value))
</script>

<template>
  <div v-if="feature">
    <!-- Hero -->
    <section class="relative overflow-hidden bg-slate-950">
      <div class="absolute inset-0 pointer-events-none">
        <div class="absolute -top-20 -left-40 w-[500px] h-[500px] bg-indigo-600/25 rounded-full blur-[120px]"></div>
        <div class="absolute top-10 right-0 w-[420px] h-[420px] bg-fuchsia-600/20 rounded-full blur-[120px]"></div>
      </div>
      <div class="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <nav aria-label="Migas de pan" class="mb-8 text-xs text-slate-400">
          <NuxtLink to="/" class="hover:text-white transition-colors">Inicio</NuxtLink>
          <span class="mx-1.5 text-slate-600">/</span>
          <NuxtLink to="/funcionalidades" class="hover:text-white transition-colors">Funcionalidades</NuxtLink>
          <span class="mx-1.5 text-slate-600">/</span>
          <span class="text-slate-300">{{ feature.name }}</span>
        </nav>

        <div :class="['inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br items-center justify-center text-white shadow-xl mb-6', feature.gradient]">
          <FeatureIcon :icon="feature.icon" icon-class="w-7 h-7" />
        </div>
        <h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-tight mb-6">
          {{ feature.headline }}
        </h1>
        <p class="text-lg sm:text-xl text-slate-400 max-w-3xl leading-relaxed mb-10">
          {{ feature.intro }}
        </p>
        <div class="flex flex-col sm:flex-row gap-3">
          <NuxtLink
            to="/?registro=1"
            class="inline-flex items-center justify-center px-7 py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-500 via-violet-600 to-fuchsia-600 shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 transition-shadow"
          >
            Probar {{ feature.name }} gratis
          </NuxtLink>
          <a
            href="#funcionalidades"
            class="inline-flex items-center justify-center px-7 py-3.5 rounded-xl font-medium text-slate-200 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
          >
            Ver funcionalidades
          </a>
        </div>
        <p class="mt-6 text-sm text-slate-500">{{ BRAND_NAME }} · {{ BRAND_POSITIONING }} · Gratis y sin límite de usuarios</p>
      </div>
    </section>

    <!-- Beneficios -->
    <section class="bg-white px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
      <div class="max-w-7xl mx-auto">
        <h2 class="text-3xl sm:text-4xl font-bold text-slate-800 tracking-tight mb-10 max-w-3xl">
          Beneficios de usar {{ feature.name }} en Flowbit
        </h2>
        <div class="grid gap-5 md:grid-cols-3">
          <div
            v-for="benefit in feature.benefits"
            :key="benefit.title"
            class="rounded-2xl p-7 bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50 border border-indigo-100"
          >
            <svg class="w-7 h-7 text-indigo-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 class="text-lg font-bold text-slate-800 mb-2">{{ benefit.title }}</h3>
            <p class="text-sm text-slate-500 leading-relaxed">{{ benefit.description }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Hecho para México -->
    <section class="bg-white px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
      <div class="max-w-7xl mx-auto">
        <div class="flex flex-col md:flex-row md:items-center gap-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 sm:p-8">
          <span class="inline-flex self-start items-center px-3 py-1 rounded-full bg-white border border-emerald-200 text-xs font-bold uppercase tracking-wider text-emerald-700 flex-shrink-0">
            Hecho para México
          </span>
          <div>
            <h2 class="text-lg font-bold text-slate-800 mb-1">{{ feature.name }} pensado para empresas mexicanas</h2>
            <p class="text-slate-600 leading-relaxed">{{ feature.mexico }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Funcionalidades -->
    <section id="funcionalidades" class="bg-slate-50 px-4 sm:px-6 lg:px-8 py-16 sm:py-20 scroll-mt-20">
      <div class="max-w-7xl mx-auto">
        <h2 class="text-3xl sm:text-4xl font-bold text-slate-800 tracking-tight mb-10 max-w-3xl">
          Funcionalidades principales
        </h2>
        <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="item in feature.features"
            :key="item.title"
            class="bg-white rounded-2xl p-6 shadow-lg shadow-slate-200/50 border border-slate-100"
          >
            <h3 class="text-base font-bold text-slate-800 mb-2">{{ item.title }}</h3>
            <p class="text-sm text-slate-500 leading-relaxed">{{ item.description }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Para quién -->
    <section class="bg-white px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
      <div class="max-w-7xl mx-auto grid gap-10 lg:grid-cols-2">
        <div>
          <h2 class="text-3xl font-bold text-slate-800 tracking-tight mb-6">¿Para quién es?</h2>
          <ul class="space-y-4">
            <li v-for="useCase in feature.useCases" :key="useCase" class="flex gap-3">
              <svg class="w-5 h-5 flex-shrink-0 mt-0.5 text-fuchsia-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
              </svg>
              <span class="text-slate-600 leading-relaxed">{{ useCase }}</span>
            </li>
          </ul>
        </div>

        <div v-if="guides.length > 0">
          <h2 class="text-3xl font-bold text-slate-800 tracking-tight mb-6">Guías paso a paso</h2>
          <ul class="space-y-3">
            <li v-for="guide in guides" :key="guide.id">
              <NuxtLink
                :to="`/manual/${guide.id}`"
                class="group flex items-start gap-3 rounded-2xl border border-slate-200 p-4 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors"
              >
                <svg class="w-5 h-5 flex-shrink-0 mt-0.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span>
                  <span class="block font-semibold text-slate-800 group-hover:text-indigo-700">{{ guide.title }}</span>
                  <span class="block text-sm text-slate-500">{{ guide.summary ?? guide.description }}</span>
                </span>
              </NuxtLink>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section class="bg-slate-50 px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
      <div class="max-w-3xl mx-auto">
        <h2 class="text-3xl sm:text-4xl font-bold text-slate-800 tracking-tight mb-8 text-center">
          Preguntas frecuentes sobre {{ feature.name }}
        </h2>
        <FeatureFaqList :faqs="feature.faqs" />
      </div>
    </section>

    <!-- Relacionados -->
    <section class="bg-white px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20">
      <div class="max-w-7xl mx-auto">
        <h2 class="text-2xl font-bold text-slate-800 tracking-tight mb-6">Se integra con</h2>
        <div class="grid gap-5 sm:grid-cols-3">
          <NuxtLink
            v-for="module in relatedModules"
            :key="module.slug"
            :to="`/funcionalidades/${module.slug}`"
            class="group flex items-start gap-4 rounded-2xl border border-slate-200 p-5 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-500/10 transition-all"
          >
            <div :class="['w-10 h-10 flex-shrink-0 rounded-xl bg-gradient-to-br flex items-center justify-center text-white', module.gradient]">
              <FeatureIcon :icon="module.icon" icon-class="w-5 h-5" />
            </div>
            <span>
              <span class="block font-semibold text-slate-800 group-hover:text-indigo-700">{{ module.name }}</span>
              <span class="block text-sm text-slate-500">{{ module.tagline }}</span>
            </span>
          </NuxtLink>
        </div>
        <p class="mt-8 text-sm text-slate-500">
          Otros módulos:
          <template v-for="(module, index) in otherModules" :key="module.slug">
            <NuxtLink :to="`/funcionalidades/${module.slug}`" class="font-medium text-indigo-600 hover:text-indigo-800">{{ module.name }}</NuxtLink><span v-if="index < otherModules.length - 1"> · </span>
          </template>
        </p>
      </div>
    </section>

    <FeatureCta
      :title="`Empieza a usar ${feature.name} hoy, gratis`"
      description="Crea tu cuenta en menos de 2 minutos. Todos los módulos y usuarios están incluidos, sin tarjeta de crédito."
    />
  </div>
</template>
