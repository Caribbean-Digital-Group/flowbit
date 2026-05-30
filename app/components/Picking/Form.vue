<script lang="ts">
import type { Database } from '~/types/database.types'

export interface PickingLineFormData {
  id: string
  product_id: string
  quantity: number
  done_quantity: number | null
  is_partial: boolean
  tracking_type: Database['public']['Enums']['product_tracking']
  lot_name: string
  serial_number: string
  sequence: number
}

export interface PickingFormData {
  notes: string
  warehouse_id: string
  status: Database['public']['Enums']['picking_status']
  type: Database['public']['Enums']['picking_type']
}

export const createEmptyPickingForm = (): PickingFormData => ({
  notes: '',
  warehouse_id: '',
  status: 'borrador',
  type: 'salida'
})

export const createEmptyPickingLineForm = (): PickingLineFormData => ({
  id: crypto.randomUUID(),
  product_id: '',
  quantity: 1,
  done_quantity: null,
  is_partial: false,
  tracking_type: 'none',
  lot_name: '',
  serial_number: '',
  sequence: 10
})
</script>

<script setup lang="ts">
interface Props {
  readonly?: boolean
  productOptions?: { value: string; label: string; tracking: Database['public']['Enums']['product_tracking'] }[]
  warehouseOptions?: { value: string; label: string }[]
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  productOptions: () => [],
  warehouseOptions: () => []
})

const formData = defineModel<PickingFormData>({ required: true })
const lines = defineModel<PickingLineFormData[]>('lines', { default: () => [] })

const isEditing = computed(() => !props.readonly)
const hasScannedLines = computed(() => lines.value.some(l => l.done_quantity !== null))

const addLine = () => {
  const nextSequence = lines.value.length > 0
    ? Math.max(...lines.value.map((line) => line.sequence)) + 10
    : 10
  lines.value.push({ ...createEmptyPickingLineForm(), sequence: nextSequence })
}

const removeLine = (id: string) => {
  lines.value = lines.value.filter((line) => line.id !== id)
}

const handleProductChange = (line: PickingLineFormData) => {
  const opt = props.productOptions.find((item) => item.value === line.product_id)
  if (!opt) return
  line.tracking_type = opt.tracking
  if (opt.tracking === 'none') {
    line.lot_name = ''
    line.serial_number = ''
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <FormSelect
        v-model="formData.warehouse_id"
        label="Almacén"
        :options="warehouseOptions"
        :disabled="readonly"
        required
      />

      <FormInput
        v-model="formData.type"
        label="Tipo de movimiento"
        :readonly="true"
      />
    </div>

    <FormTextArea
      v-model="formData.notes"
      label="Notas"
      placeholder="Observaciones del movimiento"
      :disabled="readonly"
      :rows="3"
    />

    <div class="border-t border-slate-200 pt-6">
      <div class="mb-3 flex items-center justify-between">
        <h3 class="text-base font-semibold text-slate-800">Líneas del picking</h3>
        <BtnApp
          v-if="isEditing"
          label="Agregar línea"
          variant="primary"
          size="sm"
          @click="addLine"
        />
      </div>

      <div class="overflow-x-auto rounded-xl border border-slate-200">
        <!-- HEADER -->
        <div class="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 min-w-[640px]">
          <span class="flex-1 min-w-[180px] text-xs font-semibold uppercase tracking-wide text-slate-500">Producto</span>
          <span class="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500 text-right">
            {{ hasScannedLines ? 'Planeado' : 'Cantidad' }}
          </span>
          <span v-if="hasScannedLines" class="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500 text-right">Real</span>
          <span class="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500 text-center">Tracking</span>
          <span class="w-28 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Lote</span>
          <span class="w-28 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Serie</span>
          <span v-if="isEditing" class="w-16 shrink-0" />
        </div>

        <!-- EMPTY STATE -->
        <div v-if="lines.length === 0" class="px-4 py-8 text-center text-sm text-slate-400 min-w-[640px]">
          Sin líneas — agrega una para comenzar.
        </div>

        <!-- ROWS -->
        <div
          v-for="(line, idx) in lines"
          :key="line.id"
          class="flex items-center gap-2 px-3 py-2 min-w-[640px] border-b border-slate-100 last:border-0"
          :class="line.is_partial ? 'bg-amber-50/60' : (idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')"
        >
          <!-- Indicador parcial -->
          <div
            v-if="line.is_partial"
            class="absolute left-0 top-0 h-full w-0.5 bg-amber-400 rounded-l-xl"
          />

          <!-- Producto -->
          <div class="flex-1 min-w-[180px]">
            <FormSelect
              v-model="line.product_id"
              :options="productOptions.map(item => ({ value: item.value, label: item.label }))"
              :disabled="readonly"
              @update:model-value="handleProductChange(line)"
            />
          </div>

          <!-- Cantidad planeada -->
          <div class="w-24 shrink-0">
            <FormInput
              v-model="line.quantity"
              type="number"
              :disabled="readonly"
            />
          </div>

          <!-- Cantidad real (solo cuando hay líneas escaneadas) -->
          <div v-if="hasScannedLines" class="w-20 shrink-0 flex justify-end">
            <div
              v-if="line.done_quantity !== null"
              class="flex items-center gap-1 rounded-lg px-2.5 py-2 text-sm font-semibold w-full justify-center"
              :class="line.is_partial
                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'"
            >
              <svg v-if="line.is_partial" class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <svg v-else class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {{ line.done_quantity }}
            </div>
            <span v-else class="text-xs text-slate-300 w-full text-center">—</span>
          </div>

          <!-- Tracking -->
          <div class="w-24 shrink-0">
            <FormInput
              v-model="line.tracking_type"
              :readonly="true"
            />
          </div>

          <!-- Lote -->
          <div class="w-28 shrink-0">
            <FormInput
              v-model="line.lot_name"
              placeholder="LOTE-001"
              :disabled="readonly || line.tracking_type !== 'lot'"
            />
          </div>

          <!-- Serie -->
          <div class="w-28 shrink-0">
            <FormInput
              v-model="line.serial_number"
              placeholder="SER-0001"
              :disabled="readonly || line.tracking_type !== 'serial'"
            />
          </div>

          <!-- Eliminar -->
          <div v-if="isEditing" class="w-16 shrink-0 flex justify-end">
            <BtnApp
              variant="ghost"
              size="sm"
              @click="removeLine(line.id)"
            >
              <template #iconLeft>
                <svg class="w-4 h-4 text-slate-400 hover:text-red-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </template>
            </BtnApp>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
