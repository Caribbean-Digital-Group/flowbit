/**
 * Catálogos, cálculos de fechas y mensajes de Recursos Humanos
 * (horarios, asistencia, kiosco, vacaciones, permisos, inasistencias y salarios).
 */

export type HrOption = { value: string; label: string }

export const WEEKDAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] as const
export const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const

/** Orden de lunes a domingo para mostrar horarios. */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export const LEAVE_KIND_OPTIONS: HrOption[] = [
  { value: 'vacation', label: 'Vacaciones' },
  { value: 'paid_leave', label: 'Permiso con goce de sueldo' },
  { value: 'unpaid_leave', label: 'Permiso sin goce de sueldo' },
  { value: 'sick', label: 'Incapacidad IMSS' }
]

export const LEAVE_KIND_LABELS: Record<string, string> = Object.fromEntries(LEAVE_KIND_OPTIONS.map(o => [o.value, o.label]))

export const LEAVE_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada'
}

export const LEAVE_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-600'
}

export const LEAVE_COLOR_OPTIONS: HrOption[] = [
  { value: 'indigo', label: 'Índigo' },
  { value: 'emerald', label: 'Verde' },
  { value: 'sky', label: 'Azul' },
  { value: 'amber', label: 'Ámbar' },
  { value: 'rose', label: 'Rosa' },
  { value: 'violet', label: 'Violeta' },
  { value: 'slate', label: 'Gris' }
]

export const ABSENCE_KIND_LABELS: Record<string, string> = {
  unjustified: 'Injustificada',
  justified: 'Justificada'
}

export const OVERTIME_STATUS_LABELS: Record<string, string> = {
  none: 'Sin horas extra',
  pending: 'Por aprobar',
  approved: 'Aprobadas',
  rejected: 'Rechazadas'
}

export const SALARY_TYPE_OPTIONS: HrOption[] = [
  { value: 'monthly', label: 'Mensual' },
  { value: 'daily', label: 'Diario' }
]

export const SALARY_REASON_OPTIONS: HrOption[] = [
  { value: 'hire', label: 'Contratación' },
  { value: 'raise', label: 'Aumento' },
  { value: 'promotion', label: 'Promoción' },
  { value: 'minimum_wage', label: 'Ajuste al salario mínimo' },
  { value: 'adjustment', label: 'Ajuste' },
  { value: 'other', label: 'Otro' }
]

export const SALARY_REASON_LABELS: Record<string, string> = Object.fromEntries(SALARY_REASON_OPTIONS.map(o => [o.value, o.label]))

export const TIMEZONE_OPTIONS: HrOption[] = [
  { value: 'America/Mexico_City', label: 'Centro (Ciudad de México)' },
  { value: 'America/Cancun', label: 'Sureste (Quintana Roo)' },
  { value: 'America/Chihuahua', label: 'Chihuahua' },
  { value: 'America/Mazatlan', label: 'Pacífico (Sinaloa, Nayarit, BCS)' },
  { value: 'America/Hermosillo', label: 'Sonora' },
  { value: 'America/Tijuana', label: 'Noroeste (Baja California)' },
  { value: 'America/Matamoros', label: 'Frontera noreste' },
  { value: 'America/Ciudad_Juarez', label: 'Ciudad Juárez' }
]

// ─── Fechas ─────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`

/** n-ésimo lunes de un mes (1 = primero). */
const nthMonday = (year: number, month: number, n: number): string => {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const offset = (8 - first) % 7
  return iso(year, month, 1 + offset + (n - 1) * 7)
}

/**
 * Días de descanso obligatorio del art. 74 LFT. Los aniversarios de la
 * Constitución, Juárez y la Revolución se recorren al lunes. El 1 de octubre
 * aplica cada seis años por la transmisión del Poder Ejecutivo (2024, 2030…).
 */
export const mexicoStatutoryHolidays = (year: number): { date: string; name: string }[] => {
  const days = [
    { date: iso(year, 1, 1), name: 'Año Nuevo' },
    { date: nthMonday(year, 2, 1), name: 'Día de la Constitución' },
    { date: nthMonday(year, 3, 3), name: 'Natalicio de Benito Juárez' },
    { date: iso(year, 5, 1), name: 'Día del Trabajo' },
    { date: iso(year, 9, 16), name: 'Día de la Independencia' },
    { date: nthMonday(year, 11, 3), name: 'Día de la Revolución' },
    { date: iso(year, 12, 25), name: 'Navidad' }
  ]
  if ((year - 2024) % 6 === 0) days.push({ date: iso(year, 10, 1), name: 'Transmisión del Poder Ejecutivo Federal' })
  return days.sort((a, b) => a.date.localeCompare(b.date))
}

/** Fecha de hoy (yyyy-mm-dd) en una zona horaria. */
export const todayIn = (timezone = 'America/Mexico_City'): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

export const firstDayOfMonth = (date: string): string => `${date.slice(0, 7)}-01`

/** Minutos a «7 h 30 min». */
export const formatMinutes = (minutes: number | null | undefined): string => {
  const total = Math.max(0, Math.round(Number(minutes) || 0))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

/** Minutos a horas decimales con dos dígitos. */
export const minutesToHours = (minutes: number | null | undefined): number =>
  Math.round(((Number(minutes) || 0) / 60) * 100) / 100

/** Hora local hh:mm de un timestamp. */
export const formatClockTime = (timestamp: string | null | undefined, timezone = 'America/Mexico_City'): string => {
  if (!timestamp) return '—'
  return new Intl.DateTimeFormat('es-MX', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false })
    .format(new Date(timestamp))
}

export const formatHrDate = (date: string | null | undefined): string => {
  if (!date) return '—'
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${date.slice(0, 10)}T00:00:00Z`))
}

export const formatMoney = (amount: number | null | undefined, currency = 'MXN'): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(Number(amount) || 0)

/** Convierte fecha + hora local del formulario (datetime-local) a ISO con zona. */
export const localDateTimeToIso = (value: string): string | null => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** ISO a valor de un input datetime-local en la hora del navegador. */
export const isoToLocalDateTime = (value: string | null | undefined): string => {
  if (!value) return ''
  const d = new Date(value)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Minutos programados de una línea de horario. */
export const scheduledMinutes = (start: string, end: string, breakMinutes: number): number => {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number) as [number, number]
    return h * 60 + m
  }
  return Math.max(0, toMin(end) - toMin(start) - breakMinutes)
}

// ─── Validaciones ───────────────────────────────────────────────────────────

export const validatePin = (pin: string, minLength: number): string | null => {
  if (!/^\d+$/.test(pin)) return 'El NIP solo puede tener números.'
  if (pin.length < minLength || pin.length > 8) return `El NIP debe tener entre ${minLength} y 8 dígitos.`
  return null
}

export interface ScheduleLineInput {
  weekday: number
  start_time: string
  end_time: string
  break_minutes: number | string
}

export const validateScheduleLines = (lines: ScheduleLineInput[]): string | null => {
  if (lines.length === 0) return 'Activa al menos un día laborable.'
  for (const line of lines) {
    const day = WEEKDAY_LABELS[line.weekday] ?? 'Día'
    if (!line.start_time || !line.end_time) return `Indica la hora de entrada y salida del ${day.toLowerCase()}.`
    if (line.end_time <= line.start_time) return `La salida del ${day.toLowerCase()} debe ser posterior a la entrada.`
    if (scheduledMinutes(line.start_time, line.end_time, Number(line.break_minutes) || 0) <= 0) {
      return `La comida del ${day.toLowerCase()} no puede durar toda la jornada.`
    }
  }
  return null
}

// ─── Errores ────────────────────────────────────────────────────────────────

/** Traduce los errores de la base de datos que el usuario puede corregir. */
export const hrErrorMessage = (error: { message: string; code?: string }): string => {
  const m = error.message
  if (error.code === '42501' || m.includes('permission denied')) {
    if (m.includes('own requests') || m.includes('cancel a pending')) return 'Solo puedes cancelar tus propias solicitudes pendientes.'
    return 'Solo los propietarios y administradores pueden realizar esta acción.'
  }
  if (m.includes('Insufficient balance')) return 'El empleado no tiene saldo suficiente para esta solicitud.'
  if (m.includes('overlaps')) return 'Ya existe una solicitud pendiente o aprobada en esas fechas.'
  if (m.includes('no working days')) return 'El rango no incluye días laborables del horario del empleado.'
  if (m.includes('PIN already in use')) return 'Ese NIP ya lo usa otra persona. Elige uno distinto.'
  if (m.includes('Invalid PIN')) return 'El NIP no tiene un formato válido.'
  if (m.includes('uq_hr_attendance_open')) return 'El empleado ya tiene una entrada sin salida. Ciérrala antes de registrar otra.'
  if (m.includes('hr_attendance_times')) return 'La salida debe ser posterior a la entrada.'
  if (m.includes('hr_attendance_max_length')) return 'Una marca no puede durar más de 24 horas.'
  if (m.includes('uq_hr_work_schedule_name')) return 'Ya existe un horario con ese nombre.'
  if (m.includes('uq_hr_leave_type_name')) return 'Ya existe un tipo de ausencia con ese nombre.'
  if (m.includes('uq_hr_holiday_date')) return 'Ya hay un día festivo en esa fecha.'
  if (m.includes('uq_hr_salary_effective')) return 'El empleado ya tiene un salario con esa fecha de vigencia.'
  if (m.includes('hr_absence_day_key')) return 'Ya existe una inasistencia de ese empleado en esa fecha.'
  if (m.includes('uq_hr_leave_allocation_service_year')) return 'Ya existe la asignación de ese año de servicio.'
  if (m.includes('reviewed request')) return 'Una solicitud revisada no puede cambiar de fechas ni de tipo.'
  if (m.includes('Only pending')) return 'Solo se pueden revisar solicitudes pendientes.'
  if (m.includes('no vacation leave type')) return 'Crea primero un tipo de ausencia de vacaciones.'
  if (m.includes('exceed one year')) return 'El rango no puede ser mayor a un año.'
  if (m.includes('payroll period is closed')) return 'La nómina ya está aprobada, pagada o cancelada.'
  if (m.includes('Invalid payroll status')) return 'Ese cambio de estado no está permitido.'
  if (m.includes('cannot change')) return 'Ese dato ya no se puede modificar.'
  if (m.includes('uq_payroll_fiscal_config_year')) return 'Ya existe la configuración fiscal de ese año.'
  if (m.includes('payroll_period_dates')) return 'El periodo no puede durar más de 31 días ni terminar antes de empezar.'
  return 'No se pudo completar la operación. Revisa los datos e inténtalo de nuevo.'
}

/** Mensajes del kiosco por código de error del RPC. */
export const KIOSK_ERROR_MESSAGES: Record<string, string> = {
  invalid_kiosk: 'Este kiosco ya no está activo. Pide a un administrador la nueva dirección.',
  locked: 'Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.',
  invalid_pin: 'NIP incorrecto. Inténtalo de nuevo.',
  duplicate: 'Ya registramos tu marca hace un momento.'
}
