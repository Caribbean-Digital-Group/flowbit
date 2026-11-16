// Primeros pasos de una empresa nueva (TRY-30).
//
// Lógica pura: recibe los conteos ya consultados y decide qué pasos están
// completos. La vista (`components/Dashboard/OnboardingChecklist.vue`) solo
// pinta el resultado, así el criterio de cada paso se prueba sin Vue ni Supabase.

export type OnboardingStepId = 'company' | 'product' | 'payment_method' | 'team' | 'first_sale'

/** Señales mínimas para evaluar los pasos. Todas se obtienen con consultas `count`. */
export interface OnboardingSignals {
  /** Razón social capturada en Configuración. */
  hasLegalName: boolean
  /** RFC capturado en Configuración. */
  hasTaxId: boolean
  productCount: number
  paymentMethodCount: number
  /** Personas en el equipo, incluida la que creó la empresa e invitaciones pendientes. */
  teamMemberCount: number
  saleOrderCount: number
}

export interface OnboardingStep {
  id: OnboardingStepId
  title: string
  description: string
  done: boolean
  /** Ruta del panel donde se completa el paso. */
  to: string
  actionLabel: string
  /** Guía del manual que explica el paso. */
  manualHref: string
}

export interface OnboardingProgress {
  steps: OnboardingStep[]
  completed: number
  total: number
  percent: number
  isComplete: boolean
  /** Primer paso pendiente, para destacarlo como siguiente acción. */
  nextStepId: OnboardingStepId | null
}

const STEP_DEFINITIONS: ReadonlyArray<Omit<OnboardingStep, 'done'>> = [
  {
    id: 'company',
    title: 'Completa los datos fiscales de tu empresa',
    description: 'Razón social y RFC aparecen en órdenes, recibos y documentos.',
    to: '/admin/settings',
    actionLabel: 'Ir a Configuración',
    manualHref: '/manual/settings'
  },
  {
    id: 'product',
    title: 'Crea tu primer producto o importa tu catálogo',
    description: 'Puedes capturarlos uno por uno o subir un CSV con todo tu catálogo.',
    to: '/admin/products',
    actionLabel: 'Ir a Productos',
    manualHref: '/manual/products-create'
  },
  {
    id: 'payment_method',
    title: 'Da de alta un método de pago',
    description: 'Efectivo, transferencia o tarjeta: lo necesitas para registrar cobros.',
    to: '/admin/payment-methods',
    actionLabel: 'Ir a Métodos de pago',
    manualHref: '/manual/payment-methods-list'
  },
  {
    id: 'team',
    title: 'Invita a alguien de tu equipo',
    description: 'Comparte la operación con tu equipo y asigna su rol.',
    to: '/admin/team',
    actionLabel: 'Ir a Equipo',
    manualHref: '/manual/team-list'
  },
  {
    id: 'first_sale',
    title: 'Registra tu primera venta',
    description: 'Crea una orden de venta o cobra desde el punto de venta.',
    to: '/admin/orders/create',
    actionLabel: 'Crear orden de venta',
    manualHref: '/manual/orders-create'
  }
]

const isStepDone = (id: OnboardingStepId, signals: OnboardingSignals): boolean => {
  switch (id) {
    case 'company':
      return signals.hasLegalName && signals.hasTaxId
    case 'product':
      return signals.productCount > 0
    case 'payment_method':
      return signals.paymentMethodCount > 0
    case 'team':
      // La persona que creó la empresa ya cuenta como 1.
      return signals.teamMemberCount > 1
    case 'first_sale':
      return signals.saleOrderCount > 0
  }
}

export const buildOnboardingProgress = (signals: OnboardingSignals): OnboardingProgress => {
  const steps: OnboardingStep[] = STEP_DEFINITIONS.map((definition) => ({
    ...definition,
    done: isStepDone(definition.id, signals)
  }))
  const completed = steps.filter((step) => step.done).length
  const total = steps.length
  return {
    steps,
    completed,
    total,
    percent: total === 0 ? 100 : Math.round((completed / total) * 100),
    isComplete: completed === total,
    nextStepId: steps.find((step) => !step.done)?.id ?? null
  }
}

/** Texto con contenido real (descarta cadenas vacías o solo espacios). */
export const hasText = (value: string | null | undefined): boolean =>
  typeof value === 'string' && value.trim().length > 0

/** Clave de `localStorage` para recordar que se ocultó la tarjeta, por empresa. */
export const onboardingDismissKey = (companyId: string): string =>
  `flowbit:onboarding-dismissed:${companyId}`
