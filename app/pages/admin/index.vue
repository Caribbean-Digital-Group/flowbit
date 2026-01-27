<script setup lang="ts">
definePageMeta({
  layout: 'admin'
})

import type { StatItem } from '~/components/StatGrid.vue'

// Estadísticas de ejemplo
const stats: StatItem[] = [
  { label: 'Partners', value: '2,345', change: '+12%', trend: 'up' },
  { label: 'Productos', value: '1,234', change: '+23%', trend: 'up' },
  { label: 'Compras', value: '456', change: '+8%', trend: 'down' },
  { label: 'Ventas', value: '891', change: '-3%', trend: 'up' },
]
</script>

<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div>
      <h1 class="text-2xl font-bold text-slate-900">Dashboard</h1>
      <p class="mt-1 text-sm text-slate-500">
        Bienvenido al panel de administración de Flowbit
      </p>
    </div>

    <!-- Stats Grid -->
    <StatGrid :stats="stats" :columns="4" />

    <!-- Quick Actions -->
    <div class="bg-white rounded-2xl p-6 border border-slate-200">
      <h2 class="text-lg font-semibold text-slate-900 mb-4">Acciones rápidas</h2>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <NuxtLink
          to="/admin/partners"
          class="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 transition-colors group"
        >
          <div class="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
            <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <span class="text-sm font-medium">Nuevo Partner</span>
        </NuxtLink>

        <NuxtLink
          to="/admin/products"
          class="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:text-emerald-600 transition-colors group"
        >
          <div class="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
            <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <span class="text-sm font-medium">Nuevo Producto</span>
        </NuxtLink>

        <NuxtLink
          to="/admin/purchases"
          class="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-50 hover:bg-amber-50 hover:text-amber-600 transition-colors group"
        >
          <div class="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center group-hover:bg-amber-200 transition-colors">
            <svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <span class="text-sm font-medium">Nueva Compra</span>
        </NuxtLink>

        <NuxtLink
          to="/admin/orders"
          class="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-50 hover:bg-green-50 hover:text-green-600 transition-colors group"
        >
          <div class="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
            <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <span class="text-sm font-medium">Nueva Venta</span>
        </NuxtLink>
      </div>
    </div>

    <!-- Recent Activity Placeholder -->
    <div class="bg-white rounded-2xl p-6 border border-slate-200">
      <h2 class="text-lg font-semibold text-slate-900 mb-4">Actividad reciente</h2>
      <div class="text-center py-8 text-slate-500">
        <svg class="w-12 h-12 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p class="text-sm">No hay actividad reciente para mostrar</p>
      </div>
    </div>
  </div>
</template>