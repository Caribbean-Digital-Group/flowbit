<script setup lang="ts">
import type { Database, Tables } from '~/types/database.types'

definePageMeta({ layout: 'pos' })

type PosSession = Tables<'pos_session'>
type PosRegister = Tables<'pos_register'>
type PaymentMethod = Tables<'payment_method'>
type Partner = Tables<'partner'>
type ProductView = Database['public']['Views']['v_products']['Row']
type OrderRowView = Database['public']['Views']['v_orders']['Row']
type OrderLine = Tables<'order_line'>

interface TicketLine {
  key: string
  product_id: string | null
  description: string
  quantity: number
  unit_price: number
  unit_cost: number
  discount_percent: number
  tax_rate: number
  is_stockable: boolean
  stock_quantity: number
  stock_min: number
  sku: string | null
}

interface HeldTicket {
  id: string
  savedAt: string
  partnerId: string | null
  partnerName: string
  lines: TicketLine[]
}

interface PaymentEntry {
  payment_method_id: string
  method_name: string
  is_cash: boolean
  amount: number
  tendered: number | null
  change_amount: number
}

interface LastSale {
  orderName: string
  total: number
  change: number
  printableHtml: string
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const { getById: getRegisterById } = usePosRegister()
const { getSessionSummary, addCashMovement } = usePosSession()
const { registerSale, registerRefund } = usePosSale()
const { getSellableProductViews, getProductByBarcode } = useProduct()
const { getAllByCompany: getPaymentMethods } = usePaymentMethod()
const { getPartnersByCompany, createPartner } = usePartner()
const { getOrderLinesByOrderId } = useOrderLine()

const supabase = useSupabase()

const companyId = computed(() => authStore.selectedCompanyId ?? '')
const currentRole = computed(() =>
  authStore.companies.find(c => c.company.id === companyId.value)?.role ?? 'member'
)
const isAdmin = computed(() => ['owner', 'admin'].includes(currentRole.value))

// ── Estado de sesión ─────────────────────────────────────────────────────────
const isLoading = ref(true)
const session = ref<PosSession | null>(null)
const register = ref<PosRegister | null>(null)
const sessionId = computed(() => String(route.query.session ?? ''))

// ── Catálogo ─────────────────────────────────────────────────────────────────
const products = ref<ProductView[]>([])
const paymentMethods = ref<PaymentMethod[]>([])
const partners = ref<Partner[]>([])

const activeCategory = ref<string>('all')
const categories = computed(() => {
  const map = new Map<string, string>()
  for (const p of products.value) {
    if (p.category_id && p.category_name) map.set(p.category_id, p.category_name)
  }
  return [...map.entries()].map(([id, name]) => ({ id, name }))
})

const quickProducts = computed(() => {
  const base = activeCategory.value === 'all'
    ? products.value
    : products.value.filter(p => p.category_id === activeCategory.value)
  return base.slice(0, 60)
})

// ── Ticket ───────────────────────────────────────────────────────────────────
const ticketLines = ref<TicketLine[]>([])
const selectedLineIndex = ref(-1)
const highlightedLineKey = ref('')
const customerId = ref<string | null>(null)
const customerName = ref('Público general')
const heldTickets = ref<HeldTicket[]>([])

const ticketStorageKey = computed(() => `flowbit:pos:ticket:${sessionId.value}`)
const heldStorageKey = computed(() => `flowbit:pos:held:${sessionId.value}`)

// ── Búsqueda ─────────────────────────────────────────────────────────────────
const searchInputRef = ref<HTMLInputElement | null>(null)
const searchQuery = ref('')
const searchResults = ref<ProductView[]>([])
const searchHighlight = ref(0)
const isSearching = ref(false)

// ── Modales / overlays ───────────────────────────────────────────────────────
const showPayment = ref(false)
const showCustomer = ref(false)
const showMovement = ref(false)
const showDiscount = ref(false)
const showHeld = ref(false)
const showRefund = ref(false)
const showHelp = ref(false)
const lastSale = ref<LastSale | null>(null)

const anyModalOpen = computed(() =>
  showPayment.value || showCustomer.value || showMovement.value || showDiscount.value
  || showHeld.value || showRefund.value || showHelp.value || Boolean(lastSale.value)
)

// ── Cobro ────────────────────────────────────────────────────────────────────
const payments = ref<PaymentEntry[]>([])
const activeMethodId = ref<string | null>(null)
const paymentAmount = ref<number>(0)
const tenderedAmount = ref<number>(0)
const isCharging = ref(false)
const paymentError = ref('')

// ── Cliente ──────────────────────────────────────────────────────────────────
const customerSearch = ref('')
const showQuickCreate = ref(false)
const quickCreateName = ref('')
const quickCreateContact = ref('')
const customerError = ref('')
const isCreatingCustomer = ref(false)

// ── Movimiento de efectivo ───────────────────────────────────────────────────
const movementType = ref<'in' | 'out'>('in')
const movementAmount = ref<number>(0)
const movementReason = ref('')
const movementError = ref('')
const isSavingMovement = ref(false)

// ── Descuento ────────────────────────────────────────────────────────────────
const discountScope = ref<'line' | 'ticket'>('ticket')
const discountMode = ref<'percent' | 'amount'>('percent')
const discountValue = ref<number>(0)
const discountError = ref('')

// ── Devolución ───────────────────────────────────────────────────────────────
const refundFolio = ref('')
const refundOrder = ref<OrderRowView | null>(null)
const refundLines = ref<(OrderLine & { refund_qty: number })[]>([])
const refundMethodId = ref<string | null>(null)
const refundReason = ref('')
const refundError = ref('')
const isRefunding = ref(false)
const isSearchingRefund = ref(false)

// ── Notificaciones efímeras ──────────────────────────────────────────────────
const toasts = ref<{ id: number; message: string; tone: 'success' | 'error' | 'warning' }[]>([])
let toastSeq = 0

const notify = (message: string, tone: 'success' | 'error' | 'warning' = 'success'): void => {
  const id = ++toastSeq
  toasts.value.push({ id, message, tone })
  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }, 3200)
}

// ── Reloj ────────────────────────────────────────────────────────────────────
const clock = ref('')
let clockTimer: ReturnType<typeof setInterval> | null = null

// ── Formato ──────────────────────────────────────────────────────────────────
const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value || 0)

// ── Totales (réplica de las fórmulas SQL) ────────────────────────────────────
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

const lineAmounts = (line: TicketLine) => {
  const gross = line.quantity * line.unit_price
  const discount = round2(gross * line.discount_percent / 100)
  const subtotal = round2(gross - discount)
  const tax = round2(subtotal * line.tax_rate / 100)
  return { discount, subtotal, tax, total: subtotal + tax }
}

const ticketTotals = computed(() => {
  let subtotal = 0
  let discount = 0
  let tax = 0
  let total = 0
  for (const line of ticketLines.value) {
    const a = lineAmounts(line)
    subtotal += a.subtotal
    discount += a.discount
    tax += a.tax
    total += a.total
  }
  return {
    subtotal: round2(subtotal),
    discount: round2(discount),
    tax: round2(tax),
    total: round2(total)
  }
})

const paymentsTotal = computed(() =>
  round2(payments.value.reduce((sum, p) => sum + p.amount, 0))
)
const remainingDue = computed(() => round2(ticketTotals.value.total - paymentsTotal.value))
const totalChange = computed(() =>
  round2(payments.value.reduce((sum, p) => sum + p.change_amount, 0))
)

const activeMethod = computed(() =>
  paymentMethods.value.find(m => m.id === activeMethodId.value) ?? null
)
const isActiveMethodCash = computed(() => Boolean(activeMethod.value?.is_cash))

// Cambio en vivo mientras el cajero captura el monto recibido en efectivo
const liveChange = computed(() => {
  if (!isActiveMethodCash.value) return 0
  const tendered = round2(Number(tenderedAmount.value) || 0)
  if (tendered <= 0 || remainingDue.value <= 0) return 0
  return round2(Math.max(tendered - remainingDue.value, 0))
})

// ── Persistencia local del ticket ────────────────────────────────────────────
const persistTicket = (): void => {
  if (typeof window === 'undefined' || !sessionId.value) return
  try {
    window.localStorage.setItem(ticketStorageKey.value, JSON.stringify({
      lines: ticketLines.value,
      partnerId: customerId.value,
      partnerName: customerName.value
    }))
  } catch { /* almacenamiento lleno o modo privado */ }
}

const restoreTicket = (): void => {
  if (typeof window === 'undefined' || !sessionId.value) return
  try {
    const raw = window.localStorage.getItem(ticketStorageKey.value)
    if (!raw) return
    const data = JSON.parse(raw) as { lines?: TicketLine[]; partnerId?: string | null; partnerName?: string }
    if (Array.isArray(data.lines)) ticketLines.value = data.lines
    if (data.partnerId !== undefined) customerId.value = data.partnerId
    if (data.partnerName) customerName.value = data.partnerName
  } catch { /* dato corrupto: empezar limpio */ }
}

const persistHeld = (): void => {
  if (typeof window === 'undefined' || !sessionId.value) return
  try {
    window.localStorage.setItem(heldStorageKey.value, JSON.stringify(heldTickets.value))
  } catch { /* ignore */ }
}

const restoreHeld = (): void => {
  if (typeof window === 'undefined' || !sessionId.value) return
  try {
    const raw = window.localStorage.getItem(heldStorageKey.value)
    if (raw) heldTickets.value = JSON.parse(raw) as HeldTicket[]
  } catch { /* ignore */ }
}

watch(ticketLines, persistTicket, { deep: true })
watch([customerId, customerName], persistTicket)

// ── Manejo de líneas ─────────────────────────────────────────────────────────
const qtyInTicket = (productId: string): number =>
  ticketLines.value
    .filter(l => l.product_id === productId)
    .reduce((sum, l) => sum + l.quantity, 0)

const qtyMultiplier = ref(1)

const addProduct = (product: ProductView, quantity?: number): void => {
  const qty = quantity ?? qtyMultiplier.value
  qtyMultiplier.value = 1

  if (!product.id) return

  const stockable = product.is_stockable !== false && product.product_type === 'product'
  const stock = Number(product.stock_quantity ?? 0)

  if (stockable && qtyInTicket(product.id) + qty > stock) {
    notify(`Stock insuficiente para ${product.name} (disponible: ${stock})`, 'error')
    return
  }

  const existing = ticketLines.value.find(
    l => l.product_id === product.id && l.discount_percent === 0
  )

  if (existing) {
    existing.quantity = round2(existing.quantity + qty)
    highlightedLineKey.value = existing.key
    selectedLineIndex.value = ticketLines.value.indexOf(existing)
  } else {
    const line: TicketLine = {
      key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      product_id: product.id,
      description: product.display_name || product.name || 'Artículo',
      quantity: qty,
      unit_price: Number(product.sale_price ?? 0),
      unit_cost: Number(product.cost_price ?? 0),
      discount_percent: 0,
      tax_rate: Number(product.tax_rate ?? 0),
      is_stockable: stockable,
      stock_quantity: stock,
      stock_min: Number(product.stock_min ?? 0),
      sku: product.sku ?? null
    }
    ticketLines.value.push(line)
    highlightedLineKey.value = line.key
    selectedLineIndex.value = ticketLines.value.length - 1
  }

  setTimeout(() => { highlightedLineKey.value = '' }, 800)
  clearSearch()
  focusSearch()
}

const changeLineQty = (index: number, delta: number): void => {
  const line = ticketLines.value[index]
  if (!line) return

  const next = round2(line.quantity + delta)
  if (next <= 0) {
    removeLine(index)
    return
  }

  if (line.is_stockable && line.product_id) {
    const others = qtyInTicket(line.product_id) - line.quantity
    if (others + next > line.stock_quantity) {
      notify(`Stock insuficiente (disponible: ${line.stock_quantity})`, 'error')
      return
    }
  }

  line.quantity = next
}

const setLineQty = (index: number, value: number): void => {
  const line = ticketLines.value[index]
  if (!line) return

  const qty = Number(value)
  if (!Number.isFinite(qty) || qty <= 0) return

  if (line.is_stockable && line.product_id) {
    const others = qtyInTicket(line.product_id) - line.quantity
    if (others + qty > line.stock_quantity) {
      notify(`Stock insuficiente (disponible: ${line.stock_quantity})`, 'error')
      return
    }
  }

  line.quantity = round2(qty)
}

const removeLine = (index: number): void => {
  ticketLines.value.splice(index, 1)
  if (selectedLineIndex.value >= ticketLines.value.length) {
    selectedLineIndex.value = ticketLines.value.length - 1
  }
}

const clearTicket = (confirmFirst = true): void => {
  if (confirmFirst && ticketLines.value.length > 0) {
    if (!window.confirm('¿Descartar el ticket completo?')) return
  }
  ticketLines.value = []
  selectedLineIndex.value = -1
  resetCustomer()
  focusSearch()
}

const resetCustomer = (): void => {
  customerId.value = register.value?.default_partner_id ?? null
  customerName.value = 'Público general'
}

// ── Tickets en espera ────────────────────────────────────────────────────────
const holdTicket = (): void => {
  if (ticketLines.value.length === 0) {
    showHeld.value = true
    return
  }

  heldTickets.value.push({
    id: `${Date.now()}`,
    savedAt: new Date().toISOString(),
    partnerId: customerId.value,
    partnerName: customerName.value,
    lines: JSON.parse(JSON.stringify(ticketLines.value)) as TicketLine[]
  })
  persistHeld()
  ticketLines.value = []
  resetCustomer()
  notify('Ticket puesto en espera')
  focusSearch()
}

const resumeTicket = (held: HeldTicket): void => {
  if (ticketLines.value.length > 0) {
    notify('Pon en espera o descarta el ticket actual primero', 'warning')
    return
  }
  ticketLines.value = held.lines
  customerId.value = held.partnerId
  customerName.value = held.partnerName
  heldTickets.value = heldTickets.value.filter(h => h.id !== held.id)
  persistHeld()
  showHeld.value = false
  focusSearch()
}

const discardHeld = (held: HeldTicket): void => {
  heldTickets.value = heldTickets.value.filter(h => h.id !== held.id)
  persistHeld()
}

// ── Búsqueda de productos ────────────────────────────────────────────────────
const focusSearch = (): void => {
  nextTick(() => searchInputRef.value?.focus())
}

const clearSearch = (): void => {
  searchQuery.value = ''
  searchResults.value = []
  searchHighlight.value = 0
}

const normalizedQuery = computed(() => {
  // Soporta el prefijo "3*" para multiplicar cantidad
  const match = searchQuery.value.match(/^\s*(\d+(?:\.\d+)?)\s*\*\s*(.*)$/)
  return match ? (match[2] ?? '') : searchQuery.value
})

const parseMultiplier = (): number => {
  const match = searchQuery.value.match(/^\s*(\d+(?:\.\d+)?)\s*\*/)
  return match ? Number(match[1]) : 1
}

let searchDebounce: ReturnType<typeof setTimeout> | null = null

watch(searchQuery, () => {
  if (searchDebounce) clearTimeout(searchDebounce)

  const term = normalizedQuery.value.trim()
  if (term.length < 2) {
    searchResults.value = []
    return
  }

  searchDebounce = setTimeout(() => { runSearch(term) }, 180)
})

const runSearch = (term: string): void => {
  const lower = term.toLowerCase()
  searchResults.value = products.value
    .filter(p =>
      (p.name ?? '').toLowerCase().includes(lower)
      || (p.display_name ?? '').toLowerCase().includes(lower)
      || (p.sku ?? '').toLowerCase().includes(lower)
      || (p.barcode ?? '').toLowerCase().includes(lower)
      || (p.internal_ref ?? '').toLowerCase().includes(lower)
    )
    .slice(0, 12)
  searchHighlight.value = 0
}

const submitSearch = async (): Promise<void> => {
  const term = normalizedQuery.value.trim()
  const multiplier = parseMultiplier()

  if (!term) return

  // 1. Coincidencia exacta por código de barras o SKU (flujo de escáner)
  const exact = products.value.find(
    p => p.barcode === term || p.sku === term
  )
  if (exact) {
    addProduct(exact, multiplier)
    return
  }

  // 2. Resultado resaltado de la búsqueda parcial
  if (searchResults.value.length > 0) {
    const target = searchResults.value[searchHighlight.value] ?? searchResults.value[0]
    if (target) addProduct(target, multiplier)
    return
  }

  // 3. Consulta remota por barcode (catálogo fuera de los precargados)
  isSearching.value = true
  const remote = await getProductByBarcode(companyId.value, term)
  isSearching.value = false

  if (remote && remote.can_be_sold !== false) {
    addProduct({
      ...remote,
      category_name: null,
      uom_name: null,
      uom_code: null,
      purchase_uom_name: null,
      purchase_uom_code: null,
      supplier_name: null,
      company_name: null
    } as ProductView, multiplier)
    return
  }

  notify(`Sin resultados para "${term}"`, 'warning')
}

const onSearchKeydown = (e: KeyboardEvent): void => {
  if (e.key === 'Enter') {
    e.preventDefault()
    e.stopPropagation()
    submitSearch()
  } else if (e.key === 'ArrowDown' && searchResults.value.length > 0) {
    e.preventDefault()
    e.stopPropagation()
    searchHighlight.value = Math.min(searchHighlight.value + 1, searchResults.value.length - 1)
  } else if (e.key === 'ArrowUp' && searchResults.value.length > 0) {
    e.preventDefault()
    e.stopPropagation()
    searchHighlight.value = Math.max(searchHighlight.value - 1, 0)
  } else if (e.key === 'Escape') {
    clearSearch()
  }
}

// ── Descuentos ───────────────────────────────────────────────────────────────
const maxDiscountAllowed = computed(() =>
  isAdmin.value ? 100 : Number(register.value?.max_discount_percent ?? 100)
)

const openDiscount = (): void => {
  discountScope.value = selectedLineIndex.value >= 0 ? 'line' : 'ticket'
  discountMode.value = 'percent'
  discountValue.value = 0
  discountError.value = ''
  showDiscount.value = true
}

const applyDiscount = (): void => {
  discountError.value = ''
  const value = Number(discountValue.value)

  if (!Number.isFinite(value) || value < 0) {
    discountError.value = 'Valor de descuento inválido.'
    return
  }

  const computePercent = (gross: number): number => {
    if (discountMode.value === 'percent') return value
    if (gross <= 0) return 0
    return round2(Math.min(value / gross, 1) * 100)
  }

  if (discountScope.value === 'line') {
    const line = ticketLines.value[selectedLineIndex.value]
    if (!line) {
      discountError.value = 'Selecciona una línea del ticket.'
      return
    }
    const percent = computePercent(line.quantity * line.unit_price)
    if (percent > maxDiscountAllowed.value) {
      discountError.value = `Tu límite de descuento es ${maxDiscountAllowed.value}%. Requiere autorización de un supervisor.`
      return
    }
    line.discount_percent = round2(Math.min(percent, 100))
  } else {
    const gross = ticketLines.value.reduce((s, l) => s + l.quantity * l.unit_price, 0)
    const percent = computePercent(gross)
    if (percent > maxDiscountAllowed.value) {
      discountError.value = `Tu límite de descuento es ${maxDiscountAllowed.value}%. Requiere autorización de un supervisor.`
      return
    }
    for (const line of ticketLines.value) {
      line.discount_percent = round2(Math.min(percent, 100))
    }
  }

  showDiscount.value = false
  focusSearch()
}

// ── Cliente ──────────────────────────────────────────────────────────────────
const filteredCustomers = computed(() => {
  const term = customerSearch.value.trim().toLowerCase()
  if (!term) return partners.value.slice(0, 20)
  return partners.value
    .filter(p =>
      (p.name ?? '').toLowerCase().includes(term)
      || (p.display_name ?? '').toLowerCase().includes(term)
      || (p.email ?? '').toLowerCase().includes(term)
      || (p.phone ?? '').toLowerCase().includes(term)
      || (p.vat ?? '').toLowerCase().includes(term)
    )
    .slice(0, 20)
})

const selectCustomer = (partner: Partner): void => {
  customerId.value = partner.id
  customerName.value = partner.display_name || partner.name
  showCustomer.value = false
  focusSearch()
}

const quickCreateCustomer = async (): Promise<void> => {
  customerError.value = ''
  const name = quickCreateName.value.trim()
  if (!name) {
    customerError.value = 'El nombre es obligatorio.'
    return
  }

  isCreatingCustomer.value = true
  const contact = quickCreateContact.value.trim()
  const isEmail = contact.includes('@')

  const partner = await createPartner(companyId.value, {
    name,
    display_name: name,
    email: isEmail ? contact : null,
    phone: !isEmail && contact ? contact : null,
    company_type: 'person',
    active: true
  })
  isCreatingCustomer.value = false

  if (!partner) {
    customerError.value = 'No se pudo crear el cliente (requiere permisos de administrador).'
    return
  }

  partners.value.unshift(partner)
  selectCustomer(partner)
  showQuickCreate.value = false
  quickCreateName.value = ''
  quickCreateContact.value = ''
  notify('Cliente creado')
}

// ── Cobro ────────────────────────────────────────────────────────────────────
const openPayment = (): void => {
  if (ticketLines.value.length === 0) {
    notify('No se puede cobrar un ticket vacío', 'warning')
    return
  }
  if (!customerId.value) {
    notify('Asocia un cliente o configura un cliente por defecto en la caja (F3)', 'warning')
    showCustomer.value = true
    return
  }
  payments.value = []
  paymentError.value = ''
  const cash = paymentMethods.value.find(m => m.is_cash)
  activeMethodId.value = cash?.id ?? paymentMethods.value[0]?.id ?? null
  paymentAmount.value = ticketTotals.value.total
  tenderedAmount.value = 0
  showPayment.value = true
}

const selectMethod = (methodId: string): void => {
  activeMethodId.value = methodId
  paymentAmount.value = remainingDue.value > 0 ? remainingDue.value : 0
  tenderedAmount.value = 0
}

const setTendered = (value: number): void => {
  tenderedAmount.value = round2(value)
}

const addDenomination = (value: number): void => {
  tenderedAmount.value = round2((tenderedAmount.value || 0) + value)
}

const addPaymentEntry = (): void => {
  paymentError.value = ''
  const method = activeMethod.value
  if (!method) return

  let amount = round2(Number(paymentAmount.value))
  let tendered: number | null = null
  let change = 0

  if (method.is_cash) {
    tendered = round2(Number(tenderedAmount.value))
    if (tendered <= 0) {
      paymentError.value = 'Captura el monto recibido en efectivo.'
      return
    }
    amount = Math.min(tendered, remainingDue.value)
    change = round2(tendered - amount)
  } else {
    if (amount <= 0) {
      paymentError.value = 'El monto debe ser mayor a cero.'
      return
    }
    if (amount > remainingDue.value) {
      amount = remainingDue.value
    }
  }

  if (amount <= 0) {
    paymentError.value = 'El ticket ya está cubierto.'
    return
  }

  payments.value.push({
    payment_method_id: method.id,
    method_name: method.name,
    is_cash: Boolean(method.is_cash),
    amount,
    tendered,
    change_amount: change
  })

  paymentAmount.value = remainingDue.value > 0 ? remainingDue.value : 0
  tenderedAmount.value = 0
}

const removePaymentEntry = (index: number): void => {
  payments.value.splice(index, 1)
  paymentAmount.value = remainingDue.value > 0 ? remainingDue.value : 0
}

const confirmSale = async (): Promise<void> => {
  if (isCharging.value || remainingDue.value > 0.009) return
  if (!customerId.value) return

  isCharging.value = true
  paymentError.value = ''

  const linesSnapshot = JSON.parse(JSON.stringify(ticketLines.value)) as TicketLine[]
  const paymentsSnapshot = JSON.parse(JSON.stringify(payments.value)) as PaymentEntry[]
  const customerSnapshot = customerName.value
  const totals = { ...ticketTotals.value }

  const { result, errorMessage } = await registerSale({
    sessionId: sessionId.value,
    partnerId: customerId.value,
    lines: linesSnapshot.map(l => ({
      product_id: l.product_id,
      description: l.description,
      quantity: l.quantity,
      unit_price: l.unit_price,
      unit_cost: l.unit_cost,
      discount_percent: l.discount_percent,
      tax_rate: l.tax_rate
    })),
    payments: paymentsSnapshot.map(p => ({
      payment_method_id: p.payment_method_id,
      amount: p.amount,
      tendered: p.tendered,
      change_amount: p.change_amount
    }))
  })

  isCharging.value = false

  if (!result) {
    paymentError.value = errorMessage ?? 'No se pudo registrar la venta.'
    return
  }

  const change = paymentsSnapshot.reduce((s, p) => s + p.change_amount, 0)

  lastSale.value = {
    orderName: result.order_name,
    total: result.amount_total,
    change: round2(change),
    printableHtml: buildReceiptHtml({
      orderName: result.order_name,
      lines: linesSnapshot,
      payments: paymentsSnapshot,
      totals,
      customer: customerSnapshot,
      change: round2(change)
    })
  }

  showPayment.value = false
  ticketLines.value = []
  selectedLineIndex.value = -1
  resetCustomer()
  refreshProducts()
}

const startNextSale = (): void => {
  lastSale.value = null
  focusSearch()
}

// ── Impresión ────────────────────────────────────────────────────────────────
const printHtml = (html: string): void => {
  const win = window.open('', '_blank', 'width=420,height=640')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print() }, 250)
}

const buildReceiptHtml = (params: {
  orderName: string
  lines: TicketLine[]
  payments: PaymentEntry[]
  totals: { subtotal: number; discount: number; tax: number; total: number }
  customer: string
  change: number
}): string => {
  const co = authStore.selectedCompany
  const company = co?.name ?? 'Flowbit'
  const companyDesc = co?.description || ''
  const logoInitial = (company[0] || 'F').toUpperCase()
  const logoHtml = co?.logo_url
    ? `<img src="${co.logo_url}" alt="${company}" style="display:block;width:80px;height:80px;object-fit:contain;border-radius:6px;margin:0 auto 6px" />`
    : `<div style="width:64px;height:64px;border-radius:50%;background:#2563eb;color:#fff;font-size:24px;font-weight:800;line-height:64px;text-align:center;margin:0 auto 6px;font-family:sans-serif">${logoInitial}</div>`
  const rows = params.lines.map(l => {
    const a = lineAmounts(l)
    return `<tr>
      <td>${l.quantity} × ${l.description}${l.discount_percent > 0 ? ` (-${l.discount_percent}%)` : ''}</td>
      <td style="text-align:right">${formatCurrency(a.total)}</td>
    </tr>`
  }).join('')
  const pays = params.payments.map(p => {
    const base = `<tr>
      <td>${p.method_name}</td>
      <td style="text-align:right">${formatCurrency(p.amount)}</td>
    </tr>`
    const received = p.is_cash && p.tendered
      ? `<tr>
      <td>Recibido</td>
      <td style="text-align:right">${formatCurrency(p.tendered)}</td>
    </tr>`
      : ''
    return base + received
  }).join('')

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${params.orderName}</title>
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
    <p>Ticket ${params.orderName}</p>
    <p>${new Date().toLocaleString('es-MX')}</p>
    <p>Cliente: ${params.customer}</p>
    <p>Atendió: ${authStore.partnerDisplayName}</p>
    <div class="sep"></div>
    <table>${rows}</table>
    <div class="sep"></div>
    <table>
      <tr><td>Subtotal</td><td style="text-align:right">${formatCurrency(params.totals.subtotal)}</td></tr>
      ${params.totals.discount > 0 ? `<tr><td>Descuento</td><td style="text-align:right">-${formatCurrency(params.totals.discount)}</td></tr>` : ''}
      <tr><td>Impuestos</td><td style="text-align:right">${formatCurrency(params.totals.tax)}</td></tr>
      <tr class="total"><td>TOTAL</td><td style="text-align:right">${formatCurrency(params.totals.total)}</td></tr>
    </table>
    <div class="sep"></div>
    <table>${pays}
      ${params.change > 0 ? `<tr class="total"><td>CAMBIO</td><td style="text-align:right">${formatCurrency(params.change)}</td></tr>` : ''}
    </table>
    <div class="sep"></div>
    ${companyDesc ? `<p style="font-size:10px;color:#333;white-space:pre-line;margin:4px 0 8px;text-align:center">${companyDesc}</p>` : ''}
    <p>¡Gracias por su compra!</p>
    </body></html>`
}

const printCorteX = async (): Promise<void> => {
  const summary = await getSessionSummary(sessionId.value)
  if (!summary) {
    notify('No se pudo generar el corte X', 'error')
    return
  }

  const methodRows = summary.methods.map(m => `<tr>
      <td>${m.name}</td>
      <td style="text-align:right">${formatCurrency(m.sales_amount)}</td>
      <td style="text-align:right">-${formatCurrency(m.refunds_amount)}</td>
      <td style="text-align:right">${formatCurrency(m.expected)}</td>
    </tr>`).join('')

  printHtml(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Corte X — ${summary.session_name}</title>
    <style>
      body { font-family: 'Courier New', monospace; font-size: 12px; width: 300px; margin: 0 auto; padding: 12px; color: #111; }
      h1 { font-size: 14px; text-align: center; margin: 0 0 4px; }
      p { margin: 2px 0; }
      table { width: 100%; border-collapse: collapse; margin: 8px 0; }
      td, th { padding: 2px 0; text-align: left; }
      .sep { border-top: 1px dashed #111; margin: 6px 0; }
    </style></head><body>
    <h1>CORTE X (informativo)</h1>
    <p style="text-align:center">${register.value?.name ?? ''} · ${summary.session_name}</p>
    <p style="text-align:center">${new Date().toLocaleString('es-MX')}</p>
    <div class="sep"></div>
    <p>Apertura: ${formatCurrency(summary.opening_balance)}</p>
    <p>Ventas (${summary.sales_count}): ${formatCurrency(summary.sales_total)}</p>
    <p>Ticket promedio: ${formatCurrency(summary.avg_ticket)}</p>
    <p>Descuentos: ${formatCurrency(summary.discounts_total)}</p>
    <p>Devoluciones (${summary.refunds_count}): -${formatCurrency(summary.refunds_total)}</p>
    <p>Entradas efectivo: ${formatCurrency(summary.cash_in)}</p>
    <p>Salidas efectivo: -${formatCurrency(summary.cash_out)}</p>
    <p><strong>Efectivo esperado: ${formatCurrency(summary.expected_cash)}</strong></p>
    <div class="sep"></div>
    <table>
      <tr><th>Método</th><th style="text-align:right">Ventas</th><th style="text-align:right">Dev.</th><th style="text-align:right">Esperado</th></tr>
      ${methodRows}
    </table>
    </body></html>`)
}

const reprintLastTicket = (): void => {
  if (lastSale.value) {
    printHtml(lastSale.value.printableHtml)
  } else {
    notify('No hay un ticket reciente para reimprimir', 'warning')
  }
}

// ── Movimiento de efectivo ───────────────────────────────────────────────────
const saveMovement = async (): Promise<void> => {
  movementError.value = ''
  if (movementAmount.value <= 0) {
    movementError.value = 'El monto debe ser mayor a cero.'
    return
  }
  if (!movementReason.value.trim()) {
    movementError.value = 'El motivo es obligatorio.'
    return
  }

  isSavingMovement.value = true
  const { movementId, errorMessage } = await addCashMovement({
    sessionId: sessionId.value,
    movementType: movementType.value,
    amount: movementAmount.value,
    reason: movementReason.value.trim()
  })
  isSavingMovement.value = false

  if (!movementId) {
    movementError.value = errorMessage ?? 'No se pudo registrar el movimiento.'
    return
  }

  showMovement.value = false
  movementAmount.value = 0
  movementReason.value = ''
  notify(movementType.value === 'in' ? 'Entrada de efectivo registrada' : 'Salida de efectivo registrada')
  focusSearch()
}

// ── Devoluciones ─────────────────────────────────────────────────────────────
const searchRefundOrder = async (): Promise<void> => {
  refundError.value = ''
  refundOrder.value = null
  refundLines.value = []

  const folio = refundFolio.value.trim()
  if (!folio) return

  isSearchingRefund.value = true
  const { data, error } = await supabase
    .from('v_orders')
    .select('*')
    .eq('company_id', companyId.value)
    .eq('order_type', 'sale')
    .eq('order_state', 'posted')
    .ilike('name', `%${folio}%`)
    .order('order_date', { ascending: false })
    .limit(1)
  isSearchingRefund.value = false

  if (error || !data?.length) {
    refundError.value = 'No se encontró una venta confirmada con ese folio.'
    return
  }

  refundOrder.value = data[0] ?? null
  if (!refundOrder.value?.id) return

  const lines = await getOrderLinesByOrderId(refundOrder.value.id)
  refundLines.value = lines.map(l => ({ ...l, refund_qty: 0 }))
}

const refundTotalPreview = computed(() =>
  round2(refundLines.value.reduce((sum, l) => {
    if (l.refund_qty <= 0 || !l.quantity) return sum
    return sum + Number(l.total ?? 0) * (Math.min(l.refund_qty, Number(l.quantity)) / Number(l.quantity))
  }, 0))
)

const submitRefund = async (): Promise<void> => {
  refundError.value = ''

  if (!refundOrder.value?.id) return
  const lines = refundLines.value
    .filter(l => l.refund_qty > 0)
    .map(l => ({ order_line_id: l.id, quantity: Math.min(l.refund_qty, Number(l.quantity)) }))

  if (lines.length === 0) {
    refundError.value = 'Indica las cantidades a devolver.'
    return
  }
  if (!refundMethodId.value) {
    refundError.value = 'Selecciona el método de reembolso.'
    return
  }
  if (!refundReason.value.trim()) {
    refundError.value = 'El motivo es obligatorio.'
    return
  }

  isRefunding.value = true
  const { result, errorMessage } = await registerRefund({
    sessionId: sessionId.value,
    orderId: refundOrder.value.id,
    lines,
    paymentMethodId: refundMethodId.value,
    reason: refundReason.value.trim()
  })
  isRefunding.value = false

  if (!result) {
    refundError.value = errorMessage ?? 'No se pudo registrar la devolución.'
    return
  }

  notify(`Devolución de ${formatCurrency(result.refund_total)} registrada (${result.order_name})`)
  showRefund.value = false
  refundFolio.value = ''
  refundOrder.value = null
  refundLines.value = []
  refundReason.value = ''
  refreshProducts()
  focusSearch()
}

// ── Atajos de teclado ────────────────────────────────────────────────────────
const isTypingTarget = (e: KeyboardEvent): boolean => {
  const el = e.target as HTMLElement | null
  return Boolean(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable))
}

const closeTopModal = (): void => {
  if (lastSale.value) { startNextSale(); return }
  if (showHelp.value) { showHelp.value = false; return }
  if (showPayment.value) { showPayment.value = false; focusSearch(); return }
  if (showRefund.value) { showRefund.value = false; focusSearch(); return }
  if (showDiscount.value) { showDiscount.value = false; focusSearch(); return }
  if (showMovement.value) { showMovement.value = false; focusSearch(); return }
  if (showCustomer.value) { showCustomer.value = false; focusSearch(); return }
  if (showHeld.value) { showHeld.value = false; focusSearch(); return }
  clearSearch()
  focusSearch()
}

const handleKeydown = (e: KeyboardEvent): void => {
  // Ayuda y escape funcionan siempre
  if (e.key === 'F1') {
    e.preventDefault()
    showHelp.value = !showHelp.value
    return
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    closeTopModal()
    return
  }

  // Dentro del cobro: números 1-9 seleccionan método, Enter confirma
  if (showPayment.value) {
    if (!isTypingTarget(e) && /^[1-9]$/.test(e.key)) {
      const idx = Number(e.key) - 1
      const method = paymentMethods.value[idx]
      if (method) selectMethod(method.id)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (remainingDue.value <= 0.009 && payments.value.length > 0) confirmSale()
      else addPaymentEntry()
    }
    return
  }

  if (lastSale.value && e.key === 'Enter') {
    e.preventDefault()
    startNextSale()
    return
  }

  if (anyModalOpen.value) return

  switch (e.key) {
    case 'F2':
      e.preventDefault()
      focusSearch()
      return
    case 'F3':
      e.preventDefault()
      customerSearch.value = ''
      showCustomer.value = true
      return
    case 'F4':
      e.preventDefault()
      openDiscount()
      return
    case 'F6':
      e.preventDefault()
      if (ticketLines.value.length > 0) holdTicket()
      else showHeld.value = true
      return
    case 'F7':
      e.preventDefault()
      movementError.value = ''
      showMovement.value = true
      return
    case 'F9':
      e.preventDefault()
      openPayment()
      return
    case 'F10':
      e.preventDefault()
      printCorteX()
      return
    case 'F12':
      e.preventDefault()
      router.push(`/pos/close?session=${sessionId.value}`)
      return
  }

  if (isTypingTarget(e)) return

  if (e.key === '?') {
    showHelp.value = true
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (ticketLines.value.length > 0) {
      selectedLineIndex.value = Math.min(selectedLineIndex.value + 1, ticketLines.value.length - 1)
    }
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (ticketLines.value.length > 0) {
      selectedLineIndex.value = Math.max(selectedLineIndex.value - 1, 0)
    }
    return
  }
  if (e.key === '+' && selectedLineIndex.value >= 0) {
    e.preventDefault()
    changeLineQty(selectedLineIndex.value, 1)
    return
  }
  if (e.key === '-' && selectedLineIndex.value >= 0) {
    e.preventDefault()
    changeLineQty(selectedLineIndex.value, -1)
    return
  }
  if (e.key === 'Delete') {
    e.preventDefault()
    if (e.ctrlKey) {
      clearTicket()
    } else if (selectedLineIndex.value >= 0) {
      removeLine(selectedLineIndex.value)
    }
    return
  }
  if (e.ctrlKey && (e.key === 'p' || e.key === 'P')) {
    e.preventDefault()
    reprintLastTicket()
  }
}

// ── Carga inicial ────────────────────────────────────────────────────────────
const refreshProducts = async (): Promise<void> => {
  products.value = await getSellableProductViews(companyId.value)
}

const loadSessionData = async (): Promise<void> => {
  isLoading.value = true

  if (!sessionId.value || !companyId.value) {
    router.push('/pos')
    return
  }

  const { data, error } = await supabase
    .from('pos_session')
    .select('*')
    .eq('id', sessionId.value)
    .eq('company_id', companyId.value)
    .maybeSingle()

  if (error || !data || data.status !== 'open') {
    router.push('/pos')
    return
  }

  session.value = data
  register.value = await getRegisterById(data.register_id, companyId.value)

  const [, methods, customers] = await Promise.all([
    refreshProducts(),
    getPaymentMethods(companyId.value),
    getPartnersByCompany(companyId.value, { relationshipType: 'partner' })
  ])
  paymentMethods.value = methods
  partners.value = customers

  resetCustomer()
  restoreTicket()
  restoreHeld()

  // Resolver nombre del cliente por defecto de la caja
  if (customerId.value) {
    const found = partners.value.find(p => p.id === customerId.value)
    if (found) customerName.value = found.display_name || found.name
  }

  isLoading.value = false
  focusSearch()
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  clockTimer = setInterval(() => {
    clock.value = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  }, 1000)
  loadSessionData()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (clockTimer) clearInterval(clockTimer)
})
</script>

<template>
  <div class="h-screen flex flex-col overflow-hidden">
    <!-- Cargando -->
    <div v-if="isLoading" class="flex-1 flex items-center justify-center">
      <div class="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>

    <template v-else>
      <!-- ══ Encabezado ══ -->
      <header class="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between gap-4 flex-shrink-0">
        <div class="flex items-center gap-3 min-w-0">
          <NuxtLink
            to="/pos"
            class="flex items-center justify-center w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            title="Cambiar de caja"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </NuxtLink>
          <div class="min-w-0">
            <p class="font-bold text-sm truncate">{{ register?.name }} · <span class="font-mono">{{ session?.name }}</span></p>
            <p class="text-xs text-slate-400 truncate">{{ authStore.partnerDisplayName }} ({{ isAdmin ? 'Supervisor' : 'Cajero' }})</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            v-if="heldTickets.length > 0"
            class="relative px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-bold hover:bg-amber-500/30 transition-colors"
            @click="showHeld = true"
          >
            En espera
            <span class="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-amber-400 text-slate-900 text-[11px]">
              {{ heldTickets.length }}
            </span>
          </button>
          <button
            class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold transition-colors"
            title="Devolución"
            @click="showRefund = true; refundError = ''"
          >
            Devolución
          </button>
          <button
            class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold transition-colors"
            title="Corte X (F10)"
            @click="printCorteX"
          >
            Corte X
          </button>
          <NuxtLink
            :to="`/pos/close?session=${sessionId}`"
            class="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 text-xs font-bold transition-colors"
            title="Corte Z (F12)"
          >
            Corte Z
          </NuxtLink>
          <button
            class="flex items-center justify-center w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-bold"
            title="Atajos de teclado (F1)"
            @click="showHelp = true"
          >
            ?
          </button>
          <span class="text-sm font-mono text-slate-300 w-14 text-right">{{ clock }}</span>
        </div>
      </header>

      <!-- ══ Cuerpo ══ -->
      <div class="flex-1 flex overflow-hidden">
        <!-- ── Panel izquierdo: ticket ── -->
        <section class="w-[26rem] flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
          <!-- Cliente -->
          <button
            class="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors text-left"
            title="Cliente (F3)"
            @click="customerSearch = ''; showCustomer = true"
          >
            <div class="flex items-center gap-2 min-w-0">
              <svg class="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span class="text-sm font-semibold text-slate-700 truncate">{{ customerName }}</span>
            </div>
            <span class="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">F3</span>
          </button>

          <!-- Líneas -->
          <div class="flex-1 overflow-y-auto">
            <div
              v-if="ticketLines.length === 0"
              class="h-full flex flex-col items-center justify-center text-slate-300 gap-2 p-6"
            >
              <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p class="text-sm text-slate-400 text-center">Escanea un producto o búscalo para empezar</p>
            </div>

            <div
              v-for="(line, index) in ticketLines"
              :key="line.key"
              :class="[
                'px-4 py-2.5 border-b border-slate-100 cursor-pointer transition-colors',
                index === selectedLineIndex ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : 'hover:bg-slate-50 border-l-4 border-l-transparent',
                line.key === highlightedLineKey ? 'animate-pulse bg-emerald-50' : ''
              ]"
              @click="selectedLineIndex = index"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-semibold text-slate-800 truncate">{{ line.description }}</p>
                  <p class="text-xs text-slate-400">
                    {{ formatCurrency(line.unit_price) }} c/u
                    <span v-if="line.discount_percent > 0" class="text-rose-500 font-semibold"> · -{{ line.discount_percent }}%</span>
                    <span v-if="line.is_stockable && line.stock_quantity <= line.stock_min" class="text-amber-500 font-semibold"> · stock bajo</span>
                  </p>
                </div>
                <p class="text-sm font-bold text-slate-800 whitespace-nowrap">
                  {{ formatCurrency(lineAmounts(line).total) }}
                </p>
              </div>
              <div class="flex items-center gap-1.5 mt-1.5">
                <button
                  class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm transition-colors"
                  @click.stop="changeLineQty(index, -1)"
                >−</button>
                <input
                  :value="line.quantity"
                  type="number"
                  min="0.001"
                  step="any"
                  class="w-16 h-7 text-center text-sm font-bold border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  @click.stop
                  @change="setLineQty(index, Number(($event.target as HTMLInputElement).value))"
                />
                <button
                  class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm transition-colors"
                  @click.stop="changeLineQty(index, 1)"
                >+</button>
                <button
                  class="ml-auto w-7 h-7 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center"
                  title="Eliminar línea (Supr)"
                  @click.stop="removeLine(index)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- Totales + acciones -->
          <div class="border-t border-slate-200 p-4 space-y-3 flex-shrink-0">
            <div class="space-y-1 text-sm">
              <div class="flex justify-between text-slate-500">
                <span>Subtotal</span><span>{{ formatCurrency(ticketTotals.subtotal) }}</span>
              </div>
              <div v-if="ticketTotals.discount > 0" class="flex justify-between text-rose-500">
                <span>Descuento</span><span>-{{ formatCurrency(ticketTotals.discount) }}</span>
              </div>
              <div class="flex justify-between text-slate-500">
                <span>Impuestos</span><span>{{ formatCurrency(ticketTotals.tax) }}</span>
              </div>
            </div>
            <div class="flex justify-between items-baseline">
              <span class="text-base font-bold text-slate-700">TOTAL</span>
              <span class="text-3xl font-extrabold text-slate-900 tabular-nums">{{ formatCurrency(ticketTotals.total) }}</span>
            </div>

            <button
              :disabled="ticketLines.length === 0"
              :title="ticketLines.length === 0 ? 'Agrega productos al ticket para cobrar' : 'Cobrar (F9)'"
              class="w-full py-4 rounded-xl text-white text-lg font-bold transition-all
                     bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700
                     shadow-lg shadow-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
              @click="openPayment"
            >
              Cobrar <span class="text-emerald-200 text-sm font-semibold">(F9)</span>
            </button>

            <div class="grid grid-cols-3 gap-2">
              <button
                class="py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-colors"
                title="Poner en espera (F6)"
                @click="holdTicket"
              >
                Espera <span class="text-slate-400">F6</span>
              </button>
              <button
                class="py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-colors"
                title="Descuento (F4)"
                @click="openDiscount"
              >
                Desc. <span class="text-slate-400">F4</span>
              </button>
              <button
                class="py-2 rounded-lg bg-slate-100 hover:bg-red-100 hover:text-red-600 text-slate-600 text-xs font-bold transition-colors"
                title="Descartar ticket (Ctrl+Supr)"
                @click="clearTicket()"
              >
                Descartar
              </button>
            </div>
          </div>
        </section>

        <!-- ── Panel derecho: catálogo ── -->
        <section class="flex-1 flex flex-col overflow-hidden">
          <!-- Búsqueda -->
          <div class="p-4 pb-2 flex-shrink-0 relative">
            <div class="relative">
              <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref="searchInputRef"
                v-model="searchQuery"
                type="text"
                placeholder="Escanea o busca por nombre, SKU o código (F2) · usa '3*' para multiplicar"
                class="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white border border-slate-200 text-slate-800
                       text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm transition-all"
                autocomplete="off"
                @keydown="onSearchKeydown"
              />
              <span v-if="isSearching" class="absolute right-4 top-1/2 -translate-y-1/2">
                <span class="block w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              </span>
            </div>

            <!-- Resultados -->
            <div
              v-if="searchResults.length > 0"
              class="absolute left-4 right-4 top-full -mt-1 z-30 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden"
            >
              <button
                v-for="(result, idx) in searchResults"
                :key="result.id ?? idx"
                :class="[
                  'w-full px-4 py-2.5 flex items-center justify-between gap-3 text-left transition-colors',
                  idx === searchHighlight ? 'bg-indigo-50' : 'hover:bg-slate-50'
                ]"
                @click="addProduct(result, parseMultiplier())"
              >
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-slate-800 truncate">{{ result.display_name || result.name }}</p>
                  <p class="text-xs text-slate-400">
                    {{ result.sku || result.barcode || '—' }}
                    <span v-if="result.is_stockable !== false && result.product_type === 'product'">
                      · stock {{ Number(result.stock_quantity ?? 0) }}
                    </span>
                  </p>
                </div>
                <span class="text-sm font-bold text-slate-700 whitespace-nowrap">{{ formatCurrency(Number(result.sale_price ?? 0)) }}</span>
              </button>
            </div>
          </div>

          <!-- Pestañas de categorías -->
          <div class="px-4 py-2 flex gap-2 overflow-x-auto flex-shrink-0">
            <button
              :class="[
                'px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors',
                activeCategory === 'all' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
              ]"
              @click="activeCategory = 'all'"
            >
              Todos
            </button>
            <button
              v-for="cat in categories"
              :key="cat.id"
              :class="[
                'px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors',
                activeCategory === cat.id ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
              ]"
              @click="activeCategory = cat.id"
            >
              {{ cat.name }}
            </button>
          </div>

          <!-- Cuadrícula de productos -->
          <div class="flex-1 overflow-y-auto p-4 pt-2">
            <div
              v-if="quickProducts.length === 0"
              class="h-full flex items-center justify-center text-slate-400 text-sm"
            >
              No hay productos activos para vender en esta categoría.
            </div>
            <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              <button
                v-for="product in quickProducts"
                :key="product.id ?? ''"
                class="bg-white rounded-xl border border-slate-200 p-3 text-left hover:border-indigo-300 hover:shadow-md
                       transition-all min-h-[88px] flex flex-col justify-between active:scale-[0.98]"
                @click="addProduct(product)"
              >
                <p class="text-sm font-semibold text-slate-800 line-clamp-2">{{ product.display_name || product.name }}</p>
                <div class="flex items-center justify-between mt-2">
                  <span class="text-sm font-bold text-indigo-600">{{ formatCurrency(Number(product.sale_price ?? 0)) }}</span>
                  <span
                    v-if="product.is_stockable !== false && product.product_type === 'product'"
                    :class="[
                      'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                      Number(product.stock_quantity ?? 0) <= 0
                        ? 'bg-red-100 text-red-600'
                        : Number(product.stock_quantity ?? 0) <= Number(product.stock_min ?? 0)
                          ? 'bg-amber-100 text-amber-600'
                          : 'bg-emerald-100 text-emerald-600'
                    ]"
                  >
                    {{ Number(product.stock_quantity ?? 0) }}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </section>
      </div>
    </template>

    <!-- ══ Toasts ══ -->
    <Teleport to="body">
      <div class="fixed bottom-6 right-6 z-[60] flex flex-col gap-2 items-end">
        <TransitionGroup
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 translate-y-2"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div
            v-for="toast in toasts"
            :key="toast.id"
            :class="[
              'px-4 py-2.5 rounded-xl shadow-lg text-sm font-semibold text-white max-w-sm',
              toast.tone === 'success' ? 'bg-emerald-600' : toast.tone === 'error' ? 'bg-red-600' : 'bg-amber-500'
            ]"
          >
            {{ toast.message }}
          </div>
        </TransitionGroup>
      </div>
    </Teleport>

    <!-- ══ Modal: Cobro ══ -->
    <Teleport to="body">
      <div
        v-if="showPayment"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      >
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-slate-800">Cobro</h3>
            <button class="text-slate-400 hover:text-slate-600 text-sm font-semibold" @click="showPayment = false; focusSearch()">
              Esc para cerrar
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Métodos -->
            <div>
              <p class="text-sm font-semibold text-slate-500 mb-2">Método de pago <span class="text-slate-300">(teclas 1–9)</span></p>
              <div class="space-y-2">
                <button
                  v-for="(method, idx) in paymentMethods"
                  :key="method.id"
                  :class="[
                    'w-full px-4 py-3 rounded-xl border-2 flex items-center justify-between transition-all text-left',
                    activeMethodId === method.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300'
                  ]"
                  @click="selectMethod(method.id)"
                >
                  <span class="font-semibold text-slate-700">
                    <span class="inline-flex items-center justify-center w-5 h-5 rounded bg-slate-100 text-[11px] font-bold text-slate-500 mr-2">{{ idx + 1 }}</span>
                    {{ method.name }}
                  </span>
                  <span v-if="method.is_cash" class="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">EFECTIVO</span>
                </button>
                <p v-if="paymentMethods.length === 0" class="text-sm text-amber-600">
                  No hay métodos de pago configurados. Créalos en Ventas → Métodos de pago.
                </p>
              </div>

              <!-- Captura de monto -->
              <div class="mt-4 space-y-3">
                <template v-if="isActiveMethodCash">
                  <FormInput
                    v-model="tenderedAmount"
                    type="number"
                    label="Monto recibido"
                    :min="0"
                    step="0.01"
                    size="md"
                  />
                  <div class="flex flex-wrap gap-2">
                    <button
                      v-for="d in [50, 100, 200, 500, 1000]"
                      :key="d"
                      class="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-bold text-slate-600 transition-colors"
                      @click="addDenomination(d)"
                    >
                      +${{ d }}
                    </button>
                    <button
                      class="px-3 py-1.5 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-sm font-bold text-indigo-600 transition-colors"
                      @click="setTendered(remainingDue)"
                    >
                      Exacto
                    </button>
                  </div>

                  <!-- Cambio calculado en vivo -->
                  <div
                    v-if="Number(tenderedAmount) > 0"
                    :class="[
                      'rounded-xl px-4 py-3 flex items-center justify-between',
                      liveChange > 0 ? 'bg-indigo-50' : Number(tenderedAmount) >= remainingDue ? 'bg-emerald-50' : 'bg-amber-50'
                    ]"
                  >
                    <template v-if="Number(tenderedAmount) >= remainingDue">
                      <span :class="['text-sm font-semibold', liveChange > 0 ? 'text-indigo-500' : 'text-emerald-600']">
                        Cambio a entregar
                      </span>
                      <span :class="['text-2xl font-extrabold tabular-nums', liveChange > 0 ? 'text-indigo-700' : 'text-emerald-700']">
                        {{ formatCurrency(liveChange) }}
                      </span>
                    </template>
                    <template v-else>
                      <span class="text-sm font-semibold text-amber-600">Falta por recibir</span>
                      <span class="text-2xl font-extrabold tabular-nums text-amber-700">
                        {{ formatCurrency(round2(remainingDue - Number(tenderedAmount))) }}
                      </span>
                    </template>
                  </div>
                </template>
                <template v-else>
                  <FormInput
                    v-model="paymentAmount"
                    type="number"
                    label="Monto a aplicar"
                    :min="0"
                    step="0.01"
                    size="md"
                  />
                </template>

                <BtnApp
                  label="Aplicar pago"
                  variant="secondary"
                  size="md"
                  block
                  :disabled="remainingDue <= 0"
                  @click="addPaymentEntry"
                />
              </div>
            </div>

            <!-- Resumen -->
            <div class="flex flex-col">
              <div class="bg-slate-50 rounded-xl p-4 text-center mb-4">
                <p class="text-sm font-semibold text-slate-500">Total a cobrar</p>
                <p class="text-4xl font-extrabold text-slate-900 tabular-nums">{{ formatCurrency(ticketTotals.total) }}</p>
              </div>

              <div class="space-y-2 mb-3">
                <div
                  v-for="(pay, idx) in payments"
                  :key="idx"
                  class="flex items-center justify-between px-3 py-2 bg-white border border-slate-200 rounded-lg"
                >
                  <div>
                    <p class="text-sm font-semibold text-slate-700">{{ pay.method_name }}</p>
                    <p v-if="pay.is_cash && pay.tendered" class="text-xs text-slate-400">
                      Recibido {{ formatCurrency(pay.tendered) }} · cambio {{ formatCurrency(pay.change_amount) }}
                    </p>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-bold text-slate-800">{{ formatCurrency(pay.amount) }}</span>
                    <button class="text-slate-300 hover:text-red-500 transition-colors" @click="removePaymentEntry(idx)">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div class="flex justify-between text-sm font-semibold mb-1">
                <span class="text-slate-500">Pagado</span>
                <span class="text-slate-800">{{ formatCurrency(paymentsTotal) }}</span>
              </div>
              <div class="flex justify-between text-base font-bold mb-1">
                <span :class="remainingDue > 0 ? 'text-amber-600' : 'text-emerald-600'">
                  {{ remainingDue > 0 ? 'Restante' : 'Cubierto' }}
                </span>
                <span :class="remainingDue > 0 ? 'text-amber-600' : 'text-emerald-600'">
                  {{ formatCurrency(Math.max(remainingDue, 0)) }}
                </span>
              </div>
              <div v-if="totalChange > 0" class="flex justify-between text-lg font-extrabold text-indigo-600 mb-2">
                <span>Cambio</span><span>{{ formatCurrency(totalChange) }}</span>
              </div>

              <p v-if="paymentError" class="text-sm text-red-600 mb-2">{{ paymentError }}</p>

              <div class="mt-auto">
                <BtnApp
                  label="Confirmar venta"
                  variant="success"
                  size="lg"
                  block
                  :disabled="remainingDue > 0.009 || payments.length === 0"
                  :loading="isCharging"
                  loading-text="Registrando…"
                  @click="confirmSale"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ══ Overlay: venta completada ══ -->
    <Teleport to="body">
      <div
        v-if="lastSale"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm"
      >
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <div class="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-4">
            <svg class="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 class="text-lg font-bold text-slate-800 mb-1">Venta registrada</h3>
          <p class="text-sm text-slate-500 mb-4 font-mono">{{ lastSale.orderName }} · {{ formatCurrency(lastSale.total) }}</p>

          <div v-if="lastSale.change > 0" class="bg-indigo-50 rounded-xl py-5 mb-5">
            <p class="text-sm font-semibold text-indigo-500">Cambio a entregar</p>
            <p class="text-5xl font-extrabold text-indigo-700 tabular-nums">{{ formatCurrency(lastSale.change) }}</p>
          </div>

          <div class="flex gap-3">
            <BtnApp
              label="Imprimir ticket"
              variant="secondary"
              size="md"
              block
              @click="printHtml(lastSale.printableHtml)"
            />
            <BtnApp
              label="Nueva venta (Enter)"
              size="md"
              block
              @click="startNextSale"
            />
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ══ Modal: Cliente ══ -->
    <Teleport to="body">
      <div
        v-if="showCustomer"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
        @click.self="showCustomer = false; focusSearch()"
      >
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[85vh] flex flex-col">
          <h3 class="text-lg font-bold text-slate-800 mb-4">Cliente del ticket</h3>

          <FormInput
            v-model="customerSearch"
            type="search"
            placeholder="Buscar por nombre, teléfono, correo o RFC…"
            size="md"
          />

          <div class="flex-1 overflow-y-auto mt-3 -mx-2 px-2">
            <button
              class="w-full px-3 py-2.5 rounded-lg hover:bg-slate-50 text-left flex items-center gap-3 transition-colors"
              @click="resetCustomer(); showCustomer = false; focusSearch()"
            >
              <span class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-bold">PG</span>
              <span class="text-sm font-semibold text-slate-700">Público general</span>
            </button>
            <button
              v-for="partner in filteredCustomers"
              :key="partner.id"
              class="w-full px-3 py-2.5 rounded-lg hover:bg-slate-50 text-left flex items-center gap-3 transition-colors"
              @click="selectCustomer(partner)"
            >
              <span class="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">
                {{ (partner.display_name || partner.name).slice(0, 2).toUpperCase() }}
              </span>
              <span class="min-w-0">
                <span class="block text-sm font-semibold text-slate-700 truncate">{{ partner.display_name || partner.name }}</span>
                <span class="block text-xs text-slate-400 truncate">{{ partner.email || partner.phone || partner.vat || '—' }}</span>
              </span>
            </button>
          </div>

          <div class="border-t border-slate-100 pt-3 mt-2">
            <button
              v-if="!showQuickCreate"
              class="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
              @click="showQuickCreate = true; customerError = ''"
            >
              + Alta rápida de cliente
            </button>
            <div v-else class="space-y-2">
              <FormInput v-model="quickCreateName" type="text" placeholder="Nombre del cliente *" size="sm" />
              <FormInput v-model="quickCreateContact" type="text" placeholder="Teléfono o correo" size="sm" />
              <p v-if="customerError" class="text-xs text-red-600">{{ customerError }}</p>
              <div class="flex gap-2 justify-end">
                <BtnApp label="Cancelar" variant="ghost" size="sm" @click="showQuickCreate = false" />
                <BtnApp label="Crear y asociar" size="sm" :loading="isCreatingCustomer" @click="quickCreateCustomer" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ══ Modal: Movimiento de efectivo ══ -->
    <Teleport to="body">
      <div
        v-if="showMovement"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
        @click.self="showMovement = false; focusSearch()"
      >
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <h3 class="text-lg font-bold text-slate-800 mb-4">Movimiento de efectivo</h3>

          <div class="grid grid-cols-2 gap-2 mb-4">
            <button
              :class="[
                'py-3 rounded-xl border-2 font-bold text-sm transition-all',
                movementType === 'in' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
              ]"
              @click="movementType = 'in'"
            >
              Entrada
            </button>
            <button
              :class="[
                'py-3 rounded-xl border-2 font-bold text-sm transition-all',
                movementType === 'out' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
              ]"
              @click="movementType = 'out'"
            >
              Salida
            </button>
          </div>

          <div class="space-y-3">
            <FormInput v-model="movementAmount" type="number" label="Monto" :min="0" step="0.01" size="md" required />
            <FormInput
              v-model="movementReason"
              type="text"
              label="Motivo"
              :placeholder="movementType === 'in' ? 'Ej. cambio adicional' : 'Ej. retiro parcial, pago a proveedor'"
              size="md"
              required
            />
          </div>

          <p v-if="movementError" class="mt-3 text-sm text-red-600">{{ movementError }}</p>

          <div class="mt-5 flex gap-3 justify-end">
            <BtnApp label="Cancelar" variant="ghost" size="md" @click="showMovement = false; focusSearch()" />
            <BtnApp label="Registrar" size="md" :loading="isSavingMovement" @click="saveMovement" />
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ══ Modal: Descuento ══ -->
    <Teleport to="body">
      <div
        v-if="showDiscount"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
        @click.self="showDiscount = false; focusSearch()"
      >
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <h3 class="text-lg font-bold text-slate-800 mb-1">Aplicar descuento</h3>
          <p class="text-xs text-slate-400 mb-4">Tu límite: {{ maxDiscountAllowed }}%</p>

          <div class="grid grid-cols-2 gap-2 mb-3">
            <button
              :class="[
                'py-2.5 rounded-xl border-2 font-bold text-sm transition-all',
                discountScope === 'line' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500'
              ]"
              :disabled="selectedLineIndex < 0"
              @click="discountScope = 'line'"
            >
              Línea seleccionada
            </button>
            <button
              :class="[
                'py-2.5 rounded-xl border-2 font-bold text-sm transition-all',
                discountScope === 'ticket' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500'
              ]"
              @click="discountScope = 'ticket'"
            >
              Todo el ticket
            </button>
          </div>

          <div class="grid grid-cols-2 gap-2 mb-3">
            <button
              :class="[
                'py-2.5 rounded-xl border-2 font-bold text-sm transition-all',
                discountMode === 'percent' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500'
              ]"
              @click="discountMode = 'percent'"
            >
              Porcentaje %
            </button>
            <button
              :class="[
                'py-2.5 rounded-xl border-2 font-bold text-sm transition-all',
                discountMode === 'amount' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500'
              ]"
              @click="discountMode = 'amount'"
            >
              Monto fijo $
            </button>
          </div>

          <FormInput
            v-model="discountValue"
            type="number"
            :label="discountMode === 'percent' ? 'Porcentaje de descuento' : 'Monto de descuento'"
            :min="0"
            step="0.01"
            size="md"
          />

          <p v-if="discountError" class="mt-3 text-sm text-red-600">{{ discountError }}</p>

          <div class="mt-5 flex gap-3 justify-end">
            <BtnApp label="Cancelar" variant="ghost" size="md" @click="showDiscount = false; focusSearch()" />
            <BtnApp label="Aplicar" size="md" @click="applyDiscount" />
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ══ Modal: Tickets en espera ══ -->
    <Teleport to="body">
      <div
        v-if="showHeld"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
        @click.self="showHeld = false; focusSearch()"
      >
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[80vh] flex flex-col">
          <h3 class="text-lg font-bold text-slate-800 mb-4">Tickets en espera</h3>

          <p v-if="heldTickets.length === 0" class="text-sm text-slate-400 py-8 text-center">
            No hay tickets en espera. Usa F6 con un ticket activo para guardarlo.
          </p>

          <div v-else class="flex-1 overflow-y-auto space-y-2">
            <div
              v-for="held in heldTickets"
              :key="held.id"
              class="flex items-center justify-between gap-3 px-4 py-3 border border-slate-200 rounded-xl"
            >
              <div class="min-w-0">
                <p class="text-sm font-semibold text-slate-700 truncate">
                  {{ held.partnerName }} · {{ held.lines.length }} línea(s)
                </p>
                <p class="text-xs text-slate-400">
                  {{ new Date(held.savedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) }}
                  · {{ formatCurrency(held.lines.reduce((s, l) => s + lineAmounts(l).total, 0)) }}
                </p>
              </div>
              <div class="flex gap-2">
                <BtnApp label="Recuperar" size="sm" @click="resumeTicket(held)" />
                <BtnApp label="Descartar" variant="ghost" size="sm" @click="discardHeld(held)" />
              </div>
            </div>
          </div>

          <div class="mt-4 text-right">
            <BtnApp label="Cerrar" variant="secondary" size="sm" @click="showHeld = false; focusSearch()" />
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ══ Modal: Devolución ══ -->
    <Teleport to="body">
      <div
        v-if="showRefund"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
        @click.self="showRefund = false; focusSearch()"
      >
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
          <h3 class="text-lg font-bold text-slate-800 mb-4">Devolución</h3>

          <div class="flex gap-2 mb-4">
            <div class="flex-1">
              <FormInput
                v-model="refundFolio"
                type="text"
                placeholder="Folio de la venta (ej. SO-000123) o escanea el ticket"
                size="md"
                @keydown.enter="searchRefundOrder"
              />
            </div>
            <BtnApp label="Buscar" variant="secondary" size="md" :loading="isSearchingRefund" @click="searchRefundOrder" />
          </div>

          <template v-if="refundOrder">
            <div class="bg-slate-50 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
              <div>
                <p class="text-sm font-bold text-slate-800 font-mono">{{ refundOrder.name }}</p>
                <p class="text-xs text-slate-400">
                  {{ refundOrder.partner_name ?? '' }} · {{ refundOrder.order_date }}
                </p>
              </div>
              <p class="text-base font-bold text-slate-800">{{ formatCurrency(Number(refundOrder.amount_total ?? 0)) }}</p>
            </div>

            <table class="w-full text-sm mb-4">
              <thead>
                <tr class="text-left text-xs text-slate-400 uppercase">
                  <th class="py-2">Producto</th>
                  <th class="py-2 text-center">Vendido</th>
                  <th class="py-2 text-center">Devolver</th>
                  <th class="py-2 text-right">Importe</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="line in refundLines" :key="line.id" class="border-t border-slate-100">
                  <td class="py-2 text-slate-700">{{ line.description }}</td>
                  <td class="py-2 text-center text-slate-500">{{ Number(line.quantity) }}</td>
                  <td class="py-2 text-center">
                    <input
                      v-model.number="line.refund_qty"
                      type="number"
                      min="0"
                      :max="Number(line.quantity)"
                      step="any"
                      class="w-20 px-2 py-1 text-center border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </td>
                  <td class="py-2 text-right text-slate-700">{{ formatCurrency(Number(line.total ?? 0)) }}</td>
                </tr>
              </tbody>
            </table>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <FormSelect
                v-model="refundMethodId"
                :options="paymentMethods.map(m => ({ value: m.id, label: m.name }))"
                label="Método de reembolso"
                size="md"
              />
              <FormInput
                v-model="refundReason"
                type="text"
                label="Motivo"
                placeholder="Obligatorio"
                size="md"
                required
              />
            </div>

            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-semibold text-slate-500">Total a reembolsar</span>
              <span class="text-xl font-extrabold text-slate-900">{{ formatCurrency(refundTotalPreview) }}</span>
            </div>
          </template>

          <p v-if="refundError" class="text-sm text-red-600 mb-3">{{ refundError }}</p>

          <div class="flex gap-3 justify-end">
            <BtnApp label="Cancelar" variant="ghost" size="md" @click="showRefund = false; focusSearch()" />
            <BtnApp
              v-if="refundOrder"
              label="Registrar devolución"
              variant="danger"
              size="md"
              :disabled="refundTotalPreview <= 0"
              :loading="isRefunding"
              @click="submitRefund"
            />
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ══ Modal: Ayuda de atajos ══ -->
    <Teleport to="body">
      <div
        v-if="showHelp"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
        @click.self="showHelp = false"
      >
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto">
          <h3 class="text-lg font-bold text-slate-800 mb-4">Atajos de teclado</h3>
          <table class="w-full text-sm">
            <tbody>
              <tr v-for="[key, action] in [
                ['F1 / ?', 'Mostrar esta ayuda'],
                ['F2', 'Foco en búsqueda de productos'],
                ['F3', 'Buscar / asociar cliente'],
                ['F4', 'Aplicar descuento (línea o ticket)'],
                ['F6', 'Poner ticket en espera / recuperar'],
                ['F7', 'Movimiento de efectivo'],
                ['F9', 'Ir a cobro'],
                ['F10', 'Corte X (informativo)'],
                ['F12', 'Corte Z / cerrar sesión de caja'],
                ['Enter', 'Agregar producto / confirmar pago'],
                ['Esc', 'Cancelar / cerrar modal'],
                ['↑ ↓', 'Navegar líneas del ticket'],
                ['+ / −', 'Cantidad de la línea seleccionada'],
                ['Supr', 'Eliminar línea seleccionada'],
                ['Ctrl+Supr', 'Descartar ticket completo'],
                ['1–9 (en cobro)', 'Selección rápida de método'],
                ['Ctrl+P', 'Reimprimir último ticket'],
                ['3*', 'Prefijo multiplicador antes de escanear']
              ]" :key="key">
                <td class="py-1.5 pr-4 whitespace-nowrap">
                  <kbd class="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-xs font-bold text-slate-600">{{ key }}</kbd>
                </td>
                <td class="py-1.5 text-slate-600">{{ action }}</td>
              </tr>
            </tbody>
          </table>
          <div class="mt-4 text-right">
            <BtnApp label="Cerrar" variant="secondary" size="sm" @click="showHelp = false" />
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
