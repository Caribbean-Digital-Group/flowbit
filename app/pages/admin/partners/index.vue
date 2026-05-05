<script setup lang="ts">
definePageMeta({
  layout: 'admin'
})

import { storeToRefs } from 'pinia'
import type { Column } from '~/components/Datatable.vue'
import type { Tables } from '~/types/database.types'

type PartnerRow = Tables<'partner'>

const columns: Column[] = [
  {
    key: 'name',
    label: 'Cliente',
    type: 'avatar',
    subtitleKey: 'email',
    avatarKey: 'avatar_url'
  },
  {
    key: 'tipo',
    label: 'Tipo',
    type: 'text'
  },
  {
    key: 'status',
    label: 'Estado',
    type: 'badge',
    badgeConfig: {
      labels: { active: 'Activo', inactive: 'Inactivo' }
    }
  },
  { key: 'phone', label: 'Teléfono', type: 'text' },
  { key: 'created_at', label: 'Alta', type: 'date' }
]

const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)

const { getPartnersByCompany, archivePartner } = usePartner()

const partners = ref<Record<string, unknown>[]>([])
const isLoadingPartners = ref(false)

function mapPartnerToTableRow(raw: PartnerRow): Record<string, unknown> {
  const displayName = raw.display_name?.trim() || raw.name
  return {
    id: raw.id,
    name: displayName,
    email: raw.email ?? '',
    avatar_url: raw.avatar_url ?? '',
    tipo: raw.company_type === 'company' ? 'Empresa' : 'Persona',
    status: raw.active === false ? 'inactive' : 'active',
    phone: raw.phone?.trim() ? raw.phone : '—',
    created_at: raw.created_at ?? ''
  }
}

const loadPartners = async () => {
  const companyId = selectedCompanyId.value
  if (!companyId) {
    partners.value = []
    return
  }

  isLoadingPartners.value = true
  try {
    const list = await getPartnersByCompany(companyId)
    partners.value = list.map(mapPartnerToTableRow)
  } finally {
    isLoadingPartners.value = false
  }
}

watch(
  selectedCompanyId,
  () => {
    loadPartners()
  },
  { immediate: true }
)

const edit = (row: Record<string, unknown>) => {
  navigateTo(`/admin/partners/${row.id as string}`)
}

const remove = async (row: Record<string, unknown>) => {
  const id = row.id as string
  const ok = await archivePartner(id)
  if (ok) {
    await loadPartners()
  }
}

const deleteMany = async (selected: Record<string, unknown>[]) => {
  for (const row of selected) {
    await archivePartner(row.id as string)
  }
  await loadPartners()
}

const createPartner = () => {
  navigateTo('/admin/partners/create')
}
</script>
<template>
  <div class="w-full py-4">
    <div
      v-if="!selectedCompanyId"
      class="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-4 text-amber-900"
    >
      <p class="font-semibold">
        Sin empresa seleccionada
      </p>
      <p class="mt-1 text-sm text-amber-800/90">
        Elige una empresa en el selector del panel superior para ver sus socios y clientes.
      </p>
    </div>

    <div
      v-else-if="isLoadingPartners"
      class="flex justify-center rounded-2xl border border-slate-100 bg-white py-16 text-slate-500 shadow-lg shadow-slate-200/50"
    >
      Cargando socios…
    </div>

    <Datatable
      v-else
      title="Clientes"
      description="Socios vinculados a la empresa seleccionada"
      :data="partners"
      :columns="columns"
      :search-keys="['name', 'email', 'phone', 'tipo']"
      :selectable="true"
      :exportable="true"
      :creatable="true"
      create-label="Nuevo Cliente"
      export-filename="clientes"
      empty-title="Sin socios"
      empty-message="No hay socios asociados a esta empresa o aún no se han registrado."
      @create="createPartner"
    >
      <!-- Acciones personalizadas por fila -->
      <template #actions="{ row }">
        <div class="flex items-center justify-center gap-2">
          <BtnApp variant="ghost" size="sm" @click="edit(row)">
            <template #iconLeft>
              <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </template>
          </BtnApp>
          <BtnApp variant="ghost" size="sm" @click="remove(row)">
            <template #iconLeft>
              <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </template>
          </BtnApp>
        </div>
      </template>

      <!-- Acciones en lote -->
      <template #bulkActions="{ selected }">
        <BtnDelete @click="deleteMany(selected)" />
      </template>
    </Datatable>
  </div>
</template>
