<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { createEmptyWebsiteRedirectForm, type WebsiteRedirectFormData } from '~/components/WebsiteRedirect/Form.vue'
import type { WebsiteRedirectRow } from '~/types/website.types'

definePageMeta({ layout: 'admin' })

const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getAllByCompany, create, archive, lastError } = useWebsiteRedirect()

const redirects = ref<WebsiteRedirectRow[]>([])
const formData = ref<WebsiteRedirectFormData>(createEmptyWebsiteRedirectForm())
const isLoading = ref(false)
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)

const load = async () => {
  const cid = selectedCompanyId.value
  if (!cid) return
  isLoading.value = true
  try { redirects.value = await getAllByCompany(cid) } finally { isLoading.value = false }
}

watch(selectedCompanyId, load, { immediate: true })

const add = async () => {
  const cid = selectedCompanyId.value
  if (!cid) return
  const from = formData.value.from_path.trim()
  const to = formData.value.to_path.trim()
  if (!from.startsWith('/')) { errorMessage.value = 'La ruta antigua debe empezar con /.'; return }
  if (!to || (!to.startsWith('/') && !/^https?:\/\//i.test(to))) { errorMessage.value = 'El destino debe ser una ruta (/nueva) o una URL completa.'; return }
  if (from === to) { errorMessage.value = 'Origen y destino no pueden ser iguales.'; return }
  errorMessage.value = null
  isSaving.value = true
  try {
    const created = await create({ company_id: cid, from_path: from, to_path: to, status_code: formData.value.status_code })
    if (!created) { errorMessage.value = lastError.value ?? 'No se pudo crear.'; return }
    formData.value = createEmptyWebsiteRedirectForm()
    await load()
  } finally {
    isSaving.value = false
  }
}

const remove = async (r: WebsiteRedirectRow) => {
  if (!selectedCompanyId.value) return
  if (await archive(r.id, selectedCompanyId.value)) await load()
  else errorMessage.value = lastError.value ?? 'Solo los administradores pueden eliminar redirecciones.'
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-slate-800">Redirecciones</h1>
      <p class="text-slate-500 mt-1">Rutas antiguas que llevan a rutas nuevas. Al cambiar el slug de una página o post publicado se crea una automáticamente.</p>
    </div>
    <div v-if="errorMessage" class="rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700">{{ errorMessage }}</div>
    <section class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6">
      <h2 class="text-base font-bold text-slate-800 mb-4">Nueva redirección</h2>
      <WebsiteRedirectForm v-model="formData" />
      <BtnApp label="Agregar" size="md" class="mt-4" :loading="isSaving" @click="add" />
    </section>
    <section class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr><th class="text-left px-5 py-3">Desde</th><th class="text-left px-5 py-3">Hacia</th><th class="px-5 py-3">Código</th><th class="px-5 py-3">Usos</th><th class="px-5 py-3">Origen</th><th class="px-5 py-3" /></tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="isLoading"><td colspan="6" class="px-5 py-10 text-center text-slate-400">Cargando…</td></tr>
          <tr v-else-if="!redirects.length"><td colspan="6" class="px-5 py-10 text-center text-slate-400">No hay redirecciones.</td></tr>
          <tr v-for="r in redirects" :key="r.id">
            <td class="px-5 py-3 font-mono text-xs text-slate-700">{{ r.from_path }}</td>
            <td class="px-5 py-3 font-mono text-xs text-slate-700">{{ r.to_path }}</td>
            <td class="px-5 py-3 text-center">{{ r.status_code }}</td>
            <td class="px-5 py-3 text-center">{{ r.hits }}</td>
            <td class="px-5 py-3 text-center text-xs text-slate-500">{{ r.is_automatic ? 'Automática' : 'Manual' }}</td>
            <td class="px-5 py-3 text-right"><button type="button" class="text-xs font-semibold text-red-500 hover:text-red-700" @click="remove(r)">Eliminar</button></td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
