<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'
import type { ApprovalManagerWithRelations } from '~/composables/useApprovalManager'

definePageMeta({
  layout: 'admin'
})

const columns: Column[] = [
  { key: 'partner_label', label: 'Partner', type: 'text', subtitleKey: 'user_state' },
  { key: 'category_scope_label', label: 'Ámbito de categorías', type: 'text' },
  {
    key: 'active_badge',
    label: 'Estado del registro',
    type: 'badge',
    badgeConfig: {
      labels: { activo: 'Activo', inactivo: 'Inactivo' }
    }
  }
]

const authStore = useAuthStore()
const { selectedCompanyId, companies } = storeToRefs(authStore)
const { getManagersByCompany } = useApprovalManager()

const isLoading = ref(false)
const raw = ref<ApprovalManagerWithRelations[]>([])

const isWorkspaceAdmin = computed(() => {
  const id = selectedCompanyId.value
  const r = companies.value.find(c => c.company.id === id)?.role
  return r === 'owner' || r === 'admin'
})

const mapRow = (m: ApprovalManagerWithRelations) => {
  const p = m.partner
  const name = (
    (p?.display_name ?? '').trim() ||
    (p?.name ?? '').trim() ||
    p?.email ||
    '—'
  )
  const hasUser = Boolean(p?.user_id)
  const catCount = m.approval_manager_category?.length ?? 0
  return {
    id: m.id,
    partner_label: name,
    user_state: hasUser ? 'Usuario vinculado' : 'Sin usuario (no podrá aprobar en la app)',
    category_scope_label: catCount === 0 ? 'Todas las categorías' : `${catCount} categoría(s) específica(s)`,
    active_badge: m.active ? 'activo' : 'inactivo'
  }
}

const rows = computed(() => raw.value.map(mapRow))

const load = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) {
    raw.value = []
    return
  }
  isLoading.value = true
  try {
    raw.value = await getManagersByCompany(companyId)
  } finally {
    isLoading.value = false
  }
}

watch(selectedCompanyId, load, { immediate: true })

const openCreate = () => navigateTo('/admin/approval-managers/create')

const edit = (row: Record<string, unknown>) =>
  navigateTo(`/admin/approval-managers/${row.id as string}`)
</script>

<template>
  <div class="w-full py-4 space-y-6">
    <div
      v-if="!selectedCompanyId"
      class="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900"
    >
      Selecciona una empresa para ver los gerentes autorizados a aprobar solicitudes.
    </div>

    <div
      v-else-if="!isWorkspaceAdmin"
      class="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-slate-700 shadow-lg shadow-slate-200/50"
    >
      Solo los administradores del espacio gestionan el registro de aprobadores.
    </div>

    <template v-else>
      <div
        v-if="isLoading"
        class="flex justify-center rounded-2xl border border-slate-100 bg-white py-16 text-slate-500 shadow-lg shadow-slate-200/50"
      >
        Cargando registros…
      </div>

      <Datatable
        v-else
        title="Gerentes / aprobadores"
        description="Partners con permiso formal para aceptar o rechazar solicitudes"
        :data="rows"
        :columns="columns"
        :search-keys="['partner_label']"
        :selectable="false"
        :exportable="true"
        export-filename="gerentes-aprobacion"
        empty-title="Sin aprobadores"
        empty-message="Registra a los partners que pueden operar como aprobadoras o aprobadores internos."
        :creatable="true"
        create-label="Nuevo aprobador"
        @create="openCreate"
      >
        <template #actions="{ row }">
          <BtnApp variant="ghost" size="sm" @click="edit(row)">
            <template #iconLeft>
              <svg class="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </template>
          </BtnApp>
        </template>
      </Datatable>
    </template>
  </div>
</template>
