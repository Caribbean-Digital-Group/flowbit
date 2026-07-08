<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { MenuOption } from '~/components/CardSheet.vue'
import {
  createEmptyOrderForm,
  type OrderFormData,
  type OrderLine
} from '~/components/Order/Form.vue'
import type { Database, TablesUpdate } from '~/types/database.types'

definePageMeta({
  layout: 'admin'
})

type OrderViewRow = Database['public']['Views']['v_orders']['Row']
type OrderLineViewRow = Database['public']['Views']['v_order_lines']['Row']

const route = useRoute()
const router = useRouter()

const authStore = useAuthStore()
const { selectedCompanyId, selectedCompany } = storeToRefs(authStore)

const {
  getOrderViewById,
  updateOrder,
  previewOrderStockShortages,
  postOrderById,
  cancelOrderById,
  addOrderLineRpc
} = useOrder()

const { syncOrderToDraftPicking } = usePicking()
const { getPartnersByCompany } = usePartner()
const { getProjectsByCompany } = useProject()
const { getAllByCompany: getPaymentMethodsByCompany } = usePaymentMethod()
const {
  getOrderLineViewsByOrderId,
  deleteOrderLine,
  updateOrderLine
} = useOrderLine()

const orderId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

type StockShortageRow = {
  product_id: string
  product_name: string
  requested: number
  available: number
}

const isEditing = ref(false)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const showPaymentModal = ref(false)
const selectedPaymentMethodId = ref<string>('')
const stockShortageLines = ref<StockShortageRow[]>([])
const partnerOptions = ref<{ value: string; label: string }[]>([])
const projectOptions = ref<{ value: string; label: string }[]>([])
const paymentMethodOptions = ref<{ value: string; label: string }[]>([])

const formData = ref<OrderFormData>(createEmptyOrderForm())
const orderLines = ref<OrderLine[]>([])
const initialLineIds = ref<Set<string>>(new Set())

// Datos del cliente cuando la orden viene de la tienda en línea
// (las columnas origin/customer_* aún no existen en los types generados)
interface StorefrontOrderInfo {
  customerName: string | null
  customerEmail: string | null
  customerPhone: string | null
  shippingMethodName: string | null
  couponCode: string | null
  couponDiscount: number
}
const orderOrigin = ref<string>('dashboard')
const storefrontInfo = ref<StorefrontOrderInfo | null>(null)

const originLabels: Record<string, string> = {
  dashboard: 'Panel',
  pos: 'POS',
  storefront: 'Tienda en línea'
}

const orderTypeLabels: Record<string, string> = {
  sale: 'Venta',
  purchase: 'Compra'
}

const stateLabels: Record<string, string> = {
  draft: 'Borrador',
  posted: 'Confirmada',
  cancel: 'Cancelada'
}

const stateVariants: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'secondary'> = {
  draft: 'secondary',
  posted: 'success',
  cancel: 'danger'
}

const auditFooter = reactive({
  createdBy: '—',
  createdAt: '',
  updatedBy: '—',
  updatedAt: ''
})

const canEdit = computed(() => formData.value.order_state === 'draft')

const canPost = computed(
  () => formData.value.order_state === 'draft' && orderLines.value.length > 0
)

const canCancel = computed(
  () =>
    formData.value.order_state !== 'cancel'
    && !formData.value.is_delivered
    && !formData.value.is_invoiced
)

const canPay = computed(
  () =>
    formData.value.order_state === 'posted'
    && formData.value.payment_status !== 'paid'
)

const menuOptions = computed<MenuOption[]>(() => {
  const opts: MenuOption[] = []
  opts.push({
    id: 'print-order',
    label: 'Imprimir orden',
    icon: 'M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z',
    action: () => handlePrintOrder(),
    variant: 'default'
  })
  opts.push({
    id: 'print-ticket',
    label: 'Imprimir ticket',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
    action: () => handlePrintTicket(),
    variant: 'default'
  })
  opts.push({
    id: 'print-pos-ticket',
    label: 'Reimprimir ticket POS',
    icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z',
    action: () => handlePrintPosTicket(),
    variant: 'default'
  })
  if (canPost.value) {
    opts.push({
      id: 'post',
      label: 'Confirmar Orden',
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      action: () => void handlePostOrder(),
      variant: 'success'
    })
  }
  if (canPay.value) {
    opts.push({
      id: 'pay-order',
      label: 'Pagar Orden',
      icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
      action: () => void handlePayOrder(),
      variant: 'success'
    })
  }
  if (canCancel.value) {
    opts.push({
      id: 'cancel-order',
      label: 'Cancelar Orden',
      icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
      action: () => void handleCancelOrder(),
      variant: 'warning'
    })
  }
  return opts
})

const refreshStockShortagePreview = async () => {
  stockShortageLines.value = []
  const id = orderId.value
  if (!id || !selectedCompanyId.value) return
  if (formData.value.order_state !== 'draft' || formData.value.order_type !== 'sale') {
    return
  }
  stockShortageLines.value = await previewOrderStockShortages(id)
}

watch(isEditing, (editing) => {
  if (editing) {
    stockShortageLines.value = []
  }
})

const mapViewToForm = (v: OrderViewRow): OrderFormData => {
  const row = v as Record<string, unknown>
  const rawStatus = row['payment_status'] as string | null | undefined
  const validStatuses = ['unpaid', 'partial', 'paid', 'condoned', 'overdue'] as const
  const paymentStatus = validStatuses.includes(rawStatus as typeof validStatuses[number])
    ? rawStatus as typeof validStatuses[number]
    : ((v.is_paid ?? false) ? 'paid' : 'unpaid')

  const pmId = (row['payment_method_id'] as string | null) ?? null
  const pmName = paymentMethodOptions.value.find(o => o.value === pmId)?.label ?? ''

  return {
    name: v.name ?? '',
    order_type: v.order_type ?? 'sale',
    reference: v.reference ?? '',
    order_state: v.order_state ?? 'draft',
    project_id: v.project_id ?? null,
    project_name: v.project_name ?? '',
    partner_id: v.partner_id ?? null,
    partner_name: v.partner_name ?? '',
    created_by_partner_id: v.created_by_partner_id ?? null,
    created_by_partner_name: v.created_by_partner_name ?? '',
    order_date: v.order_date ?? '',
    confirmation_date: v.confirmation_date ?? null,
    delivery_date: v.delivery_date ?? '',
    currency: v.currency ?? 'MXN',
    exchange_rate: v.exchange_rate ?? 1,
    tax_rate: v.tax_rate ?? 0,
    tax_included: v.tax_included ?? false,
    amount_untaxed: v.amount_untaxed ?? 0,
    amount_tax: v.amount_tax ?? 0,
    amount_total: v.amount_total ?? 0,
    amount_discount: v.amount_discount ?? 0,
    payment_method_id: pmId,
    payment_method_name: pmName,
    payment_status: paymentStatus,
    payment_term: v.payment_term ?? '',
    payment_due_date: v.payment_due_date ?? '',
    shipping_street: v.shipping_street ?? '',
    shipping_street2: v.shipping_street2 ?? '',
    shipping_city: v.shipping_city ?? '',
    shipping_state: v.shipping_state ?? '',
    shipping_zip: v.shipping_zip ?? '',
    shipping_country_code: v.shipping_country_code ?? 'MX',
    notes: v.notes ?? '',
    terms: v.terms ?? '',
    is_invoiced: v.is_invoiced ?? false,
    is_delivered: v.is_delivered ?? false,
    is_paid: v.is_paid ?? false
  }
}

const mapViewLineToUi = (row: OrderLineViewRow): OrderLine => ({
  id: row.id ?? crypto.randomUUID(),
  sequence: row.sequence ?? 10,
  product_id: row.product_id ?? '',
  product_name: row.product_name ?? '',
  description: row.description ?? '',
  quantity: row.quantity ?? 1,
  quantity_delivered: row.quantity_delivered ?? 0,
  quantity_invoiced: row.quantity_invoiced ?? 0,
  unit_price: row.unit_price ?? 0,
  unit_cost: row.unit_cost ?? 0,
  discount_percent: row.discount_percent ?? 0,
  discount_amount: row.discount_amount ?? 0,
  tax_rate: row.tax_rate ?? 0,
  tax_amount: row.tax_amount ?? 0,
  subtotal: row.subtotal ?? 0,
  total: row.total ?? 0,
  margin: row.margin ?? 0,
  margin_percent: row.margin_percent ?? 0
})

const mapFormToOrderUpdate = (value: OrderFormData): TablesUpdate<'order'> => {
  const base: TablesUpdate<'order'> = {
    partner_id: value.partner_id ?? undefined,
    project_id: value.project_id ?? null,
    reference: value.reference.trim() || null,
    order_date: value.order_date,
    delivery_date: value.delivery_date.trim() || null,
    currency: value.currency.trim() || 'MXN',
    exchange_rate: value.exchange_rate,
    tax_rate: value.tax_rate,
    tax_included: value.tax_included,
    payment_term: value.payment_term.trim() || null,
    payment_due_date: value.payment_due_date.trim() || null,
    shipping_street: value.shipping_street.trim() || null,
    shipping_street2: value.shipping_street2.trim() || null,
    shipping_city: value.shipping_city.trim() || null,
    shipping_state: value.shipping_state.trim() || null,
    shipping_zip: value.shipping_zip.trim() || null,
    shipping_country_code: value.shipping_country_code.trim() || null,
    notes: value.notes.trim() || null,
    terms: value.terms.trim() || null,
    is_invoiced: value.is_invoiced,
    is_delivered: value.is_delivered,
    is_paid: value.payment_status === 'paid',
    order_type: value.order_type
  }
  // Los campos payment_method_id y payment_status se agregan al tipo
  // después de correr: npm run db:migration:up && npm run db:types
  const extended = base as Record<string, unknown>
  extended['payment_method_id'] = value.payment_method_id || null
  extended['payment_status'] = value.payment_status
  return base
}

const loadPartners = async () => {
  const companyId = selectedCompanyId.value
  partnerOptions.value = []
  projectOptions.value = []
  paymentMethodOptions.value = []
  if (!companyId) return

  const [partners, projects, paymentMethods] = await Promise.all([
    getPartnersByCompany(companyId),
    getProjectsByCompany(companyId),
    getPaymentMethodsByCompany(companyId)
  ])
  partnerOptions.value = partners.map((p) => ({
    value: p.id,
    label: (p.display_name?.trim() || p.name)?.trim() || p.id
  }))
  projectOptions.value = projects.map((p) => ({
    value: p.id ?? '',
    label: [p.code, p.name].filter(Boolean).join(' · ') || 'Proyecto'
  })).filter((p) => p.value)
  paymentMethodOptions.value = (paymentMethods as Array<{ id: string; name: string }>).map((pm) => ({
    value: pm.id,
    label: pm.name
  }))
}

const loadOrder = async () => {
  const id = orderId.value
  const companyId = selectedCompanyId.value
  errorMessage.value = null

  if (!id) {
    errorMessage.value = 'Identificador de orden no válido.'
    return
  }
  if (!companyId) {
    errorMessage.value = 'Selecciona una empresa para ver esta orden.'
    return
  }

  isLoading.value = true
  try {
    await loadPartners()

    const view = await getOrderViewById(id, companyId)
    if (!view) {
      errorMessage.value = 'No se encontró la orden o no tienes acceso.'
      return
    }

    const mappedForm = mapViewToForm(view)
    formData.value = mappedForm

    const viewAny = view as Record<string, unknown>
    orderOrigin.value = (viewAny['origin'] as string | null) ?? 'dashboard'
    storefrontInfo.value = orderOrigin.value === 'storefront'
      ? {
          customerName: (viewAny['customer_name'] as string | null) ?? null,
          customerEmail: (viewAny['customer_email'] as string | null) ?? null,
          customerPhone: (viewAny['customer_phone'] as string | null) ?? null,
          shippingMethodName: (viewAny['shipping_method_name'] as string | null) ?? null,
          couponCode: (viewAny['coupon_code'] as string | null) ?? null,
          couponDiscount: Number(viewAny['coupon_discount'] ?? 0)
        }
      : null

    auditFooter.createdBy = view.created_by ?? '—'
    auditFooter.createdAt = view.created_at ?? ''
    auditFooter.updatedBy = view.updated_by ?? '—'
    auditFooter.updatedAt = view.updated_at ?? ''

    const lineRows = await getOrderLineViewsByOrderId(id, companyId)
    const lines = lineRows.map(mapViewLineToUi)
    orderLines.value = lines
    initialLineIds.value = new Set(lines.map((l) => l.id))

    await refreshStockShortagePreview()
  } finally {
    isLoading.value = false
  }
}

watch([orderId, selectedCompanyId], () => {
  isEditing.value = false
  void loadOrder()
}, { immediate: true })

const handleBack = () => {
  router.push('/admin/orders')
}

const handlePostOrder = async () => {
  const id = orderId.value
  if (!id || !canPost.value) return
  isLoading.value = true
  errorMessage.value = null
  try {
    if (formData.value.order_type === 'sale') {
      stockShortageLines.value = await previewOrderStockShortages(id)
      if (stockShortageLines.value.length > 0) {
        errorMessage.value =
          'No se puede confirmar la orden hasta resolver el inventario. Revisa el aviso amarillo o ajusta las líneas.'
        return
      }
    }

    const result = await postOrderById(id)
    if (!result.success) {
      errorMessage.value =
        result.errorMessage
        ?? 'No se pudo confirmar la orden. Debe estar en borrador y tener al menos una línea.'
      await refreshStockShortagePreview()
      return
    }

    stockShortageLines.value = []

    if (formData.value.order_type === 'purchase') {
      await syncOrderToDraftPicking(id, false)
    }

    await loadOrder()
  } finally {
    isLoading.value = false
  }
}

const handleCancelOrder = async () => {
  const id = orderId.value
  if (!id || !canCancel.value) return
  isLoading.value = true
  errorMessage.value = null
  try {
    const ok = await cancelOrderById(id)
    if (!ok) {
      errorMessage.value = 'No se pudo cancelar la orden.'
      return
    }
    await loadOrder()
  } finally {
    isLoading.value = false
  }
}

const markOrderAsPaid = async (paymentMethodId: string | null) => {
  const id = orderId.value
  const companyId = selectedCompanyId.value
  if (!id || !companyId || !canPay.value) return

  isLoading.value = true
  errorMessage.value = null
  try {
    const updates: TablesUpdate<'order'> = {
      is_paid: true,
      payment_status: 'paid',
      payment_method_id: paymentMethodId
    }

    const updated = await updateOrder(id, companyId, updates)
    if (!updated) {
      errorMessage.value = 'No se pudo registrar el pago de la orden.'
      return
    }
    await loadOrder()
  } finally {
    isLoading.value = false
  }
}

const handlePayOrder = async () => {
  if (!canPay.value) return

  if (formData.value.payment_method_id) {
    await markOrderAsPaid(formData.value.payment_method_id)
    return
  }

  selectedPaymentMethodId.value = ''
  showPaymentModal.value = true
}

const closePaymentModal = () => {
  if (isLoading.value) return
  showPaymentModal.value = false
}

const handleConfirmPayment = async () => {
  if (!selectedPaymentMethodId.value) {
    errorMessage.value = 'Selecciona un método de pago para confirmar el pago.'
    return
  }
  showPaymentModal.value = false
  await markOrderAsPaid(selectedPaymentMethodId.value)
}

const handleEdit = () => {
  if (canEdit.value) {
    errorMessage.value = null
    isEditing.value = true
  }
}

const formatCurrency = (value: number, currency: string): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN'
  }).format(value || 0)
}

const buildPrintableHtml = () => {
  const co = selectedCompany.value
  const accentColor = co?.primary_color || '#2563eb'

  const companyName = co?.display_name || co?.name || ''
  const legalName = co?.legal_name && co.legal_name !== companyName ? co.legal_name : ''
  const companyAddress = [
    co?.street,
    co?.street2,
    [co?.city, co?.state].filter(Boolean).join(', '),
    [co?.zip, co?.country_code].filter(Boolean).join(' ')
  ].filter(Boolean).join(' · ')

  const orderTypeLabel = orderTypeLabels[formData.value.order_type] || formData.value.order_type
  const stateLabel = stateLabels[formData.value.order_state] || formData.value.order_state

  const stateBadgeStyle: Record<string, string> = {
    draft: 'background:#e2e8f0;color:#1f2937',
    posted: 'background:#dcfce7;color:#15803d',
    cancel: 'background:#fee2e2;color:#b91c1c'
  }
  const badgeStyle = stateBadgeStyle[formData.value.order_state] || stateBadgeStyle.draft

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'

  const orderDate = fmtDate(formData.value.order_date)
  const deliveryDate = fmtDate(formData.value.delivery_date)

  const shippingAddress = [
    formData.value.shipping_street,
    formData.value.shipping_street2,
    [formData.value.shipping_city, formData.value.shipping_state].filter(Boolean).join(', '),
    [formData.value.shipping_zip, formData.value.shipping_country_code].filter(Boolean).join(' ')
  ].filter(Boolean).join(', ')

  const cur = formData.value.currency

  const lineRows = orderLines.value
    .map((line, idx) => {
      const name = line.product_name?.trim() || line.description?.trim() || '—'
      const desc = line.description?.trim() && line.description.trim() !== name ? line.description.trim() : ''
      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc'
      const grossLine = Math.round(line.quantity * line.unit_price * 100) / 100
      const discountCell = line.discount_amount > 0
        ? `<div style="font-size:10px;color:#374151;line-height:1.3">${line.discount_percent}%</div><div style="color:#dc2626;font-weight:500">−${formatCurrency(line.discount_amount, cur)}</div>`
        : '<span style="color:#cbd5e1">—</span>'
      const taxCell = line.tax_amount > 0
        ? `<div style="font-size:10px;color:#374151;line-height:1.3">${line.tax_rate}%</div><div style="font-weight:500">${formatCurrency(line.tax_amount, cur)}</div>`
        : '<span style="color:#cbd5e1">—</span>'
      return `
        <tr style="background:${rowBg}">
          <td style="padding:10px 14px;">
            <div style="font-weight:500;color:#0f172a;font-size:12px">${name}</div>
            ${desc ? `<div style="font-size:11px;color:#1a202c;margin-top:3px">${desc}</div>` : ''}
          </td>
          <td style="text-align:right;padding:10px 14px;font-size:12px;white-space:nowrap;color:#1f2937">${line.quantity}</td>
          <td style="text-align:right;padding:10px 14px;font-size:12px;white-space:nowrap">${formatCurrency(line.unit_price, cur)}</td>
          <td style="text-align:right;padding:10px 14px;font-size:12px;white-space:nowrap;color:#1a202c">${formatCurrency(grossLine, cur)}</td>
          <td style="text-align:right;padding:10px 14px;font-size:12px;white-space:nowrap">${discountCell}</td>
          <td style="text-align:right;padding:10px 14px;font-size:12px;white-space:nowrap">${taxCell}</td>
          <td style="text-align:right;padding:10px 14px;font-size:12px;white-space:nowrap;background:#f0fdf4">${formatCurrency(line.subtotal, cur)}</td>
          <td style="text-align:right;padding:10px 14px;font-size:12px;font-weight:700;white-space:nowrap">${formatCurrency(line.total, cur)}</td>
        </tr>`
    })
    .join('')

  const notesHtml = formData.value.notes
    ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;flex:1">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${accentColor};margin-bottom:8px">Notas</div>
        <div style="font-size:11px;color:#1f2937;line-height:1.6;white-space:pre-line">${formData.value.notes}</div>
       </div>`
    : ''

  const termsHtml = formData.value.terms
    ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;flex:1">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${accentColor};margin-bottom:8px">Términos y Condiciones</div>
        <div style="font-size:11px;color:#1f2937;line-height:1.6;white-space:pre-line">${formData.value.terms}</div>
       </div>`
    : ''

  const extrasHtml = notesHtml || termsHtml
    ? `<div style="display:flex;gap:16px;margin-bottom:24px">${notesHtml}${termsHtml}</div>`
    : ''

  const logoInitial = (companyName[0] || 'F').toUpperCase()
  const logoHtml = co?.logo_url
    ? `<img src="${co.logo_url}" alt="${companyName}" style="width:64px;height:64px;object-fit:contain;border-radius:8px;display:block" />`
    : `<div style="width:64px;height:64px;border-radius:8px;background:${accentColor}20;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:${accentColor};line-height:64px;text-align:center">${logoInitial}</div>`

  const today = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${orderTypeLabel} ${formData.value.name || ''}</title>
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

  <!-- ── HEADER ── -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;border-bottom:3px solid ${accentColor};margin-bottom:28px">

    <!-- Company info -->
    <div style="display:flex;gap:16px;align-items:flex-start">
      ${logoHtml}
      <div>
        <div style="font-size:20px;font-weight:800;color:#0f172a;line-height:1.2">${companyName}</div>
        ${legalName ? `<div style="font-size:11px;color:#1a202c;margin-top:2px">${legalName}</div>` : ''}
        ${co?.vat ? `<div style="font-size:11px;color:#1a202c;margin-top:2px">RFC: ${co.vat}</div>` : ''}
        ${companyAddress ? `<div style="font-size:11px;color:#1a202c;margin-top:2px">${companyAddress}</div>` : ''}
        ${co?.phone ? `<div style="font-size:11px;color:#1a202c;margin-top:1px">Tel: ${co.phone}</div>` : ''}
        ${co?.email ? `<div style="font-size:11px;color:#1a202c;margin-top:1px">${co.email}</div>` : ''}
        ${co?.website ? `<div style="font-size:11px;color:#1a202c;margin-top:1px">${co.website}</div>` : ''}
      </div>
    </div>

    <!-- Order title -->
    <div style="text-align:right">
      <div style="font-size:28px;font-weight:800;color:${accentColor};letter-spacing:-0.5px;line-height:1">${orderTypeLabel.toUpperCase()}</div>
      <div style="font-size:16px;font-weight:600;color:#0f172a;margin-top:4px">${formData.value.name || '—'}</div>
      ${formData.value.reference ? `<div style="font-size:12px;color:#1a202c;margin-top:2px">Ref: ${formData.value.reference}</div>` : ''}
      <span style="display:inline-block;margin-top:8px;padding:3px 12px;border-radius:999px;font-size:11px;font-weight:700;${badgeStyle}">${stateLabel}</span>
    </div>
  </div>

  <!-- ── INFO CARDS ── -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:28px">

    <!-- Card: Partner -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${accentColor};margin-bottom:10px">${formData.value.order_type === 'sale' ? 'Cliente' : 'Proveedor'}</div>
      <div style="font-size:14px;font-weight:600;color:#0f172a;margin-bottom:8px">${formData.value.partner_name || '—'}</div>
      ${shippingAddress ? `
      <div style="display:flex;justify-content:space-between;margin-bottom:5px">
        <span style="font-size:11px;color:#374151">Dirección de envío</span>
        <span style="font-size:11px;font-weight:500;color:#0f172a;text-align:right;max-width:55%">${shippingAddress}</span>
      </div>` : ''}
      ${formData.value.project_name ? `
      <div style="display:flex;justify-content:space-between;margin-bottom:5px">
        <span style="font-size:11px;color:#374151">Proyecto</span>
        <span style="font-size:11px;font-weight:500;color:#0f172a">${formData.value.project_name}</span>
      </div>` : ''}
      ${formData.value.created_by_partner_name ? `
      <div style="display:flex;justify-content:space-between;margin-bottom:5px">
        <span style="font-size:11px;color:#374151">Elaborado por</span>
        <span style="font-size:11px;font-weight:500;color:#0f172a">${formData.value.created_by_partner_name}</span>
      </div>` : ''}
    </div>

    <!-- Card: Order details -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${accentColor};margin-bottom:10px">Detalles de Orden</div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:11px;color:#374151">Fecha de orden</span>
        <span style="font-size:11px;font-weight:500;color:#0f172a">${orderDate}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:11px;color:#374151">Fecha de entrega</span>
        <span style="font-size:11px;font-weight:500;color:#0f172a">${deliveryDate}</span>
      </div>
      ${formData.value.payment_term ? `
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:11px;color:#374151">Condición de pago</span>
        <span style="font-size:11px;font-weight:500;color:#0f172a">${formData.value.payment_term}</span>
      </div>` : ''}
      ${formData.value.payment_due_date ? `
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:11px;color:#374151">Vencimiento</span>
        <span style="font-size:11px;font-weight:500;color:#0f172a">${formData.value.payment_due_date}</span>
      </div>` : ''}
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:11px;color:#374151">Moneda</span>
        <span style="font-size:11px;font-weight:500;color:#0f172a">${cur}${formData.value.exchange_rate !== 1 ? ` · T.C. ${formData.value.exchange_rate}` : ''}</span>
      </div>
      ${formData.value.tax_included ? `
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:11px;color:#374151">IVA</span>
        <span style="font-size:11px;font-weight:500;color:#0f172a">Incluido en precios</span>
      </div>` : ''}
    </div>
  </div>

  <!-- ── LINES TABLE ── -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
    <thead>
      <tr style="background:${accentColor}">
        <th style="color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:11px 14px;text-align:left">Descripción</th>
        <th style="color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:11px 14px;text-align:right">Cant.</th>
        <th style="color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:11px 14px;text-align:right">P. Unitario</th>
        <th style="color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:11px 14px;text-align:right">Importe</th>
        <th style="color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:11px 14px;text-align:right">Descuento</th>
        <th style="color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:11px 14px;text-align:right">IVA</th>
        <th style="color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:11px 14px;text-align:right;background:rgba(255,255,255,0.12)">Subtotal s/IVA</th>
        <th style="color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:11px 14px;text-align:right">Total c/IVA</th>
      </tr>
    </thead>
    <tbody>
      ${lineRows || `<tr><td colspan="8" style="text-align:center;padding:24px;color:#374151;font-size:13px">Sin líneas de orden</td></tr>`}
    </tbody>
  </table>

  <!-- ── TOTALS ── -->
  ${(() => {
    const grossAmt = Math.round((formData.value.amount_untaxed + formData.value.amount_discount) * 100) / 100
    const hasDisc = formData.value.amount_discount > 0
    const hasTax = formData.value.amount_tax > 0
    return `
  <div style="display:flex;justify-content:flex-end;margin-bottom:28px">
    <div style="width:340px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;font-size:13px">

      ${hasDisc ? `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid #f1f5f9;background:#fafafa">
        <span style="color:#1a202c">Importe bruto</span>
        <span style="font-weight:500">${formatCurrency(grossAmt, cur)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid #f1f5f9">
        <span style="color:#1a202c">Descuento total</span>
        <span style="font-weight:600;color:#dc2626">− ${formatCurrency(formData.value.amount_discount, cur)}</span>
      </div>` : ''}

      <div style="display:flex;justify-content:space-between;align-items:center;padding:11px 16px;border-bottom:1px solid #f1f5f9${hasDisc ? ';background:#f0fdf4' : ''}">
        <div>
          <div style="color:#1a202c">Subtotal s/IVA</div>
          ${hasDisc ? `<div style="font-size:10px;color:#16a34a;margin-top:1px">Importe bruto menos descuento</div>` : ''}
        </div>
        <span style="font-weight:600${hasDisc ? ';color:#15803d' : ''}">${formatCurrency(formData.value.amount_untaxed, cur)}</span>
      </div>

      ${hasTax ? `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid #f1f5f9">
        <span style="color:#1a202c">IVA (${formData.value.tax_rate}%)</span>
        <span style="font-weight:500">${formatCurrency(formData.value.amount_tax, cur)}</span>
      </div>` : ''}

      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;font-size:15px;font-weight:700;background:${accentColor};color:#fff">
        <div>
          <div>Total</div>
          ${hasTax ? `<div style="font-size:10px;font-weight:400;color:rgba(255,255,255,0.7);margin-top:1px">Subtotal + IVA</div>` : ''}
        </div>
        <span>${formatCurrency(formData.value.amount_total, cur)}</span>
      </div>
    </div>
  </div>`
  })()}

  <!-- ── NOTES & TERMS ── -->
  ${extrasHtml}

  <!-- ── FOOTER ── -->
  <div style="border-top:1px solid #e2e8f0;padding-top:14px;display:flex;justify-content:space-between;align-items:center">
    <div style="font-size:10px;color:#374151">${companyName}${formData.value.name ? ' · ' + formData.value.name : ''}</div>
    <div style="font-size:10px;color:#374151">Generado el ${today}</div>
  </div>

</div>
</body>
</html>`
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

const handlePrintOrder = () => printHtml(buildPrintableHtml())

const buildTicketHtml = () => {
  const co = selectedCompany.value
  const accentColor = co?.primary_color || '#2563eb'
  const companyName = co?.display_name || co?.name || ''
  const legalName = co?.legal_name && co.legal_name !== companyName ? co.legal_name : ''
  const companyAddress = [co?.street, co?.city, co?.state].filter(Boolean).join(', ')
  const cur = formData.value.currency
  const orderTypeLabel = orderTypeLabels[formData.value.order_type] || formData.value.order_type
  const stateLabel = stateLabels[formData.value.order_state] || formData.value.order_state
  const companyDesc = co?.description || ''

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—'

  const logoInitial = (companyName[0] || 'F').toUpperCase()
  const logoHtml = co?.logo_url
    ? `<img src="${co.logo_url}" alt="${companyName}" style="width:68px;height:68px;object-fit:contain;border-radius:6px;display:block;margin:0 auto 8px" />`
    : `<div style="width:68px;height:68px;border-radius:50%;background:${accentColor};color:#fff;font-size:24px;font-weight:800;line-height:68px;text-align:center;margin:0 auto 8px">${logoInitial}</div>`

  const lineRows = orderLines.value.map((line) => {
    const name = line.product_name?.trim() || line.description?.trim() || '—'
    const desc = line.description?.trim() && line.description.trim() !== name ? line.description.trim() : ''
    const grossLine = Math.round(line.quantity * line.unit_price * 100) / 100
    const hasLineDiscount = line.discount_amount > 0
    const hasLineTax = line.tax_amount > 0
    return `
      <div style="margin-bottom:12px;padding-bottom:10px;border-bottom:1px dotted #e2e8f0">
        <div style="font-size:12px;font-weight:700;color:#0f172a">${name}</div>
        ${desc ? `<div style="font-size:10px;color:#1a202c;margin-top:1px">${desc}</div>` : ''}
        <div style="display:flex;justify-content:space-between;margin-top:4px">
          <span style="font-size:11px;color:#1a202c">${line.quantity} × ${formatCurrency(line.unit_price, cur)}</span>
          <span style="font-size:11px;color:#1f2937">${formatCurrency(grossLine, cur)}</span>
        </div>
        ${hasLineDiscount ? `
        <div style="display:flex;justify-content:space-between;margin-top:2px">
          <span style="font-size:10px;color:#dc2626">Desc. ${line.discount_percent}%</span>
          <span style="font-size:10px;color:#dc2626;font-weight:600">−${formatCurrency(line.discount_amount, cur)}</span>
        </div>` : ''}
        ${hasLineDiscount || hasLineTax ? `
        <div style="display:flex;justify-content:space-between;margin-top:2px">
          <span style="font-size:10px;color:#1a202c">Subtotal s/IVA</span>
          <span style="font-size:10px;color:#0f172a;font-weight:600">${formatCurrency(line.subtotal, cur)}</span>
        </div>` : ''}
        ${hasLineTax ? `
        <div style="display:flex;justify-content:space-between;margin-top:2px">
          <span style="font-size:10px;color:#1a202c">IVA ${line.tax_rate}%</span>
          <span style="font-size:10px;color:#1f2937">+${formatCurrency(line.tax_amount, cur)}</span>
        </div>` : ''}
        <div style="display:flex;justify-content:flex-end;margin-top:4px">
          <span style="font-size:13px;font-weight:800;color:#0f172a">${formatCurrency(line.total, cur)}</span>
        </div>
      </div>`
  }).join('')

  const sep = `<div style="border-top:1px dashed #cbd5e1;margin:12px 0"></div>`
  const today = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Ticket ${formData.value.name || ''}</title>
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
    ${legalName ? `<div style="font-size:10px;color:#1a202c;margin-top:1px">${legalName}</div>` : ''}
    ${co?.vat ? `<div style="font-size:10px;color:#1a202c;margin-top:1px">RFC: ${co.vat}</div>` : ''}
    ${companyAddress ? `<div style="font-size:10px;color:#1a202c;margin-top:1px">${companyAddress}</div>` : ''}
    ${co?.phone ? `<div style="font-size:10px;color:#1a202c;margin-top:1px">${co.phone}</div>` : ''}
  </div>

  ${sep}

  <!-- Tipo y número -->
  <div style="text-align:center;margin-bottom:8px">
    <div style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:${accentColor}">${orderTypeLabel}</div>
    <div style="font-size:18px;font-weight:800;color:#0f172a;margin-top:2px">${formData.value.name || '—'}</div>
    <div style="display:inline-block;margin-top:5px;padding:2px 10px;border-radius:999px;font-size:10px;font-weight:700;background:${accentColor};color:#fff">${stateLabel}</div>
  </div>

  ${sep}

  <!-- Datos -->
  <div style="font-size:11px;margin-bottom:4px">
    <div style="display:flex;justify-content:space-between;margin-bottom:4px">
      <span style="color:#1a202c">${formData.value.order_type === 'sale' ? 'Cliente' : 'Proveedor'}</span>
      <span style="font-weight:600;text-align:right;max-width:55%">${formData.value.partner_name || '—'}</span>
    </div>
    ${formData.value.reference ? `
    <div style="display:flex;justify-content:space-between;margin-bottom:4px">
      <span style="color:#1a202c">Referencia</span>
      <span style="font-weight:600">${formData.value.reference}</span>
    </div>` : ''}
    <div style="display:flex;justify-content:space-between;margin-bottom:4px">
      <span style="color:#1a202c">Fecha</span>
      <span style="font-weight:600">${fmtDate(formData.value.order_date)}</span>
    </div>
    ${formData.value.delivery_date ? `
    <div style="display:flex;justify-content:space-between;margin-bottom:4px">
      <span style="color:#1a202c">Entrega</span>
      <span style="font-weight:600">${fmtDate(formData.value.delivery_date)}</span>
    </div>` : ''}
    ${formData.value.payment_term ? `
    <div style="display:flex;justify-content:space-between;margin-bottom:4px">
      <span style="color:#1a202c">Pago</span>
      <span style="font-weight:600">${formData.value.payment_term}</span>
    </div>` : ''}
  </div>

  ${sep}

  <!-- Líneas -->
  ${lineRows || `<div style="text-align:center;font-size:11px;color:#374151;padding:8px 0">Sin líneas</div>`}

  ${sep}

  <!-- Totales -->
  ${(() => {
    const grossAmt = Math.round((formData.value.amount_untaxed + formData.value.amount_discount) * 100) / 100
    const hasDisc = formData.value.amount_discount > 0
    const hasTax = formData.value.amount_tax > 0
    return `
  <div style="font-size:12px">
    ${hasDisc ? `
    <div style="display:flex;justify-content:space-between;margin-bottom:4px">
      <span style="color:#374151">Importe bruto</span>
      <span style="color:#1f2937">${formatCurrency(grossAmt, cur)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:4px">
      <span style="color:#dc2626">Descuento total</span>
      <span style="color:#dc2626;font-weight:700">−${formatCurrency(formData.value.amount_discount, cur)}</span>
    </div>
    <div style="border-top:1px dashed #cbd5e1;margin:6px 0"></div>` : ''}
    <div style="display:flex;justify-content:space-between;margin-bottom:4px${hasDisc ? ';font-weight:700' : ''}">
      <span style="color:#1a202c">Subtotal s/IVA</span>
      <span${hasDisc ? ' style="color:#15803d"' : ''}>${formatCurrency(formData.value.amount_untaxed, cur)}</span>
    </div>
    ${hasTax ? `
    <div style="display:flex;justify-content:space-between;margin-bottom:4px">
      <span style="color:#1a202c">IVA (${formData.value.tax_rate}%)</span>
      <span>+${formatCurrency(formData.value.amount_tax, cur)}</span>
    </div>` : ''}
  </div>

  <div style="display:flex;justify-content:space-between;margin-top:8px;padding:10px 0;border-top:2px solid #0f172a;border-bottom:2px solid #0f172a">
    <div>
      <div style="font-size:14px;font-weight:800">TOTAL</div>
      ${hasTax ? `<div style="font-size:9px;color:#1a202c;margin-top:1px">Subtotal + IVA</div>` : ''}
    </div>
    <span style="font-size:14px;font-weight:800">${formatCurrency(formData.value.amount_total, cur)}</span>
  </div>`
  })()}

  ${formData.value.notes || formData.value.terms ? sep : ''}

  ${formData.value.notes ? `
  <div style="font-size:10px;color:#1f2937;line-height:1.5;margin-bottom:8px;text-align:center;white-space:pre-line">${formData.value.notes}</div>` : ''}

  ${formData.value.terms ? `
  <div style="font-size:9px;color:#374151;line-height:1.4;text-align:center;white-space:pre-line">${formData.value.terms}</div>` : ''}

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

const handlePrintTicket = () => printHtml(buildTicketHtml())

const buildPosReceiptHtml = () => {
  const co = selectedCompany.value
  const company = co?.display_name || co?.name || ''
  const companyDesc = co?.description || ''
  const logoInitial = (company[0] || 'F').toUpperCase()
  const logoHtml = co?.logo_url
    ? `<img src="${co.logo_url}" alt="${company}" style="display:block;width:80px;height:80px;object-fit:contain;border-radius:6px;margin:0 auto 6px" />`
    : `<div style="width:64px;height:64px;border-radius:50%;background:#2563eb;color:#fff;font-size:24px;font-weight:800;line-height:64px;text-align:center;margin:0 auto 6px;font-family:sans-serif">${logoInitial}</div>`

  const cur = formData.value.currency

  const rows = orderLines.value.map(line => {
    const name = line.product_name?.trim() || line.description?.trim() || '—'
    const discStr = line.discount_percent > 0 ? ` (-${line.discount_percent}%)` : ''
    return `<tr>
      <td>${line.quantity} × ${name}${discStr}</td>
      <td style="text-align:right">${formatCurrency(line.total, cur)}</td>
    </tr>`
  }).join('')

  const paymentRow = formData.value.payment_method_name
    ? `<tr>
      <td>${formData.value.payment_method_name}</td>
      <td style="text-align:right">${formatCurrency(formData.value.amount_total, cur)}</td>
    </tr>`
    : ''

  const createdBy = auditFooter.createdBy !== '—' ? auditFooter.createdBy : ''

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${formData.value.name || 'Ticket'}</title>
    <style>
      body { font-family: 'Courier New', monospace; font-size: 12px; width: 280px; margin: 0 auto; padding: 12px; color: #111; }
      h1 { font-size: 14px; text-align: center; margin: 0 0 4px; }
      p { margin: 2px 0; text-align: center; }
      table { width: 100%; border-collapse: collapse; margin: 8px 0; }
      td { padding: 2px 0; vertical-align: top; }
      .sep { border-top: 1px dashed #111; margin: 6px 0; }
      .total { font-size: 16px; font-weight: bold; }
    </style></head><body>
    <div style="text-align:center;margin-bottom:8px">${logoHtml}</div>
    <h1>${company}</h1>
    <p>Ticket ${formData.value.name || '—'}</p>
    <p>${new Date().toLocaleString('es-MX')}</p>
    <p>Cliente: ${formData.value.partner_name || '—'}</p>
    ${createdBy ? `<p>Atendió: ${createdBy}</p>` : ''}
    <div class="sep"></div>
    <table>${rows || `<tr><td colspan="2" style="text-align:center">Sin líneas</td></tr>`}</table>
    <div class="sep"></div>
    <table>
      ${formData.value.amount_discount > 0 ? `<tr><td>Descuento</td><td style="text-align:right">-${formatCurrency(formData.value.amount_discount, cur)}</td></tr>` : ''}
      <tr><td>Subtotal</td><td style="text-align:right">${formatCurrency(formData.value.amount_untaxed, cur)}</td></tr>
      ${formData.value.amount_tax > 0 ? `<tr><td>Impuestos (${formData.value.tax_rate}%)</td><td style="text-align:right">${formatCurrency(formData.value.amount_tax, cur)}</td></tr>` : ''}
      <tr class="total"><td>TOTAL</td><td style="text-align:right">${formatCurrency(formData.value.amount_total, cur)}</td></tr>
    </table>
    ${paymentRow ? `<div class="sep"></div><table>${paymentRow}</table>` : ''}
    <div class="sep"></div>
    ${companyDesc ? `<p style="font-size:10px;color:#333;white-space:pre-line;margin:4px 0 8px;text-align:center">${companyDesc}</p>` : ''}
    <p>¡Gracias por su compra!</p>
    </body></html>`
}

const handlePrintPosTicket = () => printHtml(buildPosReceiptHtml())

const syncLines = async (id: string, companyId: string): Promise<boolean> => {
  const currentIds = new Set(orderLines.value.map((l) => l.id))

  for (const oldId of initialLineIds.value) {
    if (!currentIds.has(oldId)) {
      const ok = await deleteOrderLine(oldId)
      if (!ok) {
        return false
      }
    }
  }

  for (const line of orderLines.value) {
    const productId = line.product_id?.trim() || null
    const desc = line.description.trim() || line.product_name.trim() || 'Línea'

    if (initialLineIds.value.has(line.id)) {
      const updated = await updateOrderLine(line.id, {
        product_id: productId,
        description: desc,
        quantity: line.quantity,
        unit_price: line.unit_price,
        unit_cost: line.unit_cost,
        discount_percent: line.discount_percent,
        tax_rate: line.tax_rate,
        sequence: line.sequence
      })
      if (!updated) {
        return false
      }
    } else {
      const newId = await addOrderLineRpc({
        orderId: id,
        productId,
        description: desc,
        quantity: line.quantity,
        unitPrice: line.unit_price,
        unitCost: line.unit_cost,
        discountPercent: line.discount_percent,
        taxRate: line.tax_rate
      })
      if (!newId) {
        return false
      }
    }
  }

  return true
}

const handleSave = async () => {
  const id = orderId.value
  const companyId = selectedCompanyId.value
  if (!id || !companyId || !canEdit.value) return

  if (!formData.value.partner_id) {
    errorMessage.value = `Selecciona un ${formData.value.order_type === 'sale' ? 'cliente' : 'proveedor'}.`
    return
  }

  const invalidLine = orderLines.value.some(
    line => !line.description.trim() && !line.product_name.trim()
  )
  if (invalidLine) {
    errorMessage.value = 'Cada línea debe tener descripción o nombre de producto.'
    return
  }

  isLoading.value = true
  errorMessage.value = null

  try {
    const updated = await updateOrder(id, companyId, mapFormToOrderUpdate(formData.value))
    if (!updated) {
      errorMessage.value = 'No se pudo guardar la orden.'
      return
    }

    const linesOk = await syncLines(id, companyId)
    if (!linesOk) {
      errorMessage.value = 'Se guardó el encabezado pero hubo un error al sincronizar las líneas.'
      await loadOrder()
      return
    }

    await loadOrder()
    isEditing.value = false
  } finally {
    isLoading.value = false
  }
}

const handleCancelEdit = async () => {
  isEditing.value = false
  errorMessage.value = null
  await loadOrder()
}

const formatDate = (dateString: string | null): string => {
  if (!dateString) return '—'
  const date = new Date(dateString)
  return date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <div>
    <div
      v-if="errorMessage"
      class="mb-4 rounded-2xl border border-red-100 bg-red-50 px-6 py-4 text-red-700 whitespace-pre-line"
    >
      {{ errorMessage }}
    </div>

    <div
      v-if="
        stockShortageLines.length > 0
          && !isEditing
          && formData.order_state === 'draft'
          && formData.order_type === 'sale'
      "
      class="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-6 py-4 text-amber-950 shadow-sm shadow-amber-100/50"
    >
      <p class="font-semibold flex items-start gap-2">
        <svg class="w-5 h-5 shrink-0 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        Inventario insuficiente para confirmar esta venta
      </p>
      <ul class="mt-3 list-disc pl-5 text-sm leading-relaxed space-y-1.5">
        <li v-for="row in stockShortageLines" :key="row.product_id">
          <span class="font-medium">{{ row.product_name }}</span>:
          piden {{ row.requested }}, disponibles {{ row.available }}
        </li>
      </ul>
      <p class="mt-3 text-xs text-amber-900/85">
        Aumenta stock en el catálogo, reduce cantidades en las líneas o elimina productos antes de usar «Confirmar orden».
      </p>
    </div>

    <CardSheet
      :title="formData.name || 'Orden'"
      :subtitle="`${orderTypeLabels[formData.order_type] || formData.order_type} — ${formData.partner_name || 'Sin socio'}`"
      :show-back-button="true"
      :show-options-button="menuOptions.length > 0"
      :show-edit-button="canEdit"
      :show-footer="true"
      :is-editing="isEditing"
      :is-loading="isLoading"
      :created-by="auditFooter.createdBy"
      :created-at="formatDate(auditFooter.createdAt)"
      :updated-by="auditFooter.updatedBy"
      :updated-at="formatDate(auditFooter.updatedAt)"
      :menu-options="menuOptions"
      variant="elevated"
      padding="lg"
      :full-height="false"
      @back="handleBack"
      @edit="handleEdit"
      @save="handleSave"
      @cancel="handleCancelEdit"
    >
      <template #status>
        <div class="flex flex-wrap items-center gap-2">
          <BadgeApp
            :label="orderTypeLabels[formData.order_type] || formData.order_type"
            :variant="formData.order_type === 'sale' ? 'primary' : 'warning'"
          />
          <BadgeApp
            :label="stateLabels[formData.order_state] || formData.order_state"
            :variant="stateVariants[formData.order_state] || 'secondary'"
          />
          <BadgeApp
            v-if="orderOrigin !== 'dashboard'"
            :label="originLabels[orderOrigin] || orderOrigin"
            variant="primary"
          />
          <BadgeApp
            v-if="formData.is_paid"
            label="Pagada"
            variant="success"
          />
          <BadgeApp
            v-if="formData.is_delivered"
            label="Entregada"
            variant="success"
          />
          <BadgeApp
            v-if="formData.is_invoiced"
            label="Facturada"
            variant="primary"
          />
        </div>
      </template>

      <!-- Datos del cliente de la tienda en línea -->
      <div
        v-if="storefrontInfo"
        class="mb-6 rounded-2xl border border-violet-100 bg-violet-50/60 px-6 py-4"
      >
        <p class="text-xs font-semibold text-violet-700 uppercase tracking-wide mb-2">
          Compra desde la tienda en línea
        </p>
        <div class="flex flex-wrap gap-x-8 gap-y-1.5 text-sm text-slate-700">
          <span v-if="storefrontInfo.customerName">
            <span class="text-slate-400">Cliente:</span> {{ storefrontInfo.customerName }}
          </span>
          <span v-if="storefrontInfo.customerEmail">
            <span class="text-slate-400">Email:</span> {{ storefrontInfo.customerEmail }}
          </span>
          <span v-if="storefrontInfo.customerPhone">
            <span class="text-slate-400">Teléfono:</span> {{ storefrontInfo.customerPhone }}
          </span>
          <span v-if="storefrontInfo.shippingMethodName">
            <span class="text-slate-400">Envío:</span> {{ storefrontInfo.shippingMethodName }}
          </span>
          <span v-if="storefrontInfo.couponCode">
            <span class="text-slate-400">Cupón:</span> {{ storefrontInfo.couponCode }}
          </span>
        </div>
      </div>

      <OrderForm
        v-model="formData"
        v-model:lines="orderLines"
        :readonly="!isEditing"
        :partner-options="partnerOptions"
        :project-options="projectOptions"
        :payment-method-options="paymentMethodOptions"
        :company-id="selectedCompanyId"
      />
    </CardSheet>

    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showPaymentModal"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          @click.self="closePaymentModal"
        >
          <Transition
            appear
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0 scale-95 translate-y-2"
            enter-to-class="opacity-100 scale-100 translate-y-0"
          >
            <div class="w-full max-w-md rounded-2xl bg-white shadow-2xl shadow-slate-900/20 border border-slate-100 overflow-hidden">
              <div class="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 to-violet-50/60 flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <h3 class="text-lg font-semibold text-slate-900">
                    Registrar pago
                  </h3>
                  <p class="mt-1 text-sm text-slate-500">
                    Selecciona el método de pago para marcar esta orden como pagada.
                  </p>
                </div>
                <button
                  type="button"
                  class="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-slate-800 transition-colors"
                  :disabled="isLoading"
                  aria-label="Cerrar"
                  @click="closePaymentModal"
                >
                  <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form class="px-6 py-6 space-y-5" @submit.prevent="handleConfirmPayment">
                <FormSelect
                  v-model="selectedPaymentMethodId"
                  label="Método de pago"
                  placeholder="Selecciona un método de pago"
                  :options="paymentMethodOptions"
                  required
                  :disabled="isLoading"
                  size="md"
                />

                <p
                  v-if="paymentMethodOptions.length === 0"
                  class="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800"
                >
                  No hay métodos de pago configurados. Crea uno antes de registrar el pago.
                </p>

                <div class="flex items-center justify-end gap-3 pt-2">
                  <BtnApp variant="ghost" type="button" :disabled="isLoading" @click="closePaymentModal">
                    Cancelar
                  </BtnApp>
                  <BtnApp
                    variant="primary"
                    type="submit"
                    :disabled="isLoading || !selectedPaymentMethodId"
                  >
                    {{ isLoading ? 'Procesando…' : 'Confirmar pago' }}
                  </BtnApp>
                </div>
              </form>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
