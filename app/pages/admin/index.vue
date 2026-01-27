<script setup lang="ts">
definePageMeta({
  layout: 'admin'
})

// Estadísticas de ejemplo
const stats = [
  { label: 'Partners', value: '2,345', change: '+12%', trend: 'up' },
  { label: 'Empresas', value: '456', change: '+8%', trend: 'up' },
  { label: 'Productos', value: '1,234', change: '+23%', trend: 'up' },
  { label: 'Órdenes', value: '891', change: '-3%', trend: 'down' },
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
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="bg-white rounded-2xl p-6 border border-slate-200 hover:shadow-lg hover:shadow-slate-200/50 transition-shadow"
      >
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium text-slate-500">{{ stat.label }}</p>
          <span
            :class="[
              'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
              stat.trend === 'up' 
                ? 'bg-emerald-100 text-emerald-700' 
                : 'bg-red-100 text-red-700'
            ]"
          >
            {{ stat.change }}
          </span>
        </div>
        <p class="mt-2 text-3xl font-bold text-slate-900">{{ stat.value }}</p>
      </div>
    </div>

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
          to="/admin/companies"
          class="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-50 hover:bg-violet-50 hover:text-violet-600 transition-colors group"
        >
          <div class="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center group-hover:bg-violet-200 transition-colors">
            <svg class="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <span class="text-sm font-medium">Nueva Empresa</span>
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
          to="/admin/orders"
          class="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-50 hover:bg-amber-50 hover:text-amber-600 transition-colors group"
        >
          <div class="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center group-hover:bg-amber-200 transition-colors">
            <svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <span class="text-sm font-medium">Nueva Orden</span>
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