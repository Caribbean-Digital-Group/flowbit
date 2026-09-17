<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { WebsiteTagRow } from '~/types/website.types'

definePageMeta({ layout: 'admin' })

const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getAllByCompany, create, update, archive, getUsage, lastError } = useWebsiteTag()

const tags = ref<WebsiteTagRow[]>([])
const usage = ref<Record<string, number>>({})
const newName = ref('')
const editingId = ref<string | null>(null)
const editingName = ref('')
const errorMessage = ref<string | null>(null)
const isLoading = ref(false)

const load = async () => {
  const cid = selectedCompanyId.value
  if (!cid) return
  isLoading.value = true
  try {
    ;[tags.value, usage.value] = await Promise.all([getAllByCompany(cid), getUsage(cid)])
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, load, { immediate: true })

const add = async () => {
  const cid = selectedCompanyId.value
  if (!cid || !newName.value.trim()) return
  errorMessage.value = null
  const created = await create(cid, newName.value)
  if (!created) { errorMessage.value = lastError.value ?? 'No se pudo crear.'; return }
  newName.value = ''
  await load()
}

const startEdit = (tag: WebsiteTagRow) => { editingId.value = tag.id; editingName.value = tag.name }
const saveEdit = async () => {
  const cid = selectedCompanyId.value
  if (!cid || !editingId.value || !editingName.value.trim()) return
  const ok = await update(editingId.value, cid, { name: editingName.value.trim().slice(0, 60) })
  if (!ok) { errorMessage.value = lastError.value ?? 'No se pudo guardar.'; return }
  editingId.value = null
  await load()
}
const remove = async (tag: WebsiteTagRow) => {
  const cid = selectedCompanyId.value
  if (!cid) return
  if (await archive(tag.id, cid)) await load()
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-slate-800">Etiquetas</h1>
      <p class="text-slate-500 mt-1">Palabras clave transversales a las categorías. También se crean al vuelo desde el editor de posts.</p>
    </div>
    <div v-if="errorMessage" class="rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700">{{ errorMessage }}</div>
    <div class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6">
      <form class="flex gap-3 mb-6" @submit.prevent="add">
        <FormInput v-model="newName" placeholder="Nueva etiqueta" :maxlength="60" size="md" class="flex-1" />
        <BtnApp label="Agregar" type="submit" size="md" />
      </form>
      <p v-if="isLoading" class="text-sm text-slate-400">Cargando…</p>
      <ul v-else-if="tags.length" class="divide-y divide-slate-100">
        <li v-for="tag in tags" :key="tag.id" class="flex items-center gap-4 py-3">
          <template v-if="editingId === tag.id">
            <FormInput v-model="editingName" size="sm" class="flex-1" @keydown.enter.prevent="saveEdit" />
            <button type="button" class="text-xs font-semibold text-indigo-600" @click="saveEdit">Guardar</button>
            <button type="button" class="text-xs font-medium text-slate-500" @click="editingId = null">Cancelar</button>
          </template>
          <template v-else>
            <span class="inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 px-3 py-1 text-sm font-semibold">#{{ tag.name }}</span>
            <span class="text-xs text-slate-400">/blog/etiqueta/{{ tag.slug }}</span>
            <span class="ml-auto text-xs text-slate-500">{{ usage[tag.id] ?? 0 }} post{{ (usage[tag.id] ?? 0) === 1 ? '' : 's' }}</span>
            <button type="button" class="text-xs font-semibold text-indigo-600 hover:text-indigo-800" @click="startEdit(tag)">Renombrar</button>
            <button type="button" class="text-xs font-semibold text-red-500 hover:text-red-700" @click="remove(tag)">Archivar</button>
          </template>
        </li>
      </ul>
      <p v-else class="text-sm text-slate-400 text-center py-8">Aún no hay etiquetas.</p>
    </div>
  </div>
</template>
