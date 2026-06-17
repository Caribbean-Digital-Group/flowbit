<script setup lang="ts">
import { storeToRefs } from 'pinia'
import QRCode from 'qrcode'
import type { MenuOption } from '~/components/CardSheet.vue'
import {
  createEmptyPickingForm,
  createEmptyPickingLineForm,
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
const { selectedCompanyId, selectedCompany } = storeToRefs(authStore)

const { getPickingViewById, getPickingById, updatePicking, setPickingStatus } = usePicking()
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
const isPartial = ref(false)

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
  if (status.value === 'publicado') {
    options.push({
      id: 'scan',
      label: 'Iniciar escaneo',
      icon: 'M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 4v4m-4-4v4m-4-11h.01M4 20h4M4 4h4',
      action: () => router.push(`/admin/pickings/${rowId.value}/scan`),
      variant: 'default'
    })
  }
  options.push({
    id: 'print-picking',
    label: 'Imprimir picking',
    icon: 'M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z',
    action: () => handlePrintPicking(),
    variant: 'default'
  })
  options.push({
    id: 'print-ticket',
    label: 'Imprimir ticket',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
    action: () => handlePrintTicket(),
    variant: 'default'
  })
  if (status.value === 'borrador') {
    options.push({
      id: 'publish',
      label: 'Publicar',
      icon: 'M5 13l4 4L19 7',
      action: () => void transition('publicado'),
      variant: 'default'
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
const isConfirmed = computed(() => status.value === 'confirmado')
const isFormReadonly = computed(() => !canEdit.value || !isEditing.value)

const shouldOpenInEditMode = (): boolean => {
  const edit = route.query.edit
  return edit === '1' || edit === 'true'
}

const clearEditQueryParam = async () => {
  if (!route.query.edit) return
  const { edit: _edit, ...rest } = route.query
  await router.replace({ path: route.path, query: rest })
}

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

    const [header, detailLines, picking] = await Promise.all([
      getPickingViewById(id, companyId),
      getPickingLinesByPickingId(id, companyId),
      getPickingById(id, companyId)
    ])

    if (!header) {
      errorMessage.value = 'No se encontró el picking.'
      return
    }

    status.value = (header.status || 'borrador') as PickingStatus
    pickName.value = header.name || 'Picking'
    orderName.value = header.order_name || 'Sin orden'
    pickType.value = (header.type || 'salida') as PickingType
    isPartial.value = picking?.is_partial ?? false

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
      done_quantity: line.done_quantity ?? null,
      is_partial: line.is_partial ?? false,
      tracking_type: line.tracking_type,
      lot_name: line.lot_name || '',
      serial_number: line.serial_number || '',
      sequence: line.sequence || 10
    }))
    initialLineIds.value = new Set(lines.value.map((line) => line.id))

    if (!canEdit.value) {
      isEditing.value = false
    } else if (shouldOpenInEditMode()) {
      isEditing.value = true
      if (!header.order_id && lines.value.length === 0) {
        lines.value.push(createEmptyPickingLineForm())
      }
      await clearEditQueryParam()
    }
  } finally {
    isLoading.value = false
  }
}

watch([rowId, selectedCompanyId], () => {
  isEditing.value = false
  loadPicking()
}, { immediate: true })

watch(canEdit, (editable) => {
  if (!editable) isEditing.value = false
})

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

  if (!canEdit.value) {
    errorMessage.value = 'Este picking no puede modificarse en su estado actual.'
    isEditing.value = false
    return
  }

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


const printHtml = (html: string) => {
  if (typeof window === 'undefined') return
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  iframe.setAttribute('aria-hidden', 'true')
  document.body.appendChild(iframe)

  const iframeDoc = iframe.contentWindow?.document
  if (!iframeDoc || !iframe.contentWindow) {
    document.body.removeChild(iframe)
    errorMessage.value = 'No se pudo inicializar la impresión en este navegador.'
    return
  }

  iframeDoc.open()
  iframeDoc.write(html)
  iframeDoc.close()

  let triggered = false
  const printAndCleanup = () => {
    if (triggered) return
    triggered = true
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    setTimeout(() => {
      if (document.body.contains(iframe)) document.body.removeChild(iframe)
    }, 1000)
  }

  iframe.onload = printAndCleanup
  setTimeout(printAndCleanup, 400)
}

const buildPickingPrintableHtml = (qrSvg: string) => {
  const co = selectedCompany.value
  const accentColor = co?.primary_color || '#2563eb'
  const companyName = co?.display_name || co?.name || ''
  const legalName = co?.legal_name && co.legal_name !== companyName ? co.legal_name : ''
  const companyAddress = [co?.street, co?.city, co?.state].filter(Boolean).join(' · ')

  const typeColor = pickType.value === 'entrada' ? '#16a34a' : '#d97706'

  const statusBadgeStyle: Record<string, string> = {
    borrador:   'background:#e2e8f0;color:#475569',
    publicado:  'background:#dbeafe;color:#1d4ed8',
    confirmado: 'background:#dcfce7;color:#15803d',
    cancelado:  'background:#fee2e2;color:#b91c1c'
  }
  const badgeStyle = statusBadgeStyle[status.value] ?? statusBadgeStyle.borrador

  const warehouseLabel = warehouseOptions.value.find(w => w.value === formData.value.warehouse_id)?.label || '—'
  const totalUnits = lines.value.reduce((acc, l) => acc + l.quantity, 0)

  const logoInitial = (companyName[0] || 'F').toUpperCase()
  const logoHtml = co?.logo_url
    ? `<img src="${co.logo_url}" alt="${companyName}" style="width:64px;height:64px;object-fit:contain;border-radius:8px;display:block" />`
    : `<div style="width:64px;height:64px;border-radius:8px;background:${accentColor}20;font-size:24px;font-weight:800;color:${accentColor};line-height:64px;text-align:center">${logoInitial}</div>`

  const hasAnyScanned = lines.value.some(l => l.done_quantity !== null)
  const lineRows = lines.value.map((line, idx) => {
    const product = productOptions.value.find(p => p.value === line.product_id)
    const productLabel = product?.label || line.product_id || '—'
    const lot = line.tracking_type === 'lot' ? (line.lot_name || '—') : '—'
    const serial = line.tracking_type === 'serial' ? (line.serial_number || '—') : '—'
    const trackingBadge = line.tracking_type === 'lot'
      ? `<span style="background:#dbeafe;color:#1d4ed8;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:600">Lote</span>`
      : line.tracking_type === 'serial'
        ? `<span style="background:#fce7f3;color:#9d174d;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:600">Serie</span>`
        : `<span style="background:#f1f5f9;color:#374151;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:600">Ninguno</span>`
    const rowBg = line.is_partial ? '#fffbeb' : (idx % 2 === 0 ? '#ffffff' : '#f8fafc')
    const qtyCell = hasAnyScanned
      ? line.done_quantity !== null
        ? line.is_partial
          ? `<div style="font-size:12px;font-weight:700;color:#d97706">${line.done_quantity}</div>
             <div style="font-size:10px;color:#374151;text-decoration:line-through">${line.quantity} plan.</div>`
          : `<div style="font-size:12px;font-weight:700;color:#15803d">${line.done_quantity}</div>`
        : `<div style="font-size:12px;font-weight:700;color:#0f172a">${line.quantity}</div>`
      : `<div style="font-size:12px;font-weight:700;color:#0f172a">${line.quantity}</div>`
    const partialBadge = line.is_partial
      ? `<span style="background:#fef3c7;color:#92400e;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:600">Parcial</span>`
      : ''
    return `
      <tr style="background:${rowBg}">
        <td style="padding:10px 14px;font-size:12px;font-weight:500;color:#0f172a">
          ${productLabel}${partialBadge ? `<br><span style="margin-top:3px;display:inline-block">${partialBadge}</span>` : ''}
        </td>
        <td style="padding:10px 14px;text-align:center">${trackingBadge}</td>
        <td style="padding:10px 14px;text-align:center;font-size:12px;color:#475569">${lot}</td>
        <td style="padding:10px 14px;text-align:center;font-size:12px;color:#475569">${serial}</td>
        <td style="padding:10px 14px;text-align:right">${qtyCell}</td>
      </tr>`
  }).join('')

  const today = new Date().toLocaleString('es-MX', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${typeLabel[pickType.value]} ${pickName.value}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #0f172a; background: #fff; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { margin: 14mm 16mm; size: A4; }
    }
    .page { max-width: 860px; margin: 0 auto; padding: 32px; }
  </style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;border-bottom:3px solid ${accentColor};margin-bottom:28px">
    <div style="display:flex;gap:16px;align-items:flex-start">
      ${logoHtml}
      <div>
        <div style="font-size:20px;font-weight:800;color:#0f172a;line-height:1.2">${companyName}</div>
        ${legalName ? `<div style="font-size:11px;color:#374151;margin-top:2px">${legalName}</div>` : ''}
        ${co?.vat ? `<div style="font-size:11px;color:#374151;margin-top:2px">RFC: ${co.vat}</div>` : ''}
        ${companyAddress ? `<div style="font-size:11px;color:#374151;margin-top:2px">${companyAddress}</div>` : ''}
        ${co?.phone ? `<div style="font-size:11px;color:#374151;margin-top:1px">Tel: ${co.phone}</div>` : ''}
        ${co?.email ? `<div style="font-size:11px;color:#374151;margin-top:1px">${co.email}</div>` : ''}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:12px">
      <div style="text-align:right">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${accentColor};margin-bottom:4px">Orden de Almacén</div>
        <div style="font-size:28px;font-weight:800;letter-spacing:-0.5px;line-height:1;color:${typeColor}">${typeLabel[pickType.value].toUpperCase()}</div>
        <div style="font-size:16px;font-weight:600;color:#0f172a;margin-top:4px">${pickName.value}</div>
        <span style="display:inline-block;margin-top:8px;padding:3px 12px;border-radius:999px;font-size:11px;font-weight:700;${badgeStyle}">${statusLabel[status.value]}</span>
      </div>
      <div style="border:1px solid #e2e8f0;border-radius:8px;padding:6px;background:#fff;text-align:center">
        <div style="width:90px;height:90px">${qrSvg}</div>
        <div style="font-size:9px;color:#374151;margin-top:3px;font-family:sans-serif">Escanear picking</div>
      </div>
    </div>
  </div>

  <!-- INFO CARDS -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:28px">
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${accentColor};margin-bottom:8px">Orden Origen</div>
      <div style="font-size:13px;font-weight:600;color:#0f172a">${orderName.value || '—'}</div>
      <div style="font-size:11px;color:#374151;margin-top:4px">Orden vinculada</div>
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${accentColor};margin-bottom:8px">Almacén</div>
      <div style="font-size:13px;font-weight:600;color:#0f172a">${warehouseLabel}</div>
      <div style="font-size:11px;color:#374151;margin-top:4px">Destino del movimiento</div>
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${accentColor};margin-bottom:8px">Resumen</div>
      <div style="font-size:13px;font-weight:600;color:#0f172a">${lines.value.length} ${lines.value.length === 1 ? 'línea' : 'líneas'}</div>
      <div style="font-size:11px;color:#374151;margin-top:4px">${totalUnits} unidades en total</div>
    </div>
  </div>

  <!-- TABLE -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
    <thead>
      <tr style="background:${accentColor}">
        <th style="color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:11px 14px;text-align:left">Producto</th>
        <th style="color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:11px 14px;text-align:center">Tracking</th>
        <th style="color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:11px 14px;text-align:center">Lote</th>
        <th style="color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:11px 14px;text-align:center">Serie</th>
        <th style="color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:11px 14px;text-align:right">Cantidad</th>
      </tr>
    </thead>
    <tbody>
      ${lineRows || `<tr><td colspan="5" style="text-align:center;padding:24px;color:#374151;font-size:13px">Sin líneas de picking</td></tr>`}
    </tbody>
  </table>

  ${formData.value.notes ? `
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:24px">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${accentColor};margin-bottom:8px">Notas</div>
    <div style="font-size:12px;color:#475569;line-height:1.6;white-space:pre-line">${formData.value.notes}</div>
  </div>` : ''}

  <!-- SIGNATURES -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:32px;margin-bottom:24px">
    ${['Preparó', 'Validó', 'Recibió'].map(label => `
    <div>
      <div style="height:56px;border-bottom:1.5px solid #94a3b8;margin-bottom:8px"></div>
      <div style="text-align:center;font-size:11px;color:#374151;font-weight:600">${label}</div>
    </div>`).join('')}
  </div>

  <!-- FOOTER -->
  <div style="border-top:1px solid #e2e8f0;padding-top:14px;display:flex;justify-content:space-between;align-items:center">
    <div style="font-size:10px;color:#374151">${companyName}${pickName.value ? ' · ' + pickName.value : ''}</div>
    <div style="font-size:10px;color:#374151">Impreso el ${today}</div>
  </div>

</div>
</body>
</html>`
}

const buildPickingTicketHtml = (qrSvg: string) => {
  const co = selectedCompany.value
  const accentColor = co?.primary_color || '#2563eb'
  const companyName = co?.display_name || co?.name || ''
  const legalName = co?.legal_name && co.legal_name !== companyName ? co.legal_name : ''
  const companyAddress = [co?.street, co?.city, co?.state].filter(Boolean).join(', ')
  const typeColor = pickType.value === 'entrada' ? '#16a34a' : '#d97706'
  const warehouseLabel = warehouseOptions.value.find(w => w.value === formData.value.warehouse_id)?.label || '—'
  const totalUnits = lines.value.reduce((acc, l) => acc + l.quantity, 0)
  const companyDesc = co?.description || ''

  const logoInitial = (companyName[0] || 'F').toUpperCase()
  const logoHtml = co?.logo_url
    ? `<img src="${co.logo_url}" alt="${companyName}" style="width:68px;height:68px;object-fit:contain;border-radius:6px;display:block;margin:0 auto 8px" />`
    : `<div style="width:68px;height:68px;border-radius:50%;background:${accentColor};color:#fff;font-size:24px;font-weight:800;line-height:68px;text-align:center;margin:0 auto 8px">${logoInitial}</div>`

  const sep = `<div style="border-top:1px dashed #cbd5e1;margin:12px 0"></div>`
  const today = new Date().toLocaleString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

  const lineRows = lines.value.map((line) => {
    const product = productOptions.value.find(p => p.value === line.product_id)
    const productLabel = product?.label || line.product_id || '—'
    const trackingInfo = line.tracking_type === 'lot' && line.lot_name
      ? `Lote: ${line.lot_name}`
      : line.tracking_type === 'serial' && line.serial_number
        ? `Serie: ${line.serial_number}`
        : ''
    const qtyDisplay = line.done_quantity !== null
      ? line.is_partial
        ? `<span style="color:#d97706;font-weight:700">${line.done_quantity}</span><span style="color:#374151;font-size:10px;text-decoration:line-through;margin-left:3px">${line.quantity}</span>`
        : `${line.done_quantity} uds.`
      : `${line.quantity} uds.`
    return `
      <div style="margin-bottom:10px;${line.is_partial ? 'background:#fffbeb;border-radius:6px;padding:4px 6px;margin-left:-6px;margin-right:-6px' : ''}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div style="font-size:12px;font-weight:600;color:#0f172a;flex:1;padding-right:8px">${productLabel}${line.is_partial ? ' <span style="background:#fef3c7;color:#92400e;padding:0px 5px;border-radius:999px;font-size:9px;font-weight:700">PARCIAL</span>' : ''}</div>
          <div style="font-size:13px;font-weight:700;white-space:nowrap">${qtyDisplay}</div>
        </div>
        ${trackingInfo ? `<div style="font-size:10px;color:#374151;margin-top:2px">${trackingInfo}</div>` : ''}
      </div>`
  }).join('')

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Ticket ${pickName.value}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Courier New', Courier, monospace; color: #0f172a; background: #fff; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { size: 80mm auto; margin: 4mm 5mm; }
    }
    .ticket { max-width: 80mm; margin: 0 auto; padding: 16px 14px; }
  </style>
</head>
<body>
<div class="ticket">

  <!-- Logo + empresa -->
  <div style="text-align:center;margin-bottom:12px">
    ${logoHtml}
    <div style="font-size:14px;font-weight:800;color:#0f172a;line-height:1.2">${companyName}</div>
    ${legalName ? `<div style="font-size:10px;color:#374151;margin-top:1px">${legalName}</div>` : ''}
    ${co?.vat ? `<div style="font-size:10px;color:#374151;margin-top:1px">RFC: ${co.vat}</div>` : ''}
    ${companyAddress ? `<div style="font-size:10px;color:#374151;margin-top:1px">${companyAddress}</div>` : ''}
    ${co?.phone ? `<div style="font-size:10px;color:#374151;margin-top:1px">${co.phone}</div>` : ''}
  </div>

  ${sep}

  <!-- Tipo y nombre -->
  <div style="text-align:center;margin-bottom:8px">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${accentColor}">Orden de Almacén</div>
    <div style="font-size:20px;font-weight:800;color:${typeColor};margin-top:2px;text-transform:uppercase">${typeLabel[pickType.value]}</div>
    <div style="font-size:16px;font-weight:700;color:#0f172a;margin-top:2px">${pickName.value}</div>
    <span style="display:inline-block;margin-top:5px;padding:2px 10px;border-radius:999px;font-size:10px;font-weight:700;background:${accentColor};color:#fff">${statusLabel[status.value]}</span>
  </div>

  <div style="display:flex;justify-content:center;margin:10px 0">
    <div style="text-align:center">
      <div style="width:100px;height:100px;margin:0 auto">${qrSvg}</div>
      <div style="font-size:9px;color:#374151;margin-top:3px;font-family:monospace">Escanear para procesar</div>
    </div>
  </div>

  ${sep}

  <!-- Datos -->
  <div style="font-size:11px;margin-bottom:4px">
    <div style="display:flex;justify-content:space-between;margin-bottom:4px">
      <span style="color:#374151">Orden origen</span>
      <span style="font-weight:600">${orderName.value || '—'}</span>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:4px">
      <span style="color:#374151">Almacén</span>
      <span style="font-weight:600;text-align:right;max-width:60%">${warehouseLabel}</span>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:4px">
      <span style="color:#374151">Líneas</span>
      <span style="font-weight:600">${lines.value.length}</span>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:4px">
      <span style="color:#374151">Total unidades</span>
      <span style="font-weight:700">${totalUnits}</span>
    </div>
  </div>

  ${sep}

  <!-- Líneas -->
  ${lineRows || `<div style="text-align:center;font-size:11px;color:#374151;padding:8px 0">Sin líneas</div>`}

  ${sep}

  ${formData.value.notes ? `
  <div style="font-size:10px;color:#475569;line-height:1.5;margin-bottom:10px;white-space:pre-line">${formData.value.notes}</div>
  ${sep}` : ''}

  <!-- Firmas -->
  <div style="margin-bottom:12px">
    ${['Preparó', 'Validó', 'Recibió'].map(label => `
    <div style="margin-bottom:16px">
      <div style="height:36px;border-bottom:1px solid #94a3b8"></div>
      <div style="text-align:center;font-size:10px;color:#374151;margin-top:4px">${label}</div>
    </div>`).join('')}
  </div>

  ${sep}

  ${companyDesc ? `<div style="font-size:10px;color:#374151;line-height:1.5;text-align:center;white-space:pre-line;margin-bottom:10px">${companyDesc}</div>${sep}` : ''}

  <!-- Footer -->
  <div style="text-align:center;font-size:10px;color:#374151;line-height:1.6">
    <div>${companyName}</div>
    <div>${today}</div>
  </div>

</div>
</body>
</html>`
}

const generateQrSvg = async (url: string): Promise<string> => {
  const svg = await QRCode.toString(url, {
    type: 'svg',
    margin: 1,
    color: { dark: '#0f172a', light: '#ffffff' }
  })
  return svg
    .replace(/width="[^"]*"/, 'width="100%"')
    .replace(/height="[^"]*"/, 'height="100%"')
}

const handlePrintPicking = async () => {
  const config = useRuntimeConfig()
  const scanUrl = `${config.public.siteUrl}/admin/pickings/${rowId.value}/scan`
  const qrSvg = await generateQrSvg(scanUrl)
  printHtml(buildPickingPrintableHtml(qrSvg))
}

const handlePrintTicket = async () => {
  const config = useRuntimeConfig()
  const scanUrl = `${config.public.siteUrl}/admin/pickings/${rowId.value}/scan`
  const qrSvg = await generateQrSvg(scanUrl)
  printHtml(buildPickingTicketHtml(qrSvg))
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

      <div
        v-if="isConfirmed && isPartial"
        class="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-6 py-4"
      >
        <p class="text-sm font-semibold text-amber-800">Picking parcial</p>
        <p class="text-sm text-amber-700 mt-0.5">
          Una o más líneas se procesaron con una cantidad diferente a la planeada. El stock fue ajustado únicamente por las cantidades reales confirmadas.
        </p>
      </div>

      <div
        v-if="isConfirmed"
        class="mb-6 rounded-2xl border border-emerald-100 bg-emerald-50 px-6 py-4 text-emerald-800"
      >
        Este picking está confirmado. Los datos y las líneas son de solo lectura.
      </div>

      <div
        v-else-if="!canEdit"
        class="mb-6 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 text-slate-600"
      >
        Este picking está cancelado y no puede modificarse.
      </div>

      <template #status>
        <div class="flex items-center gap-2 flex-wrap">
          <BadgeApp :label="typeLabel[pickType]" :variant="pickType === 'entrada' ? 'success' : 'warning'" />
          <BadgeApp :label="statusLabel[status]" :variant="statusVariant[status]" />
          <BadgeApp v-if="isPartial" label="Parcial" variant="warning" />
        </div>
      </template>

      <PickingForm
        v-model="formData"
        v-model:lines="lines"
        :readonly="isFormReadonly"
        :product-options="productOptions"
        :warehouse-options="warehouseOptions"
      />

      <!-- SECCIÓN QR - siempre visible -->
      <div class="mt-8 pt-6 border-t border-slate-200">
        <h3 class="text-sm font-semibold text-slate-700 mb-4">Código QR del picking</h3>
        <div class="flex flex-col sm:flex-row gap-5 items-start">
          <PickingQrCode :picking-id="rowId ?? ''" :picking-name="pickName" :size="128" />
          <div class="flex-1 space-y-3">
            <p class="text-sm text-slate-500">
              Escanea con la cámara del operador o con un lector para abrir directamente la vista de escaneo de este picking en cualquier dispositivo.
            </p>
            <NuxtLink
              :to="`/admin/pickings/${rowId}/scan`"
              class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 4v4m-4-4v4m-4-11h.01M4 20h4M4 4h4" />
              </svg>
              Abrir vista de escaneo
            </NuxtLink>
          </div>
        </div>
      </div>
    </CardSheet>
  </div>
</template>
