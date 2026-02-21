<template>
  <div class="w-full">
    <!-- Header: Title, Search & Actions -->
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
      <!-- Title & Description -->
      <div v-if="title || description">
        <h2 v-if="title" class="text-2xl font-bold text-slate-800">{{ title }}</h2>
        <p v-if="description" class="text-slate-500 mt-1">{{ description }}</p>
      </div>

      <!-- Search & Export Actions -->
      <div class="flex flex-col sm:flex-row gap-3">
        <!-- Search Input -->
        <div class="w-80">
            <FormInput
            v-model="searchQuery"
            type="text"
            :placeholder="searchPlaceholder"
            />
        </div>
        <!-- Export CSV Button -->
        <button
          v-if="exportable"
          @click="exportToCSV"
          class="inline-flex items-center justify-center gap-2 px-5 py-3 text-base font-semibold
                 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all
                 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>Exportar CSV</span>
        </button>

        <button
          v-if="creatable"
          @click="emit('create')"
          class="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl
                 bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600
                 hover:from-indigo-700 hover:to-fuchsia-700 text-white font-bold text-base
                 shadow-xl shadow-violet-600/15 hover:shadow-violet-500/30
                 ring-1 ring-indigo-200/60 hover:ring-2 hover:ring-fuchsia-300
                 transition-all duration-200 focus:outline-none"
        >
          <span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/10 backdrop-blur">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </span>
          <span>{{ createLabel }}</span>
        </button>

        <!-- Custom header actions slot -->
        <slot name="headerActions" />
      </div>
    </div>

        <!-- Selected items info bar -->
    <div
      v-if="selectable && selectedRows.length > 0"
      class="mt-4 mb-4 px-6 py-4 bg-indigo-50 rounded-xl border border-indigo-100 flex items-center justify-between"
    >
      <p class="text-base text-indigo-700">
        <span class="font-bold">{{ selectedRows.length }}</span> elemento(s) seleccionado(s)
      </p>
      <div class="flex items-center gap-3">
        <slot name="bulkActions" :selected="selectedRows" />
        <button
          @click="clearSelection"
          class="px-4 py-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700 
                 hover:bg-indigo-100 rounded-lg transition-colors"
        >
          Limpiar selección
        </button>
      </div>
    </div>

    <!-- Table Container -->
    <div class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 overflow-hidden">
      <!-- Table -->
      <div class="overflow-x-auto">
        <table class="w-full">
          <!-- Table Header -->
          <thead>
            <tr class="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
              <!-- Checkbox column -->
              <th v-if="selectable" class="px-6 py-5 text-left">
                <input
                  type="checkbox"
                  :checked="allSelected"
                  :indeterminate="someSelected && !allSelected"
                  @change="toggleSelectAll"
                  class="w-5 h-5 text-indigo-600 rounded-md border-slate-300 focus:ring-indigo-500
                         cursor-pointer transition-colors"
                />
              </th>
              <!-- Dynamic columns -->
              <th
                v-for="column in columns"
                :key="column.key"
                :class="[
                  'px-6 py-5 text-left text-sm font-bold text-slate-600 uppercase tracking-wider',
                  column.sortable !== false ? 'cursor-pointer hover:bg-slate-200/50 transition-colors select-none' : '',
                  column.align === 'center' ? 'text-center' : '',
                  column.align === 'right' ? 'text-right' : ''
                ]"
                @click="column.sortable !== false ? toggleSort(column.key) : null"
              >
                <div class="flex items-center gap-2" :class="{ 'justify-center': column.align === 'center', 'justify-end': column.align === 'right' }">
                  <span>{{ column.label }}</span>
                  <!-- Sort indicator -->
                  <span v-if="column.sortable !== false" class="flex flex-col">
                    <svg
                      class="w-3 h-3 transition-colors"
                      :class="sortKey === column.key && sortOrder === 'asc' ? 'text-indigo-600' : 'text-slate-300'"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M10 3l6 8H4l6-8z" />
                    </svg>
                    <svg
                      class="w-3 h-3 -mt-1 transition-colors"
                      :class="sortKey === column.key && sortOrder === 'desc' ? 'text-indigo-600' : 'text-slate-300'"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M10 17l-6-8h12l-6 8z" />
                    </svg>
                  </span>
                </div>
              </th>
              <!-- Actions column -->
              <th v-if="$slots.actions" class="px-6 py-5 text-center text-sm font-bold text-slate-600 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>

          <!-- Table Body -->
          <tbody class="divide-y divide-slate-100">
            <!-- Empty state -->
            <tr v-if="paginatedData.length === 0">
              <td
                :colspan="totalColumns"
                class="px-6 py-16 text-center"
              >
                <div class="flex flex-col items-center gap-4">
                  <div class="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center">
                    <svg class="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                        d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p class="text-lg font-semibold text-slate-600">{{ emptyTitle }}</p>
                    <p class="text-slate-400 mt-1">{{ emptyMessage }}</p>
                  </div>
                </div>
              </td>
            </tr>

            <!-- Data rows -->
            <tr
              v-for="(row, index) in paginatedData"
              :key="getRowKey(row, index)"
              :class="[
                'transition-colors',
                isSelected(row) ? 'bg-indigo-50/50' : 'hover:bg-slate-50',
                striped && index % 2 === 1 ? 'bg-slate-50/50' : ''
              ]"
            >
              <!-- Checkbox cell -->
              <td v-if="selectable" class="px-6 py-5">
                <input
                  type="checkbox"
                  :checked="isSelected(row)"
                  @change="toggleSelect(row)"
                  class="w-5 h-5 text-indigo-600 rounded-md border-slate-300 focus:ring-indigo-500
                         cursor-pointer transition-colors"
                />
              </td>

              <!-- Data cells -->
              <td
                v-for="column in columns"
                :key="column.key"
                :class="[
                  'px-6 py-5 text-base',
                  column.align === 'center' ? 'text-center' : '',
                  column.align === 'right' ? 'text-right' : ''
                ]"
              >
                <!-- Badge type -->
                <template v-if="column.type === 'badge'">
                  <span
                    :class="getBadgeClasses(getCellValue(row, column.key), column.badgeConfig)"
                    class="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold"
                  >
                    {{ column.badgeConfig?.labels?.[getCellValue(row, column.key)] || getCellValue(row, column.key) }}
                  </span>
                </template>

                <!-- Avatar type -->
                <template v-else-if="column.type === 'avatar'">
                  <div class="flex items-center gap-4">
                    <div class="flex-shrink-0">
                      <img
                        v-if="row[column.avatarKey || 'avatar']"
                        :src="row[column.avatarKey || 'avatar']"
                        :alt="getCellValue(row, column.key)"
                        class="w-12 h-12 rounded-full object-cover ring-2 ring-slate-100"
                      />
                      <div
                        v-else
                        class="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 
                               flex items-center justify-center text-white font-bold text-lg"
                      >
                        {{ getInitials(getCellValue(row, column.key)) }}
                      </div>
                    </div>
                    <div>
                      <p class="font-semibold text-slate-800">{{ getCellValue(row, column.key) }}</p>
                      <p v-if="column.subtitleKey" class="text-sm text-slate-500">{{ row[column.subtitleKey] }}</p>
                    </div>
                  </div>
                </template>

                <!-- Currency type -->
                <template v-else-if="column.type === 'currency'">
                  <span class="font-semibold text-slate-800">
                    {{ formatCurrency(getCellValue(row, column.key), column.currency || 'USD') }}
                  </span>
                </template>

                <!-- Date type -->
                <template v-else-if="column.type === 'date'">
                  <span class="text-slate-600">
                    {{ formatDate(getCellValue(row, column.key), column.dateFormat) }}
                  </span>
                </template>

                <!-- Progress type -->
                <template v-else-if="column.type === 'progress'">
                  <div class="flex items-center gap-3">
                    <div class="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        class="h-full rounded-full transition-all"
                        :class="getProgressColor(getCellValue(row, column.key))"
                        :style="{ width: `${Math.min(100, Math.max(0, getCellValue(row, column.key)))}%` }"
                      />
                    </div>
                    <span class="text-sm font-semibold text-slate-600 w-12 text-right">
                      {{ getCellValue(row, column.key) }}%
                    </span>
                  </div>
                </template>

                <!-- Custom slot -->
                <template v-else-if="$slots[`cell-${column.key}`]">
                  <slot :name="`cell-${column.key}`" :row="row" :value="getCellValue(row, column.key)" />
                </template>

                <!-- Default text -->
                <template v-else>
                  <span class="text-slate-700">{{ getCellValue(row, column.key) }}</span>
                </template>
              </td>

              <!-- Actions cell -->
              <td v-if="$slots.actions" class="px-6 py-5 text-center">
                <slot name="actions" :row="row" :index="index" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Footer: Pagination & Info -->
      <div
        v-if="paginated && filteredData.length > 0"
        class="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-5 
               bg-slate-50 border-t border-slate-200"
      >
        <!-- Info -->
        <div class="text-base text-slate-600">
          Mostrando <span class="font-semibold text-slate-800">{{ paginationStart }}</span>
          a <span class="font-semibold text-slate-800">{{ paginationEnd }}</span>
          de <span class="font-semibold text-slate-800">{{ filteredData.length }}</span> resultados
        </div>

        <!-- Page size selector -->
        <div class="flex items-center gap-3">
          <label class="text-base text-slate-600">Por página:</label>
          <select
            v-model="internalPageSize"
            class="px-4 py-2 text-base rounded-xl bg-white border border-slate-200 text-slate-700
                   focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all cursor-pointer"
          >
            <option v-for="size in pageSizeOptions" :key="size" :value="size">{{ size }}</option>
          </select>
        </div>

        <!-- Pagination buttons -->
        <div class="flex items-center gap-2">
          <!-- First page -->
          <button
            @click="goToPage(1)"
            :disabled="currentPage === 1"
            class="p-3 rounded-xl transition-all"
            :class="currentPage === 1 
              ? 'text-slate-300 cursor-not-allowed' 
              : 'text-slate-600 hover:bg-slate-200'"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>

          <!-- Previous page -->
          <button
            @click="goToPage(currentPage - 1)"
            :disabled="currentPage === 1"
            class="p-3 rounded-xl transition-all"
            :class="currentPage === 1 
              ? 'text-slate-300 cursor-not-allowed' 
              : 'text-slate-600 hover:bg-slate-200'"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <!-- Page numbers -->
          <template v-for="page in visiblePages" :key="page">
            <button
              v-if="page !== '...'"
              @click="goToPage(page as number)"
              class="min-w-[48px] h-12 px-4 rounded-xl text-base font-semibold transition-all"
              :class="currentPage === page 
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25' 
                : 'text-slate-600 hover:bg-slate-200'"
            >
              {{ page }}
            </button>
            <span v-else class="px-2 text-slate-400">...</span>
          </template>

          <!-- Next page -->
          <button
            @click="goToPage(currentPage + 1)"
            :disabled="currentPage === totalPages"
            class="p-3 rounded-xl transition-all"
            :class="currentPage === totalPages 
              ? 'text-slate-300 cursor-not-allowed' 
              : 'text-slate-600 hover:bg-slate-200'"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <!-- Last page -->
          <button
            @click="goToPage(totalPages)"
            :disabled="currentPage === totalPages"
            class="p-3 rounded-xl transition-all"
            :class="currentPage === totalPages 
              ? 'text-slate-300 cursor-not-allowed' 
              : 'text-slate-600 hover:bg-slate-200'"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

// Types
export interface Column {
  key: string
  label: string
  sortable?: boolean
  type?: 'text' | 'badge' | 'avatar' | 'currency' | 'date' | 'progress'
  align?: 'left' | 'center' | 'right'
  // Badge config
  badgeConfig?: {
    colors?: Record<string, string>
    labels?: Record<string, string>
  }
  // Avatar config
  avatarKey?: string
  subtitleKey?: string
  // Currency config
  currency?: string
  // Date config
  dateFormat?: string
}

export interface BadgeColors {
  [key: string]: string
}

// Props
interface Props {
  data: Record<string, any>[]
  columns: Column[]
  title?: string
  description?: string
  rowKey?: string
  // Search
  searchPlaceholder?: string
  searchKeys?: string[]
  // Pagination
  paginated?: boolean
  pageSize?: number
  pageSizeOptions?: number[]
  // Features
  exportable?: boolean
  exportFilename?: string
  selectable?: boolean
  striped?: boolean
  // Create button
  creatable?: boolean
  createLabel?: string
  // Empty state
  emptyTitle?: string
  emptyMessage?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  description: '',
  rowKey: 'id',
  searchPlaceholder: 'Buscar...',
  searchKeys: () => [],
  paginated: true,
  pageSize: 10,
  pageSizeOptions: () => [5, 10, 25, 50, 100],
  exportable: true,
  exportFilename: 'data',
  selectable: false,
  striped: false,
  creatable: false,
  createLabel: 'Nuevo',
  emptyTitle: 'Sin datos',
  emptyMessage: 'No se encontraron registros que coincidan con tu búsqueda.'
})

// Emits
const emit = defineEmits<{
  'row-click': [row: Record<string, any>]
  'selection-change': [selected: Record<string, any>[]]
  'sort-change': [key: string, order: 'asc' | 'desc']
  'create': []
}>()

// State
const searchQuery = ref('')
const sortKey = ref('')
const sortOrder = ref<'asc' | 'desc'>('asc')
const currentPage = ref(1)
const internalPageSize = ref(props.pageSize)
const selectedRows = ref<Record<string, any>[]>([])

// Computed: Total columns count
const totalColumns = computed(() => {
  let count = props.columns.length
  if (props.selectable) count++
  // Check if actions slot is provided
  return count + 1 // +1 for potential actions column
})

// Computed: Filtered data
const filteredData = computed(() => {
  let result = [...props.data]

  // Apply search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    const keysToSearch = props.searchKeys.length > 0 
      ? props.searchKeys 
      : props.columns.map(c => c.key)

    result = result.filter(row => {
      return keysToSearch.some(key => {
        const value = getCellValue(row, key)
        return value?.toString().toLowerCase().includes(query)
      })
    })
  }

  // Apply sorting
  if (sortKey.value) {
    result.sort((a, b) => {
      const aVal = getCellValue(a, sortKey.value)
      const bVal = getCellValue(b, sortKey.value)

      // Handle null/undefined
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return sortOrder.value === 'asc' ? -1 : 1
      if (bVal == null) return sortOrder.value === 'asc' ? 1 : -1

      // Compare values
      let comparison = 0
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal
      } else {
        comparison = aVal.toString().localeCompare(bVal.toString())
      }

      return sortOrder.value === 'asc' ? comparison : -comparison
    })
  }

  return result
})

// Computed: Paginated data
const paginatedData = computed(() => {
  if (!props.paginated) return filteredData.value

  const start = (currentPage.value - 1) * internalPageSize.value
  const end = start + internalPageSize.value
  return filteredData.value.slice(start, end)
})

// Computed: Total pages
const totalPages = computed(() => {
  return Math.ceil(filteredData.value.length / internalPageSize.value)
})

// Computed: Pagination info
const paginationStart = computed(() => {
  if (filteredData.value.length === 0) return 0
  return (currentPage.value - 1) * internalPageSize.value + 1
})

const paginationEnd = computed(() => {
  return Math.min(currentPage.value * internalPageSize.value, filteredData.value.length)
})

// Computed: Visible page numbers
const visiblePages = computed(() => {
  const pages: (number | string)[] = []
  const total = totalPages.value
  const current = currentPage.value

  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i)
  } else {
    if (current <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i)
      pages.push('...')
      pages.push(total)
    } else if (current >= total - 3) {
      pages.push(1)
      pages.push('...')
      for (let i = total - 4; i <= total; i++) pages.push(i)
    } else {
      pages.push(1)
      pages.push('...')
      for (let i = current - 1; i <= current + 1; i++) pages.push(i)
      pages.push('...')
      pages.push(total)
    }
  }

  return pages
})

// Computed: Selection states
const allSelected = computed(() => {
  return paginatedData.value.length > 0 && 
         paginatedData.value.every(row => isSelected(row))
})

const someSelected = computed(() => {
  return paginatedData.value.some(row => isSelected(row))
})

// Methods
const getCellValue = (row: Record<string, any>, key: string): any => {
  // Support nested keys (e.g., 'user.name')
  return key.split('.').reduce((obj, k) => obj?.[k], row)
}

const getRowKey = (row: Record<string, any>, index: number): string | number => {
  return row[props.rowKey] ?? index
}

const toggleSort = (key: string) => {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortOrder.value = 'asc'
  }
  emit('sort-change', sortKey.value, sortOrder.value)
}

const goToPage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

const isSelected = (row: Record<string, any>): boolean => {
  const rowKeyValue = row[props.rowKey]
  return selectedRows.value.some(r => r[props.rowKey] === rowKeyValue)
}

const toggleSelect = (row: Record<string, any>) => {
  if (isSelected(row)) {
    selectedRows.value = selectedRows.value.filter(r => r[props.rowKey] !== row[props.rowKey])
  } else {
    selectedRows.value.push(row)
  }
  emit('selection-change', selectedRows.value)
}

const toggleSelectAll = () => {
  if (allSelected.value) {
    // Deselect all on current page
    const pageKeys = paginatedData.value.map(r => r[props.rowKey])
    selectedRows.value = selectedRows.value.filter(r => !pageKeys.includes(r[props.rowKey]))
  } else {
    // Select all on current page
    paginatedData.value.forEach(row => {
      if (!isSelected(row)) {
        selectedRows.value.push(row)
      }
    })
  }
  emit('selection-change', selectedRows.value)
}

const clearSelection = () => {
  selectedRows.value = []
  emit('selection-change', selectedRows.value)
}

// Badge helper
const getBadgeClasses = (value: any, config?: Column['badgeConfig']): string => {
  const defaultColors: BadgeColors = {
    active: 'bg-emerald-100 text-emerald-700',
    activo: 'bg-emerald-100 text-emerald-700',
    success: 'bg-emerald-100 text-emerald-700',
    completed: 'bg-emerald-100 text-emerald-700',
    completado: 'bg-emerald-100 text-emerald-700',
    inactive: 'bg-slate-100 text-slate-600',
    inactivo: 'bg-slate-100 text-slate-600',
    pending: 'bg-amber-100 text-amber-700',
    pendiente: 'bg-amber-100 text-amber-700',
    warning: 'bg-amber-100 text-amber-700',
    error: 'bg-red-100 text-red-700',
    cancelled: 'bg-red-100 text-red-700',
    cancelado: 'bg-red-100 text-red-700',
    info: 'bg-sky-100 text-sky-700',
    processing: 'bg-indigo-100 text-indigo-700',
    procesando: 'bg-indigo-100 text-indigo-700'
  }

  const colors = { ...defaultColors, ...config?.colors }
  const normalizedValue = value?.toString().toLowerCase()
  
  return colors[normalizedValue] || 'bg-slate-100 text-slate-600'
}

// Progress color helper
const getProgressColor = (value: number): string => {
  if (value >= 80) return 'bg-gradient-to-r from-emerald-500 to-teal-500'
  if (value >= 50) return 'bg-gradient-to-r from-amber-500 to-orange-500'
  return 'bg-gradient-to-r from-red-500 to-rose-500'
}

// Format helpers
const formatCurrency = (value: number, currency: string): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency
  }).format(value)
}

const formatDate = (value: string | Date, format?: string): string => {
  const date = new Date(value)
  if (isNaN(date.getTime())) return value?.toString() || ''
  
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: format === 'datetime' ? 'short' : undefined
  }).format(date)
}

const getInitials = (name: string): string => {
  if (!name) return '?'
  return name
    .split(' ')
    .map(word => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

// Export to CSV
const exportToCSV = () => {
  const headers = props.columns.map(col => col.label)
  const rows = filteredData.value.map(row => {
    return props.columns.map(col => {
      let value = getCellValue(row, col.key)
      // Handle special types
      if (col.type === 'badge' && col.badgeConfig?.labels) {
        value = col.badgeConfig.labels[value] || value
      }
      // Escape quotes and wrap in quotes if contains comma
      if (typeof value === 'string') {
        value = value.replace(/"/g, '""')
        if (value.includes(',') || value.includes('\n')) {
          value = `"${value}"`
        }
      }
      return value ?? ''
    })
  })

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n')

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', `${props.exportFilename}-${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Watchers
watch(searchQuery, () => {
  currentPage.value = 1
})

watch(internalPageSize, () => {
  currentPage.value = 1
})

watch(() => props.data, () => {
  currentPage.value = 1
  selectedRows.value = []
}, { deep: true })

// Expose methods
defineExpose({
  clearSelection,
  exportToCSV
})
</script>

<style scoped>
/* Checkbox indeterminate state */
input[type="checkbox"]:indeterminate {
  background-color: #6366f1;
  border-color: #6366f1;
  background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M4 8h8' stroke='white' stroke-width='2' stroke-linecap='round'/%3e%3c/svg%3e");
}

/* Smooth transitions for table rows */
tbody tr {
  transition: background-color 0.15s ease;
}

/* Custom scrollbar for table container */
.overflow-x-auto::-webkit-scrollbar {
  height: 8px;
}

.overflow-x-auto::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 4px;
}

.overflow-x-auto::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

.overflow-x-auto::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>
