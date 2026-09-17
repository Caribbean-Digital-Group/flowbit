import type { CrmActivityType, CrmLeadPriority, CrmStageColor } from '~/types/crm.types'

/**
 * Utilidades puras del módulo CRM compartidas por el tablero Kanban,
 * el listado de leads y los formularios de etapas.
 */

// ── Paleta de etapas ────────────────────────────────────────────────────────
// Clases literales para que Tailwind v4 las detecte al compilar.
export interface CrmStagePalette {
  label: string
  /** Punto de color / muestra del selector */
  dot: string
  /** Barra superior de la columna */
  bar: string
  /** Fondo suave de la columna */
  soft: string
  /** Texto con acento */
  text: string
  /** Anillo de enfoque / zona de soltado */
  ring: string
  /** Relleno de la barra de progreso */
  fill: string
}

export const CRM_STAGE_PALETTE: Record<CrmStageColor, CrmStagePalette> = {
  slate: { label: 'Pizarra', dot: 'bg-slate-400', bar: 'bg-slate-400', soft: 'bg-slate-100/70', text: 'text-slate-700', ring: 'ring-slate-300', fill: 'bg-slate-400' },
  sky: { label: 'Cielo', dot: 'bg-sky-500', bar: 'bg-sky-500', soft: 'bg-sky-50/70', text: 'text-sky-700', ring: 'ring-sky-300', fill: 'bg-sky-500' },
  indigo: { label: 'Índigo', dot: 'bg-indigo-500', bar: 'bg-indigo-500', soft: 'bg-indigo-50/70', text: 'text-indigo-700', ring: 'ring-indigo-300', fill: 'bg-indigo-500' },
  violet: { label: 'Violeta', dot: 'bg-violet-500', bar: 'bg-violet-500', soft: 'bg-violet-50/70', text: 'text-violet-700', ring: 'ring-violet-300', fill: 'bg-violet-500' },
  fuchsia: { label: 'Fucsia', dot: 'bg-fuchsia-500', bar: 'bg-fuchsia-500', soft: 'bg-fuchsia-50/70', text: 'text-fuchsia-700', ring: 'ring-fuchsia-300', fill: 'bg-fuchsia-500' },
  rose: { label: 'Rosa', dot: 'bg-rose-500', bar: 'bg-rose-500', soft: 'bg-rose-50/70', text: 'text-rose-700', ring: 'ring-rose-300', fill: 'bg-rose-500' },
  amber: { label: 'Ámbar', dot: 'bg-amber-500', bar: 'bg-amber-500', soft: 'bg-amber-50/70', text: 'text-amber-700', ring: 'ring-amber-300', fill: 'bg-amber-500' },
  emerald: { label: 'Esmeralda', dot: 'bg-emerald-500', bar: 'bg-emerald-500', soft: 'bg-emerald-50/70', text: 'text-emerald-700', ring: 'ring-emerald-300', fill: 'bg-emerald-500' },
  teal: { label: 'Turquesa', dot: 'bg-teal-500', bar: 'bg-teal-500', soft: 'bg-teal-50/70', text: 'text-teal-700', ring: 'ring-teal-300', fill: 'bg-teal-500' }
}

export const CRM_STAGE_COLORS = Object.keys(CRM_STAGE_PALETTE) as CrmStageColor[]

export const getStagePalette = (color: string | null | undefined): CrmStagePalette =>
  CRM_STAGE_PALETTE[(color ?? 'indigo') as CrmStageColor] ?? CRM_STAGE_PALETTE.indigo

// ── Prioridad ───────────────────────────────────────────────────────────────
export const CRM_PRIORITY_META: Record<CrmLeadPriority, { label: string; chip: string; accent: string; bars: number }> = {
  low: { label: 'Baja', chip: 'bg-slate-100 text-slate-600', accent: 'bg-slate-300', bars: 1 },
  medium: { label: 'Media', chip: 'bg-amber-50 text-amber-700', accent: 'bg-amber-400', bars: 2 },
  high: { label: 'Alta', chip: 'bg-rose-50 text-rose-700', accent: 'bg-rose-500', bars: 3 }
}

// ── Actividades ─────────────────────────────────────────────────────────────
export const CRM_ACTIVITY_ICONS: Record<CrmActivityType, string> = {
  call: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  meeting: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  email: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  demo: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  followup: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  task: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'
}

// ── Formato ─────────────────────────────────────────────────────────────────
export const formatCrmCurrency = (value: number, currency = 'MXN', compact = false): string =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN',
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? 'compact' : 'standard'
  }).format(value || 0)

export const getInitials = (name: string | null | undefined): string => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

const DAY_MS = 86_400_000

const startOfDay = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

/** Diferencia en días calendario entre hoy y la fecha (negativo = pasado). */
export const daysFromToday = (value: string): number => {
  // Las fechas `YYYY-MM-DD` se interpretan en hora local, no UTC
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
  return Math.round((startOfDay(date) - startOfDay(new Date())) / DAY_MS)
}

export const formatRelativeDay = (value: string | null | undefined): string => {
  if (!value) return ''
  const diff = daysFromToday(value)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  if (diff === -1) return 'Ayer'
  if (diff < 0 && diff > -7) return `Hace ${Math.abs(diff)} días`
  if (diff > 0 && diff < 7) return `En ${diff} días`
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
  )
}

// ── Orden de tarjetas ───────────────────────────────────────────────────────
const SEQUENCE_STEP = 1000

/**
 * Calcula la posición de una tarjeta que se suelta entre dos vecinas.
 * Usa el punto medio para no reescribir el resto de la columna.
 */
export const computeKanbanSequence = (before: number | null, after: number | null): number => {
  if (before === null && after === null) return SEQUENCE_STEP
  if (before === null) return (after as number) - SEQUENCE_STEP
  if (after === null) return before + SEQUENCE_STEP
  return (before + after) / 2
}
