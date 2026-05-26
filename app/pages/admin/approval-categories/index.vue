<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'
import type { Tables } from '~/types/database.types'

definePageMeta({
  layout: 'admin'
})

type Row = Tables<'approval_category'>

const columns: Column[] = [
  { key: 'name', label: 'Categoría', type: 'text', subtitleKey: 'internal_code' },
  { key: 'stateBadges', label: 'Estados', type: 'text' },
  { key: 'description', label: 'Descripción', type: 'text' }
]

const authStore = useAuthStore()
const { selectedCompanyId, companies } = storeToRefs(authStore)

const { getCategoriesByCompany } = useApprovalCategory()

const isLoading = ref(false)
const raw = ref<Row[]>([])

const isWorkspaceAdmin = computed(() => {
  const id = selectedCompanyId.value
  const r = companies.value.find(c => c.company.id === id)?.role
  return r === 'owner' || r === 'admin'
})

const badgeText = (c: Row) => {
  const parts: string[] = []
  if (!c.active) parts.push('Inactiva')
  if (c.archived) parts.push('Archivada')
  if (parts.length === 0) parts.push('Vigente')
  return parts.join(' · ')
}

const tableRows = computed(() =>
  raw.value.map(x => ({
    id: x.id,
    name: x.name ?? '—',
    internal_code: x.internal_code ?? '—',
    description: x.description?.trim() || '—',
    stateBadges: badgeText(x)
  }))
)

const load = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) {
    raw.value = []
    return
  }
  isLoading.value = true
  try {
    raw.value = await getCategoriesByCompany(companyId, { includeArchived: true })
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, load, { immediate: true })

const openCreate = () => navigateTo('/admin/approval-categories/create')

const edit = (row: Record<string, unknown>) =>
  navigateTo(`/admin/approval-categories/${row.id as string}`)
</script>

<template>
  <div class="w-full py-4 space-y-6">
    <div
      v-if="!selectedCompanyId"
      class="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900"
    >
      <p class="font-semibold">
        Sin empresa seleccionada
      </p>
      <p class="mt-1 text-sm text-amber-800/90">
        Elige una empresa en el panel superior para administrar las categorías de aprobación.
      </p>
    </div>

    <div
      v-else-if="!isWorkspaceAdmin"
      class="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-slate-700 shadow-lg shadow-slate-200/50"
    >
      <p class="font-semibold text-slate-900">
        Acceso restringido
      </p>
      <p class="mt-1 text-sm">
        Solo un administrador del espacio puede gestionar el catálogo de categorías de aprobación.
      </p>
    </div>

    <template v-else>
      <div
        v-if="isLoading"
        class="flex justify-center rounded-2xl border border-slate-100 bg-white py-16 text-slate-500 shadow-lg shadow-slate-200/50"
      >
        Cargando categorías…
      </div>

      <Datatable
        v-else
        title="Categorías de aprobación"
        description="Define los tipos de solicitud formal disponibles para tu organización."
        :data="tableRows"
        :columns="columns"
        :search-keys="['name', 'internal_code', 'description']"
        :selectable="false"
        :exportable="true"
        :creatable="isWorkspaceAdmin"
        create-label="Nueva categoría"
        export-filename="categorias-aprobacion"
        empty-title="Sin categorías"
        empty-message="Aún no existen registros aquí para esta empresa."
        @create="openCreate"
      >
        <template #actions="{ row }">
          <div class="flex justify-center gap-2">
            <BtnApp variant="ghost" size="sm" @click="edit(row)">
              <template #iconLeft>
                <svg class="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </template>
            </BtnApp>
          </div>
        </template>
      </Datatable>
    </template>
  </div>
</template>
