<script lang="ts">
import type { Database } from '~/types/database.types'

export interface PickingLineFormData {
  id: string
  product_id: string
  quantity: number
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
  tracking_type: 'none',
  lot_name: '',
  serial_number: '',
  sequence: 10
})
</script>

<script setup lang="ts">
import type { Database } from '~/types/database.types'

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
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-base font-semibold text-slate-800">Líneas del picking</h3>
        <BtnApp
          v-if="isEditing"
          label="Agregar línea"
          variant="primary"
          size="sm"
          @click="addLine"
        />
      </div>

      <div class="space-y-3">
        <div
          v-for="line in lines"
          :key="line.id"
          class="rounded-xl border border-slate-200 bg-white p-4"
        >
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div class="lg:col-span-4">
              <FormSelect
                v-model="line.product_id"
                label="Producto"
                :options="productOptions.map(item => ({ value: item.value, label: item.label }))"
                :disabled="readonly"
                @update:model-value="handleProductChange(line)"
              />
            </div>

            <div class="lg:col-span-2">
              <FormInput
                v-model="line.quantity"
                type="number"
                label="Cantidad"
                :disabled="readonly"
              />
            </div>

            <div class="lg:col-span-2">
              <FormInput
                v-model="line.tracking_type"
                label="Tracking"
                :readonly="true"
              />
            </div>

            <div class="lg:col-span-2">
              <FormInput
                v-model="line.lot_name"
                label="Lote"
                placeholder="LOTE-001"
                :disabled="readonly || line.tracking_type !== 'lot'"
              />
            </div>

            <div class="lg:col-span-2">
              <FormInput
                v-model="line.serial_number"
                label="Serie"
                placeholder="SER-0001"
                :disabled="readonly || line.tracking_type !== 'serial'"
              />
            </div>
          </div>

          <div v-if="isEditing" class="mt-3 flex justify-end">
            <BtnApp
              label="Eliminar"
              variant="ghost"
              size="sm"
              @click="removeLine(line.id)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
