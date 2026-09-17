<script setup lang="ts">
import type { WebsiteSocialLink } from '~/types/website.types'

interface Props {
  readonly?: boolean
  label?: string
}

withDefaults(defineProps<Props>(), { readonly: false, label: 'Redes sociales' })
const links = defineModel<WebsiteSocialLink[]>({ default: () => [] })

const add = () => {
  links.value = [...links.value, { network: 'facebook', url: '' }]
}

const remove = (index: number) => {
  links.value = links.value.filter((_, i) => i !== index)
}

const updateAt = (index: number, patch: Partial<WebsiteSocialLink>) => {
  links.value = links.value.map((link, i) => (i === index ? { ...link, ...patch } : link))
}

const networkOptions = SOCIAL_NETWORKS.map(n => ({ value: n.value, label: n.label }))
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-2">
      <p class="text-sm font-medium text-slate-700">{{ label }}</p>
      <button v-if="!readonly && links.length < 8" type="button" class="text-xs font-semibold text-indigo-600 hover:text-indigo-800" @click="add">+ Agregar red</button>
    </div>
    <div v-if="links.length" class="space-y-2">
      <div v-for="(link, index) in links" :key="index" class="grid grid-cols-[150px_1fr_auto] gap-2 items-center">
        <FormSelect :model-value="link.network" :options="networkOptions" :disabled="readonly" :searchable="false" size="sm" @update:model-value="updateAt(index, { network: String($event) })" />
        <FormInput :model-value="link.url" type="url" placeholder="https://…" :readonly="readonly" size="sm" @update:model-value="updateAt(index, { url: String($event) })" />
        <button v-if="!readonly" type="button" class="p-2 text-slate-400 hover:text-red-600" aria-label="Quitar" @click="remove(index)">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
    <p v-else class="text-xs text-slate-400">Sin redes sociales.</p>
  </div>
</template>
