<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { WebsiteCommentRow, WebsiteCommentStatus } from '~/types/website.types'

definePageMeta({ layout: 'admin' })

const authStore = useAuthStore()
const { selectedCompanyId, selectedCompany } = storeToRefs(authStore)
const { getAllByCompany, setStatus, remove } = useWebsiteComment()
const { getAllByCompany: getPosts } = useWebsitePost()

const comments = ref<WebsiteCommentRow[]>([])
const postTitles = ref<Record<string, { title: string; slug: string }>>({})
const filter = ref<WebsiteCommentStatus | 'all'>('pending')
const isLoading = ref(false)

const tabs: { id: WebsiteCommentStatus | 'all'; label: string }[] = [
  { id: 'pending', label: 'Pendientes' }, { id: 'approved', label: 'Aprobados' }, { id: 'spam', label: 'Spam' }, { id: 'rejected', label: 'Rechazados' }, { id: 'all', label: 'Todos' }
]

const load = async () => {
  const cid = selectedCompanyId.value
  if (!cid) return
  isLoading.value = true
  try {
    const [rows, posts] = await Promise.all([getAllByCompany(cid, filter.value), getPosts(cid)])
    comments.value = rows
    postTitles.value = Object.fromEntries(posts.map(p => [p.id, { title: p.title, slug: p.slug ?? '' }]))
  } finally {
    isLoading.value = false
  }
}

watch([selectedCompanyId, filter], load, { immediate: true })

const moderate = async (comment: WebsiteCommentRow, status: WebsiteCommentStatus) => {
  if (!selectedCompanyId.value) return
  if (await setStatus(comment.id, selectedCompanyId.value, status)) await load()
}

const erase = async (comment: WebsiteCommentRow) => {
  if (!selectedCompanyId.value) return
  if (await remove(comment.id, selectedCompanyId.value)) await load()
}

const STATUS_LABEL: Record<WebsiteCommentStatus, string> = { pending: 'Pendiente', approved: 'Aprobado', spam: 'Spam', rejected: 'Rechazado' }
const STATUS_VARIANT: Record<WebsiteCommentStatus, 'warning' | 'success' | 'danger' | 'secondary'> = { pending: 'warning', approved: 'success', spam: 'danger', rejected: 'secondary' }
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-slate-800">Comentarios</h1>
      <p class="text-slate-500 mt-1">Modera los comentarios de los lectores. Solo los aprobados se muestran en el blog.</p>
    </div>
    <div class="flex gap-1 overflow-x-auto rounded-2xl bg-white shadow-lg shadow-slate-200/50 p-1.5 w-fit">
      <button v-for="t in tabs" :key="t.id" type="button" :class="['px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap', filter === t.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-800']" @click="filter = t.id">{{ t.label }}</button>
    </div>
    <div v-if="isLoading" class="py-16 text-center text-slate-400">Cargando…</div>
    <div v-else-if="!comments.length" class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-12 text-center text-slate-400">No hay comentarios en esta bandeja.</div>
    <ul v-else class="space-y-3">
      <li v-for="comment in comments" :key="comment.id" class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-5">
        <div class="flex flex-wrap items-center gap-2 text-sm">
          <span class="font-semibold text-slate-800">{{ comment.author_name }}</span>
          <span v-if="comment.author_email" class="text-slate-400">{{ comment.author_email }}</span>
          <BadgeApp :label="STATUS_LABEL[comment.status]" :variant="STATUS_VARIANT[comment.status]" />
          <span class="text-xs text-slate-400 ml-auto">{{ formatWebsiteDateTime(comment.created_at) }}</span>
        </div>
        <p class="text-xs text-slate-500 mt-1">
          En:
          <NuxtLink v-if="selectedCompany?.slug && postTitles[comment.post_id]" :to="`${websitePath(selectedCompany.slug, `/blog/${postTitles[comment.post_id]?.slug}`)}?preview=1`" target="_blank" class="text-indigo-600 font-medium">{{ postTitles[comment.post_id]?.title }}</NuxtLink>
          <span v-else>{{ postTitles[comment.post_id]?.title ?? 'Publicación' }}</span>
          <span v-if="comment.parent_id"> · respuesta a otro comentario</span>
        </p>
        <p class="mt-3 text-sm text-slate-700 whitespace-pre-line leading-relaxed">{{ comment.body }}</p>
        <div class="mt-4 flex flex-wrap gap-2">
          <BtnApp v-if="comment.status !== 'approved'" label="Aprobar" size="sm" variant="success" @click="moderate(comment, 'approved')" />
          <BtnApp v-if="comment.status !== 'rejected'" label="Rechazar" size="sm" variant="secondary" @click="moderate(comment, 'rejected')" />
          <BtnApp v-if="comment.status !== 'spam'" label="Spam" size="sm" variant="ghost" @click="moderate(comment, 'spam')" />
          <BtnApp label="Eliminar" size="sm" variant="danger" @click="erase(comment)" />
        </div>
      </li>
    </ul>
  </div>
</template>
