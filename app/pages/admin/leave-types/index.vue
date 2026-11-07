<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'

definePageMeta({ layout: 'admin' })

const columns: Column[] = [
  { key: 'name', label: 'Tipo de ausencia', type: 'text' },
  { key: 'kind', label: 'Clase', type: 'badge', badgeConfig: { labels: LEAVE_KIND_LABELS } },
  {
    key: 'balance',
    label: 'Saldo',
    type: 'badge',
    badgeConfig: { labels: { yes: 'Descuenta saldo', no: 'Sin saldo' }, colors: { yes: 'bg-indigo-100 text-indigo-700', no: 'bg-slate-100 text-slate-600' } }
  },
  { key: 'description', label: 'Descripción', type: 'text' }
]

const { selectedCompanyId, isSelectedCompanyAdmin } = storeToRefs(useAuthStore())
const { getTypes } = useLeave()
const { ensureDefaults } = useHrSettings()

const rows = ref<Record<string, unknown>[]>([])
const isLoading = ref(false)

const load = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) return
  isLoading.value = true
  try {
    let types = await getTypes(companyId)
    if (types.length === 0 && isSelectedCompanyAdmin.value && await ensureDefaults(companyId)) {
      types = await getTypes(companyId)
    }
    rows.value = types.map(t => ({
      id: t.id,
      name: t.name,
      kind: t.kind,
      balance: t.deducts_balance ? 'yes' : 'no',
      description: t.description ?? '—'
    }))
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, load, { immediate: true })
</script>

<template>
  <div class="w-full py-4">
    <HrNotice v-if="!selectedCompanyId" kind="no-company" />
    <HrNotice v-else-if="isLoading" kind="loading" message="Cargando tipos de ausencia…" />
    <Datatable
      v-else
      title="Tipos de ausencia"
      description="Vacaciones, permisos con y sin goce de sueldo e incapacidades. La clase define cómo afecta a la nómina."
      :data="rows"
      :columns="columns"
      :search-keys="['name']"
      :creatable="isSelectedCompanyAdmin"
      create-label="Nuevo tipo"
      export-filename="tipos-ausencia"
      @create="navigateTo('/admin/leave-types/create')"
      @row-click="row => navigateTo(`/admin/leave-types/${row.id}`)"
    />
  </div>
</template>
