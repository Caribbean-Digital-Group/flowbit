<script setup lang="ts">
definePageMeta({
  layout: 'admin'
})

import type { Column } from '~/components/Datatable.vue'

const columns: Column[] = [
  { 
    key: 'name', 
    label: 'Cliente', 
    type: 'avatar', 
    subtitleKey: 'email' 
  },
  { 
    key: 'status', 
    label: 'Estado', 
    type: 'badge',
    badgeConfig: {
      labels: { active: 'Activo', inactive: 'Inactivo' }
    }
  },
  { key: 'total', label: 'Total', type: 'currency' },
  { key: 'progress', label: 'Progreso', type: 'progress' },
  { key: 'created_at', label: 'Fecha', type: 'date' }
]

const customers = [
  { id: 1, name: 'Juan Pérez', email: 'juan@email.com', status: 'active', total: 5000, progress: 75, created_at: '2026-01-15' },
  { id: 2, name: 'María García', email: 'maria@email.com', status: 'pending', total: 3200, progress: 45, created_at: '2026-01-20' }
]

// Funciones de acciones
const edit = (row: Record<string, any>) => {
  console.log('Editar:', row)
  navigateTo(`/admin/partners/${row.id}`)
}

const remove = (row: Record<string, any>) => {
  console.log('Eliminar:', row)
  // Aquí puedes mostrar confirmación y eliminar
}

const deleteMany = (selected: Record<string, any>[]) => {
  console.log('Eliminar múltiples:', selected)
  // Aquí puedes eliminar múltiples registros
}
</script>
<template>
  <div class="w-full py-4">
    <Datatable
      title="Clientes"
      description="Lista de todos los clientes registrados"
      :data="customers"
      :columns="columns"
      :selectable="true"
      :exportable="true"
      export-filename="clientes"
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