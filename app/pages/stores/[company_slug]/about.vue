<script setup lang="ts">
import { storeToRefs } from 'pinia'

definePageMeta({ layout: 'storefront' })

const storefrontStore = useStorefrontStore()
const { store, primaryColor } = storeToRefs(storefrontStore)

const policies = computed(() => {
  if (!store.value) return []
  return [
    { id: 'envios', title: 'Política de envíos', content: store.value.policy_shipping },
    { id: 'devoluciones', title: 'Política de devoluciones', content: store.value.policy_returns },
    { id: 'privacidad', title: 'Aviso de privacidad', content: store.value.policy_privacy },
    { id: 'terminos', title: 'Términos y condiciones', content: store.value.policy_terms }
  ].filter((policy) => !!policy.content?.trim())
})

useHead(() => ({
  title: store.value ? `Nosotros — ${store.value.name}` : 'Nosotros',
  meta: [
    {
      name: 'description',
      content: store.value?.about_text?.slice(0, 160) ?? 'Conoce más sobre nuestra empresa.'
    }
  ]
}))
</script>

<template>
  <div v-if="store" class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
    <!-- Encabezado -->
    <div class="text-center mb-12">
      <img
        v-if="store.logo_url"
        :src="store.logo_url"
        :alt="`Logo de ${store.name}`"
        class="w-20 h-20 rounded-2xl object-cover shadow-lg shadow-slate-200/50 mx-auto mb-6"
      />
      <h1 class="text-3xl sm:text-4xl font-bold text-slate-900">{{ store.name }}</h1>
      <p v-if="store.description" class="mt-3 text-slate-500 max-w-2xl mx-auto">
        {{ store.description }}
      </p>
    </div>

    <!-- Quiénes somos -->
    <section v-if="store.about_text" class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6 sm:p-10 mb-8">
      <h2 class="text-xl font-bold text-slate-900 mb-4">Quiénes somos</h2>
      <p class="text-slate-600 leading-relaxed whitespace-pre-line">{{ store.about_text }}</p>
    </section>

    <!-- Contacto -->
    <section class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6 sm:p-10 mb-8">
      <h2 class="text-xl font-bold text-slate-900 mb-4">Contacto</h2>
      <ul class="space-y-3">
        <li v-if="store.contact_email" class="flex items-center gap-3 text-sm text-slate-600">
          <svg class="w-4 h-4 flex-shrink-0" :style="{ color: primaryColor }" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.9 5.3a2 2 0 002.2 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <a :href="`mailto:${store.contact_email}`" class="hover:text-slate-900 transition-colors">
            {{ store.contact_email }}
          </a>
        </li>
        <li v-if="store.contact_phone" class="flex items-center gap-3 text-sm text-slate-600">
          <svg class="w-4 h-4 flex-shrink-0" :style="{ color: primaryColor }" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.3a1 1 0 01.9.7l1.5 4.5a1 1 0 01-.5 1.2l-2.2 1.1a11 11 0 005.5 5.5l1.1-2.2a1 1 0 011.2-.5l4.5 1.5a1 1 0 01.7.9V19a2 2 0 01-2 2h-1C9.7 21 3 14.3 3 6V5z" />
          </svg>
          <a :href="`tel:${store.contact_phone}`" class="hover:text-slate-900 transition-colors">
            {{ store.contact_phone }}
          </a>
        </li>
        <li v-if="store.contact_address" class="flex items-center gap-3 text-sm text-slate-600">
          <svg class="w-4 h-4 flex-shrink-0" :style="{ color: primaryColor }" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.7 13.9L12 21l-5.7-7.1a7 7 0 1111.4 0zM15 10a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>{{ store.contact_address }}</span>
        </li>
        <li v-if="store.website" class="flex items-center gap-3 text-sm text-slate-600">
          <svg class="w-4 h-4 flex-shrink-0" :style="{ color: primaryColor }" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-9a17 17 0 010 18m0-18a17 17 0 000 18M3 12h18" />
          </svg>
          <a :href="store.website" target="_blank" rel="noopener" class="hover:text-slate-900 transition-colors">
            {{ store.website }}
          </a>
        </li>
      </ul>
    </section>

    <!-- Políticas -->
    <section v-if="policies.length" id="politicas" class="space-y-4 scroll-mt-24">
      <h2 class="text-xl font-bold text-slate-900">Políticas</h2>
      <details
        v-for="policy in policies"
        :key="policy.id"
        class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 overflow-hidden group"
      >
        <summary class="px-6 py-4 cursor-pointer select-none flex items-center justify-between text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors">
          {{ policy.title }}
          <svg class="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div class="px-6 pb-5 text-sm text-slate-600 leading-relaxed whitespace-pre-line border-t border-slate-100 pt-4">
          {{ policy.content }}
        </div>
      </details>
    </section>
  </div>
</template>
