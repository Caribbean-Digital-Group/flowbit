<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import {
  createEmptyPickingForm,
  type PickingFormData,
  type PickingLineFormData
} from '~/components/Picking/Form.vue'
import type { Database } from '~/types/database.types'

definePageMeta({
  layout: 'admin'
})

type PickingStatus = Database['public']['Enums']['picking_status']
type PickingType = Database['public']['Enums']['picking_type']

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { selectedCompanyId } = storeToRefs(authStore)

const { getPickingViewById, updatePicking, setPickingStatus } = usePicking()
const { getWarehousesByCompany } = useWarehouse()
const { getProductsByCompany } = useProduct()
const {
  getPickingLinesByPickingId,
  createPickingLine,
  updatePickingLine,
  deletePickingLine
} = usePickingLine()

const rowId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

const formData = ref<PickingFormData>(createEmptyPickingForm())
const initialForm = ref<PickingFormData>(createEmptyPickingForm())
const lines = ref<PickingLineFormData[]>([])
const initialLineIds = ref<Set<string>>(new Set())
const isLoading = ref(false)
const isEditing = ref(false)
const errorMessage = ref<string | null>(null)

const status = ref<PickingStatus>('borrador')
const pickName = ref('Picking')
const orderName = ref('Sin orden')
const pickType = ref<PickingType>('salida')

const warehouseOptions = ref<{ value: string; label: string }[]>([])
const productOptions = ref<{ value: string; label: string; tracking: Database['public']['Enums']['product_tracking'] }[]>([])

const statusLabel: Record<PickingStatus, string> = {
  borrador: 'Borrador',
  publicado: 'Publicado',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado'
}

const typeLabel: Record<PickingType, string> = {
  entrada: 'Entrada',
  salida: 'Salida'
}

const statusVariant: Record<PickingStatus, 'warning' | 'primary' | 'success' | 'danger'> = {
  borrador: 'warning',
  publicado: 'primary',
  confirmado: 'success',
  cancelado: 'danger'
}

const menuOptions = computed<MenuOption[]>(() => {
  const options: MenuOption[] = []
  if (status.value === 'borrador') {
    options.push({
      id: 'publish',
      label: 'Publicar',
      icon: 'M5 13l4 4L19 7',
      action: () => void transition('publicado'),
      variant: 'primary'
    })
    options.push({
      id: 'cancel',
      label: 'Cancelar',
      icon: 'M6 18L18 6M6 6l12 12',
      action: () => void transition('cancelado'),
      variant: 'warning'
    })
  }
  if (status.value === 'publicado') {
    options.push({
      id: 'confirm',
      label: 'Confirmar',
      icon: 'M9 12l2 2 4-4',
      action: () => void transition('confirmado'),
      variant: 'success'
    })
    options.push({
      id: 'cancel',
      label: 'Cancelar',
      icon: 'M6 18L18 6M6 6l12 12',
      action: () => void transition('cancelado'),
      variant: 'warning'
    })
  }
  return options
})

const canEdit = computed(() => status.value === 'borrador' || status.value === 'publicado')

const loadCatalogs = async (companyId: string) => {
  const [warehouses, products] = await Promise.all([
    getWarehousesByCompany(companyId),
    getProductsByCompany(companyId, { productType: 'product', status: 'active' })
  ])
  warehouseOptions.value = warehouses.map((item) => ({
    value: item.id,
    label: `${item.name} (${item.code})`
  }))
  productOptions.value = products.map((item) => ({
    value: item.id,
    label: `${item.display_name?.trim() || item.name} (${item.sku || 'SIN-SKU'})`,
    tracking: item.tracking || 'none'
  }))
}

const loadPicking = async () => {
  const companyId = selectedCompanyId.value
  const id = rowId.value
  if (!companyId || !id) return

  isLoading.value = true
  errorMessage.value = null
  try {
    await loadCatalogs(companyId)

    const [header, detailLines] = await Promise.all([
      getPickingViewById(id, companyId),
      getPickingLinesByPickingId(id, companyId)
    ])

    if (!header) {
      errorMessage.value = 'No se encontró el picking.'
      return
    }

    status.value = (header.status || 'borrador') as PickingStatus
    pickName.value = header.name || 'Picking'
    orderName.value = header.order_name || 'Sin orden'
    pickType.value = (header.type || 'salida') as PickingType

    const mappedForm: PickingFormData = {
      notes: header.notes || '',
      warehouse_id: header.warehouse_id || '',
      status: status.value,
      type: pickType.value
    }
    formData.value = mappedForm
    initialForm.value = { ...mappedForm }

    lines.value = detailLines.map((line) => ({
      id: line.id,
      product_id: line.product_id,
      quantity: line.quantity,
      tracking_type: line.tracking_type,
      lot_name: line.lot_name || '',
      serial_number: line.serial_number || '',
      sequence: line.sequence || 10
    }))
    initialLineIds.value = new Set(lines.value.map((line) => line.id))
  } finally {
    isLoading.value = false
  }
}

watch([rowId, selectedCompanyId], () => {
  isEditing.value = false
  loadPicking()
}, { immediate: true })

const transition = async (nextStatus: PickingStatus) => {
  const id = rowId.value
  if (!id) return
  isLoading.value = true
  errorMessage.value = null
  try {
    const ok = await setPickingStatus(id, nextStatus)
    if (!ok) {
      errorMessage.value = 'No se pudo aplicar el cambio de estado.'
      return
    }
    await loadPicking()
    isEditing.value = false
  } finally {
    isLoading.value = false
  }
}

const syncLines = async (companyId: string, pickingId: string): Promise<boolean> => {
  const currentIds = new Set(lines.value.map((line) => line.id))

  for (const prevId of initialLineIds.value) {
    if (!currentIds.has(prevId)) {
      const ok = await deletePickingLine(prevId)
      if (!ok) return false
    }
  }

  for (const line of lines.value) {
    if (!line.product_id.trim() || line.quantity <= 0) return false

    const payload = {
      company_id: companyId,
      picking_id: pickingId,
      product_id: line.product_id,
      quantity: line.quantity,
      tracking_type: line.tracking_type,
      lot_name: line.lot_name.trim() || null,
      serial_number: line.serial_number.trim() || null,
      sequence: line.sequence
    }

    if (initialLineIds.value.has(line.id)) {
      const updated = await updatePickingLine(line.id, payload)
      if (!updated) return false
    } else {
      const created = await createPickingLine(payload)
      if (!created) return false
      line.id = created.id
    }
  }

  return true
}

const handleSave = async () => {
  const companyId = selectedCompanyId.value
  const id = rowId.value
  if (!companyId || !id) return

  if (!formData.value.warehouse_id) {
    errorMessage.value = 'Selecciona un almacén.'
    return
  }

  isLoading.value = true
  errorMessage.value = null
  try {
    const updated = await updatePicking(id, companyId, {
      notes: formData.value.notes.trim() || null,
      warehouse_id: formData.value.warehouse_id
    })
    if (!updated) {
      errorMessage.value = 'No se pudo guardar el encabezado del picking.'
      return
    }

    const ok = await syncLines(companyId, id)
    if (!ok) {
      errorMessage.value = 'No se pudieron sincronizar las líneas del picking.'
      return
    }

    isEditing.value = false
    await loadPicking()
  } finally {
    isLoading.value = false
  }
}

const cancelEdit = () => {
  isEditing.value = false
  formData.value = { ...initialForm.value }
  loadPicking()
}
</script>

<template>
  <div>
    <CardSheet
      :title="pickName"
      :subtitle="`${typeLabel[pickType]} · ${orderName}`"
      :is-editing="isEditing"
      :is-loading="isLoading"
      :show-edit-button="canEdit"
      :show-options-button="menuOptions.length > 0"
      :menu-options="menuOptions"
      @back="router.push('/admin/pickings')"
      @edit="isEditing = true"
      @save="handleSave"
      @cancel="cancelEdit"
    >
      <div
        v-if="errorMessage"
        class="mb-6 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700"
      >
        {{ errorMessage }}
      </div>

      <template #status>
        <div class="flex items-center gap-2">
          <BadgeApp :label="typeLabel[pickType]" :variant="pickType === 'entrada' ? 'success' : 'warning'" />
          <BadgeApp :label="statusLabel[status]" :variant="statusVariant[status]" />
        </div>
      </template>

      <PickingForm
        v-model="formData"
        v-model:lines="lines"
        :readonly="!isEditing || !canEdit"
        :product-options="productOptions"
        :warehouse-options="warehouseOptions"
      />
    </CardSheet>
  </div>
</template>
