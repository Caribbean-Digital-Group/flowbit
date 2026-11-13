// Utilidades puras del módulo de Aprobaciones (TRY-18): etiquetas, catálogos de
// reglas y validaciones que el panel usa antes de llamar al motor. La fuente de
// verdad sigue siendo la base de datos (approval_resolve_plan, approval_submit_*):
// aquí solo se adelanta el aviso al usuario.
//
// Nota: sin `as const` en arreglos exportados (ver memoria «Bug auto-import mlly»).
import type {
  ApprovalApproverKind,
  ApprovalApproverStatus,
  ApprovalCondition,
  ApprovalConditionOp,
  ApprovalConditionRule,
  ApprovalEscalationAction,
  ApprovalFieldDefinition,
  ApprovalFieldType,
  ApprovalFieldValues,
  ApprovalPriority,
  ApprovalRequestStatus,
  ApprovalStepMode,
  ApprovalStepStatus
} from '~/types/approval.types'

export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info'

export type SelectOption = {
  value: string
  label: string
}

// ─── Estados ────────────────────────────────────────────────────────────────

export const APPROVAL_STATUS_LABELS: Record<ApprovalRequestStatus, string> = {
  draft: 'Borrador',
  published: 'En revisión',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
  returned: 'Devuelta',
  expired: 'Expirada'
}

export const APPROVAL_STATUS_VARIANTS: Record<ApprovalRequestStatus, BadgeVariant> = {
  draft: 'secondary',
  published: 'primary',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'warning',
  returned: 'warning',
  expired: 'secondary'
}

/** Clases para el badge del Datatable (columna `status`). */
export const APPROVAL_STATUS_BADGE_COLORS: Record<ApprovalRequestStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  published: 'bg-indigo-100 text-indigo-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-amber-100 text-amber-700',
  returned: 'bg-orange-100 text-orange-700',
  expired: 'bg-slate-200 text-slate-600'
}

export const approvalStatusLabel = (status: string | null | undefined): string =>
  status && status in APPROVAL_STATUS_LABELS
    ? APPROVAL_STATUS_LABELS[status as ApprovalRequestStatus]
    : 'Sin estado'

export const approvalStatusVariant = (status: string | null | undefined): BadgeVariant =>
  status && status in APPROVAL_STATUS_VARIANTS
    ? APPROVAL_STATUS_VARIANTS[status as ApprovalRequestStatus]
    : 'secondary'

export const isApprovalResolved = (status: string | null | undefined): boolean =>
  status === 'approved' || status === 'rejected' || status === 'cancelled' || status === 'expired'

// ─── Prioridad ──────────────────────────────────────────────────────────────

export const APPROVAL_PRIORITY_LABELS: Record<ApprovalPriority, string> = {
  low: 'Baja',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente'
}

export const APPROVAL_PRIORITY_ORDER: Record<ApprovalPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3
}

export const APPROVAL_PRIORITY_BADGE_COLORS: Record<ApprovalPriority, string> = {
  urgent: 'bg-red-100 text-red-700',
  high: 'bg-amber-100 text-amber-700',
  normal: 'bg-slate-100 text-slate-600',
  low: 'bg-sky-100 text-sky-700'
}

export const APPROVAL_PRIORITY_OPTIONS: SelectOption[] = (
  ['low', 'normal', 'high', 'urgent'] satisfies ApprovalPriority[]
).map(value => ({ value, label: APPROVAL_PRIORITY_LABELS[value] }))

// ─── Niveles y aprobadores ──────────────────────────────────────────────────

export const APPROVAL_STEP_MODE_LABELS: Record<ApprovalStepMode, string> = {
  any: 'Basta con uno',
  all: 'Todos deben aprobar',
  quorum: 'Mínimo de aprobaciones'
}

export const APPROVAL_STEP_STATUS_LABELS: Record<ApprovalStepStatus, string> = {
  waiting: 'En espera',
  active: 'En curso',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  skipped: 'Omitido',
  cancelled: 'Cancelado'
}

export const APPROVAL_APPROVER_STATUS_LABELS: Record<ApprovalApproverStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobó',
  rejected: 'Rechazó',
  revoked: 'Revocó',
  skipped: 'No fue necesario',
  reassigned: 'Reasignó',
  informed: 'Informado',
  cancelled: 'Cancelado'
}

export const APPROVAL_APPROVER_KIND_LABELS: Record<ApprovalApproverKind, string> = {
  manager: 'Aprobador específico',
  category_managers: 'Aprobadores de la categoría',
  owners: 'Owners de la empresa',
  direct_manager: 'Jefe directo del solicitante',
  manager_chain: 'Cadena de jefes hasta cubrir el monto',
  department_manager: 'Responsable del departamento'
}

/** Por qué una persona quedó como aprobadora (approval_request_approver.resolved_via). */
export const APPROVAL_RESOLVED_VIA_LABELS: Record<string, string> = {
  manager: 'Asignado',
  category_managers: 'Aprobador de la categoría',
  owners: 'Owner',
  owners_fallback: 'Owner (respaldo)',
  direct_manager: 'Jefe directo',
  department_manager: 'Responsable del departamento',
  manager_chain: 'Cadena de jefes',
  limit_escalation: 'Escalado por límite de monto',
  ad_hoc: 'Agregado durante la revisión',
  reassigned: 'Reasignado',
  escalation: 'Escalado por plazo',
  self_unavoidable: 'Único owner'
}

export const APPROVAL_ESCALATION_LABELS: Record<ApprovalEscalationAction, string> = {
  remind: 'Solo recordar',
  escalate_manager: 'Escalar al jefe del aprobador',
  escalate_owners: 'Escalar a los owners',
  auto_approve: 'Aprobar automáticamente',
  auto_reject: 'Rechazar automáticamente'
}

// ─── Bitácora y avisos ──────────────────────────────────────────────────────

export const APPROVAL_EVENT_LABELS: Record<string, string> = {
  created: 'Creó la solicitud',
  created_from_source: 'Creada desde otro módulo',
  created_from_recurring: 'Creada por una plantilla recurrente',
  submitted: 'Envió la solicitud',
  resubmitted: 'Reenvió la solicitud',
  level_activated: 'Se activó un nivel',
  level_completed: 'Se completó un nivel',
  approved_by: 'Aprobó',
  rejected_by: 'Rechazó',
  returned: 'Devolvió para corrección',
  revoked: 'Revocó su aprobación',
  approver_added: 'Agregó un aprobador',
  reassigned: 'Reasignó la aprobación',
  forced: 'Forzó la resolución',
  edited: 'Editó la solicitud',
  critical_change: 'Cambio crítico: el flujo se reinició',
  reset_to_draft: 'Regresó a borrador',
  comment: 'Comentó',
  attachment_added: 'Adjuntó un archivo',
  attachment_removed: 'Quitó un archivo',
  reminder: 'Recordatorio enviado',
  escalated: 'Escalada por plazo vencido',
  sla_auto_approve: 'Aprobado por plazo vencido',
  sla_auto_reject: 'Rechazada por plazo vencido',
  migrated_to_engine: 'Migrada al motor de aprobaciones',
  resolved: 'Solicitud resuelta'
}

export const APPROVAL_ACTIVITY_LABELS: Record<string, string> = {
  assigned: 'Por aprobar',
  informed: 'Para tu conocimiento',
  reminder: 'Recordatorio',
  escalated: 'Escalada',
  delegated: 'Reasignada a ti',
  approved: 'Aprobada',
  auto_approved: 'Aprobada automáticamente',
  rejected: 'Rechazada',
  returned: 'Devuelta',
  cancelled: 'Cancelada',
  expired: 'Expirada',
  comment: 'Comentario',
  mention: 'Mención',
  level_advanced: 'Avanzó de nivel',
  recurring: 'Borrador recurrente'
}

export const approvalEventLabel = (type: string): string => APPROVAL_EVENT_LABELS[type] ?? type

// ─── Formulario dinámico ────────────────────────────────────────────────────

export const APPROVAL_FIELD_TYPE_LABELS: Record<ApprovalFieldType, string> = {
  text: 'Texto corto',
  textarea: 'Texto largo',
  number: 'Número',
  money: 'Monto',
  date: 'Fecha',
  daterange: 'Rango de fechas',
  select: 'Lista de opciones',
  partner: 'Contacto / proveedor',
  employee: 'Empleado',
  product: 'Producto'
}

export const APPROVAL_FIELD_TYPE_OPTIONS: SelectOption[] = (
  Object.keys(APPROVAL_FIELD_TYPE_LABELS) as ApprovalFieldType[]
).map(value => ({ value, label: APPROVAL_FIELD_TYPE_LABELS[value] }))

/** Convierte una etiqueta en clave estable: «Centro de costos» → centro_costos */
export const toFieldKey = (label: string): string =>
  label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(de|del|la|las|el|los|y)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)

export const isEmptyFieldValue = (value: ApprovalFieldValues[string] | undefined): boolean => {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim() === ''
  if (typeof value === 'object') return !value.from && !value.to
  return false
}

/** Problemas del diseño del formulario (editor de categoría). */
export const fieldSchemaIssues = (schema: ApprovalFieldDefinition[]): string[] => {
  const issues: string[] = []
  const keys = new Set<string>()
  schema.forEach((field, index) => {
    const n = index + 1
    if (!field.label?.trim()) issues.push(`El campo ${n} no tiene nombre`)
    if (!field.key?.trim()) issues.push(`El campo ${n} no tiene clave`)
    else if (!/^[a-z][a-z0-9_]*$/.test(field.key)) issues.push(`La clave «${field.key}» solo admite minúsculas, números y guion bajo`)
    else if (keys.has(field.key)) issues.push(`La clave «${field.key}» está repetida`)
    keys.add(field.key)
    if (field.type === 'select' && (!field.options || field.options.filter(o => o.trim()).length === 0)) {
      issues.push(`«${field.label || field.key}» necesita al menos una opción`)
    }
  })
  return issues
}

/** Campos obligatorios sin llenar (el motor lo vuelve a validar al enviar). */
export const missingRequiredFields = (
  schema: ApprovalFieldDefinition[],
  values: ApprovalFieldValues
): string[] =>
  schema.filter(f => f.required && isEmptyFieldValue(values[f.key])).map(f => f.label || f.key)

export const formatFieldValue = (
  field: ApprovalFieldDefinition,
  value: ApprovalFieldValues[string] | undefined,
  lookup?: (type: ApprovalFieldType, id: string) => string | undefined
): string => {
  if (isEmptyFieldValue(value)) return '—'
  if (typeof value === 'object' && value !== null) {
    return `${formatDateMx(value.from)} – ${formatDateMx(value.to)}`
  }
  if (field.type === 'money' && value !== null) return formatMoneyMx(Number(value))
  if (field.type === 'date' && typeof value === 'string') return formatDateMx(value)
  if ((field.type === 'partner' || field.type === 'employee' || field.type === 'product') && typeof value === 'string') {
    return lookup?.(field.type, value) ?? value
  }
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  return String(value)
}

// ─── Condiciones ────────────────────────────────────────────────────────────

export const APPROVAL_CONDITION_OP_LABELS: Record<ApprovalConditionOp, string> = {
  eq: 'es igual a',
  neq: 'es distinto de',
  gt: 'es mayor que',
  gte: 'es mayor o igual que',
  lt: 'es menor que',
  lte: 'es menor o igual que',
  between: 'está entre',
  in: 'es uno de',
  not_in: 'no es ninguno de',
  contains: 'contiene',
  empty: 'está vacío',
  not_empty: 'tiene valor'
}

export const APPROVAL_CONDITION_OP_OPTIONS: SelectOption[] = (
  Object.keys(APPROVAL_CONDITION_OP_LABELS) as ApprovalConditionOp[]
).map(value => ({ value, label: APPROVAL_CONDITION_OP_LABELS[value] }))

/** Campos base disponibles en las condiciones; los dinámicos se agregan como field.<clave>. */
export const APPROVAL_CONDITION_BASE_FIELDS: SelectOption[] = [
  { value: 'amount', label: 'Monto' },
  { value: 'priority', label: 'Prioridad' },
  { value: 'lines_total', label: 'Total de partidas' },
  { value: 'line_count', label: 'Número de partidas' },
  { value: 'department_id', label: 'Departamento del solicitante' },
  { value: 'requester_partner_id', label: 'Solicitante' },
  { value: 'product_ids', label: 'Productos en las partidas' }
]

export const conditionFieldOptions = (schema: ApprovalFieldDefinition[]): SelectOption[] => [
  ...APPROVAL_CONDITION_BASE_FIELDS,
  ...schema.map(f => ({ value: `field.${f.key}`, label: `Campo: ${f.label}` }))
]

export const operatorNeedsValue = (op: ApprovalConditionOp): boolean => op !== 'empty' && op !== 'not_empty'

/** Texto legible de una condición, p. ej. «Monto es mayor o igual que 50,000». */
export const describeCondition = (
  condition: ApprovalCondition | null | undefined,
  fieldLabels: Record<string, string> = {}
): string => {
  if (!condition || !condition.rules?.length) return 'Siempre'
  const labels: Record<string, string> = Object.fromEntries(APPROVAL_CONDITION_BASE_FIELDS.map(f => [f.value, f.label]))
  const parts = condition.rules.map((rule) => {
    const field = fieldLabels[rule.field] ?? labels[rule.field] ?? rule.field.replace(/^field\./, '')
    const op = APPROVAL_CONDITION_OP_LABELS[rule.op] ?? rule.op
    if (!operatorNeedsValue(rule.op)) return `${field} ${op}`
    const value = Array.isArray(rule.value)
      ? (rule.op === 'between' ? rule.value.map(formatRuleValue).join(' y ') : rule.value.map(formatRuleValue).join(', '))
      : formatRuleValue(rule.value)
    return `${field} ${op} ${value}`
  })
  return parts.join(condition.match === 'any' ? ' o ' : ' y ')
}

const formatRuleValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—'
  const n = typeof value === 'number' ? value : Number(value)
  if (typeof value !== 'boolean' && Number.isFinite(n) && String(value).trim() !== '') {
    return new Intl.NumberFormat('es-MX').format(n)
  }
  return String(value)
}

/** Limpia una condición antes de guardarla: quita reglas incompletas. */
export const normalizeCondition = (condition: ApprovalCondition | null): ApprovalCondition | null => {
  if (!condition) return null
  const rules = condition.rules
    .filter(r => r.field && r.op)
    .filter(r => !operatorNeedsValue(r.op) || !(r.value === undefined || r.value === null || r.value === ''))
    .map((r): ApprovalConditionRule => {
      if (!operatorNeedsValue(r.op)) return { field: r.field, op: r.op }
      if ((r.op === 'in' || r.op === 'not_in') && typeof r.value === 'string') {
        return { ...r, value: r.value.split(',').map(v => v.trim()).filter(Boolean) }
      }
      return r
    })
  return rules.length ? { match: condition.match, rules } : null
}

// ─── Validación de flujos (editor) ──────────────────────────────────────────

export interface FlowStepDraft {
  name: string
  sequence: number
  mode: ApprovalStepMode
  quorum: number | null
  informative: boolean
  approvers: Array<{ kind: ApprovalApproverKind; approval_manager_id: string | null }>
}

export const flowIssues = (steps: FlowStepDraft[]): string[] => {
  const issues: string[] = []
  if (steps.length === 0) issues.push('El flujo no tiene niveles: las solicitudes irán a los owners')
  steps.forEach((step) => {
    const label = step.name?.trim() || `Nivel ${step.sequence}`
    if (!step.name?.trim()) issues.push(`Un nivel de la secuencia ${step.sequence} no tiene nombre`)
    if (step.approvers.length === 0) issues.push(`«${label}» no tiene aprobadores: pasará a los owners`)
    if (step.approvers.some(a => a.kind === 'manager' && !a.approval_manager_id)) {
      issues.push(`«${label}» tiene un aprobador específico sin elegir`)
    }
    if (step.mode === 'quorum' && (!step.quorum || step.quorum < 1)) issues.push(`«${label}» necesita el número mínimo de aprobaciones`)
    const fixedPeople = step.approvers.filter(a => a.kind === 'manager').length
    const onlyFixed = step.approvers.every(a => a.kind === 'manager')
    if (step.mode === 'quorum' && step.quorum && onlyFixed && step.quorum > fixedPeople) {
      issues.push(`«${label}» pide ${step.quorum} aprobaciones pero solo tiene ${fixedPeople} aprobadores`)
    }
  })
  if (steps.length > 0 && steps.every(s => s.informative)) {
    issues.push('Todos los niveles son informativos: las solicitudes se aprobarán sin que nadie decida')
  }
  return issues
}

// ─── Formato y exportación ──────────────────────────────────────────────────

export const formatMoneyMx = (amount: number | null | undefined, currency = 'MXN'): string => {
  if (amount === null || amount === undefined || !Number.isFinite(Number(amount))) return '—'
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency || 'MXN' }).format(Number(amount))
}

export const formatDateMx = (iso: string | null | undefined): string => {
  if (!iso) return '—'
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(date)
}

export const formatDateTimeMx = (iso: string | null | undefined): string => {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export const formatHours = (hours: number | null | undefined): string => {
  if (hours === null || hours === undefined || !Number.isFinite(Number(hours))) return '—'
  const h = Number(hours)
  if (h < 1) return `${Math.round(h * 60)} min`
  if (h < 48) return `${h.toFixed(1)} h`
  return `${(h / 24).toFixed(1)} días`
}

/** Descarga un texto como archivo (solo navegador). */
export const downloadText = (filename: string, content: string, mime = 'text/csv;charset=utf-8'): void => {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

// ─── Errores del motor ──────────────────────────────────────────────────────

/** Los RPC ya responden en español; aquí se traducen los errores genéricos de Postgres/RLS. */
export const approvalErrorMessage = (error: { message?: string; code?: string } | null | undefined): string => {
  const message = error?.message ?? ''
  if (!message) return 'Ocurrió un error inesperado.'
  if (message.includes('row-level security')) return 'No tienes permiso para hacer este cambio.'
  if (message.includes('duplicate key') && message.includes('internal_code')) return 'Ya existe una categoría con ese código.'
  if (message.includes('duplicate key')) return 'Ese registro ya existe.'
  if (message.includes('violates foreign key')) return 'El registro está relacionado con otros datos y no se puede modificar así.'
  if (message.includes('JWT') || message.includes('not authenticated')) return 'Tu sesión expiró. Vuelve a iniciar sesión.'
  return message
}
