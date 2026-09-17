<script lang="ts">
import type { WebsiteSocialLink } from '~/types/website.types'

export interface WebsiteAuthorFormData {
  display_name: string
  slug: string
  role_title: string
  bio: string
  avatar_url: string
  partner_id: string | null
  social_links: WebsiteSocialLink[]
  is_public: boolean
}

export const createEmptyWebsiteAuthorForm = (): WebsiteAuthorFormData => ({
  display_name: '',
  slug: '',
  role_title: '',
  bio: '',
  avatar_url: '',
  partner_id: null,
  social_links: [],
  is_public: true
})
</script>

<script setup lang="ts">
interface Props {
  readonly?: boolean
  companyId: string
  partnerOptions: { value: string; label: string }[]
}

withDefaults(defineProps<Props>(), { readonly: false })
const formData = defineModel<WebsiteAuthorFormData>({ required: true })
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <FormInput v-model="formData.display_name" label="Nombre público" :readonly="readonly" required size="md" />
      <FormInput v-model="formData.role_title" label="Cargo" placeholder="Ej: Directora de marketing" :readonly="readonly" size="md" />
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <FormSelect v-model="formData.partner_id" label="Miembro del equipo vinculado" :options="partnerOptions" placeholder="Sin vincular" clearable :disabled="readonly" size="md" />
      <FormInput v-model="formData.slug" label="URL (slug)" placeholder="Se genera del nombre" :readonly="readonly" size="md" />
    </div>
    <FormTextArea v-model="formData.bio" label="Biografía" :rows="4" :readonly="readonly" />
    <WebsiteImageField v-model="formData.avatar_url" label="Foto" :company-id="companyId" :readonly="readonly" aspect="square" />
    <WebsiteSocialLinksField v-model="formData.social_links" :readonly="readonly" />
    <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer select-none">
      <input v-model="formData.is_public" type="checkbox" :disabled="readonly" class="w-4 h-4 text-indigo-600 rounded border-slate-300" />
      <span class="text-sm text-slate-700">Perfil público (página de autor visible en el blog)</span>
    </label>
  </div>
</template>
