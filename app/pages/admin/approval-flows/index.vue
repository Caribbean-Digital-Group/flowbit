<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'
import type { ApprovalCategoryRow, ApprovalFlowRow } from '~/types/approval.types'

definePageMeta({ layout: 'admin' })

const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)
const { getFlows } = useApprovalFlow()
const { getCategoriesByCompany } = useApprovalCategory()

const flows = ref<ApprovalFlowRow[]>([])
const categories = shallowRef<ApprovalCategoryRow[]>([])
const isLoading = ref(false)

const columns: Column[] = [
  { key: 'name', label: 'Flujo', subtitleKey: 'description', sortable: true },
  { key: 'categories_label', label: 'Categorías que lo usan' },
  { key: 'restart_label', label: 'Al reenviar' },
  { key: 'version', label: 'Versión', align: 'center' },
  { key: 'updated_at', label: 'Actualizado', type: 'date' }
]

const rows = computed(() => flows.value.map(f => ({
  ...f,
  description: f.description ?? '',
  categories_label: categories.value.filter(c => c.flow_id === f.id).map(c => c.name).join(', ') || 'Ninguna',
  restart_label: f.restart_from_first === null ? 'Ajuste de la empresa' : f.restart_from_first ? 'Desde el nivel 1' : 'Desde el nivel que devolvió'
})))

const load = async (): Promise<void> => {
  const cid = selectedCompanyId.value
  if (!cid) return
  isLoading.value = true
  try {
    const [f, c] = await Promise.all([getFlows(cid), getCategoriesByCompany(cid)])
    flows.value = f
    categories.value = c
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, load, { immediate: true })
</script>

<template>
  <div class="w-full space-y-6 py-4">
    <div v-if="isLoading" class="flex justify-center rounded-2xl border border-slate-100 bg-white py-16 text-slate-500 shadow-lg shadow-slate-200/50">
      Cargando flujos…
    </div>
    <Datatable
      v-else
      title="Flujos de aprobación"
      description="Niveles, aprobadores y condiciones. Una categoría sin flujo usa el modo simple: el solicitante elige a un aprobador."
      :data="rows"
      :columns="columns"
      :search-keys="['name', 'description', 'categories_label']"
      :creatable="true"
      create-label="Nuevo flujo"
      empty-title="Sin flujos"
      empty-message="Crea un flujo multinivel o carga los ejemplos desde Configuración."
      @create="navigateTo('/admin/approval-flows/create')"
      @row-click="(row) => navigateTo(`/admin/approval-flows/${row.id}`)"
    />
  </div>
</template>
