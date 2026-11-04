/**
 * Etiquetas y variantes de UI (en español) del flujo comercial.
 *
 * Viven aquí y no en `types/sales.types.ts` porque son valores de ejecución:
 * el alias `~/types` solo lo resuelve TypeScript, así que desde `types/`
 * únicamente se importan tipos.
 */
import type { DeliveryStatus, OrderChannel, PaymentSource, PaymentStatus } from '~/types/sales.types'

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending: 'Por entregar',
  partial: 'Entrega parcial',
  delivered: 'Entregada',
  no_delivery: 'Sin entrega física'
}

export const DELIVERY_STATUS_VARIANTS: Record<DeliveryStatus, 'success' | 'warning' | 'danger' | 'primary' | 'secondary'> = {
  pending: 'secondary',
  partial: 'warning',
  delivered: 'success',
  no_delivery: 'primary'
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'No pagado',
  partial: 'Pago parcial',
  paid: 'Pagado',
  condoned: 'Condonado',
  overdue: 'Vencido'
}

export const PAYMENT_STATUS_VARIANTS: Record<PaymentStatus, 'success' | 'warning' | 'danger' | 'primary' | 'secondary'> = {
  unpaid: 'secondary',
  partial: 'warning',
  paid: 'success',
  condoned: 'primary',
  overdue: 'danger'
}

export const PAYMENT_SOURCE_LABELS: Record<PaymentSource, string> = {
  dashboard: 'Panel',
  pos: 'Punto de venta',
  stripe: 'Stripe',
  backfill: 'Registro previo'
}

export const CHANNEL_LABELS: Record<OrderChannel, string> = {
  dashboard: 'Panel',
  pos: 'Punto de venta',
  storefront: 'Tienda en línea'
}
