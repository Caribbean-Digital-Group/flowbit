# Recursos Humanos: asistencia y ausencias

Complementa el módulo de [Empleados](employees.md). Cubre horarios, kiosco de entrada y salida, asistencia, inasistencias, vacaciones y permisos. La nómina vive en [payroll.md](payroll.md).

Migración: `20261107180000_create_hr_payroll_suite.sql`. Tipos temporales: `types/hr.types.ts` (shim hasta correr `db:types`).

## Modelo de datos

| Tabla | Contenido | Lee | Escribe |
|---|---|---|---|
| `hr_settings` | Zona horaria, tolerancia, horas extra, NIP, periodicidad. Una fila por empresa | Owner/admin | Owner/admin |
| `hr_work_schedule` / `_line` | Horario y una línea por día laborable (0 = domingo) | Equipo | RPC `hr_save_work_schedule` |
| `hr_holiday` | Días no laborables (`is_statutory` = art. 74 LFT) | Equipo | Owner/admin |
| `hr_attendance` | Cada par entrada/salida | Owner/admin y la persona | Owner/admin, kiosco |
| `hr_attendance_day` | Resumen diario: trabajado, retardo, horas extra | Owner/admin y la persona | Solo la base |
| `hr_kiosk` | Kioscos. Guarda el hash del token | Owner/admin | RPC |
| `hr_kiosk_pin` | Hash del NIP por empleado | Nadie (sin políticas) | RPC |
| `hr_kiosk_attempt` | Intentos para el bloqueo | Nadie | Kiosco |
| `hr_leave_type` | Tipos de ausencia con su clase | Equipo | Owner/admin |
| `hr_leave_allocation` | Días asignados (saldo) | Owner/admin y la persona | Owner/admin |
| `hr_leave_request` | Solicitudes | Owner/admin y la persona | Owner/admin; la persona solo crea pendientes y cancela |
| `hr_absence` | Inasistencias | Owner/admin y la persona | Owner/admin |

«La persona» es el empleado cuyo `partner.user_id` es el usuario con sesión (`hr_is_own_employee`). Un miembro del equipo que no es empleado no ve datos de RR. HH. ajenos.

`employee.work_schedule_id` asigna el horario. Es dato laboral, así que lo lee el equipo.

## Asistencia

- El trigger `hr_attendance_before_write` calcula `work_date` en la zona horaria de la empresa y `worked_minutes`.
- `hr_recompute_attendance_day` rehace el resumen del día tras cada cambio de marcas:
  - **Trabajado** = suma de marcas − la comida que no cubren las salidas registradas.
  - **Retardo** = minutos desde la entrada programada, si superan la tolerancia (la del horario o la de la empresa).
  - **Horas extra** = trabajado − programado, solo con el día cerrado y desde `overtime_min_minutes`.
  - Día sin línea en el horario = `is_rest_day`. Festivo activo = `is_holiday`.
- Las horas extra quedan `pending` si `overtime_requires_approval`, y se aprueban con `hr_review_overtime`. Si un recálculo no cambia las horas extra, la revisión se conserva.
- La nómina solo paga `overtime_approved_minutes`.
- Solo puede haber una marca abierta por persona (`uq_hr_attendance_open`).
- Los turnos no cruzan la medianoche (`end_time > start_time`). Para turnos nocturnos hay que capturar a mano.

`hr_attendance_summary(company, from, to)` es `SECURITY INVOKER`: cada usuario recibe lo que su RLS le permite.

## Kiosco

Página pública `/kiosk/{token}` sin sesión. Llama a los RPC `kiosk_info` y `kiosk_punch`, ambos con `GRANT` a `anon`.

- El token tiene 256 bits (dos UUID v4). Solo se guarda `sha256(token)`, y se muestra una vez al crear o regenerar.
- El NIP (4 a 8 dígitos, mínimo configurable) se guarda como `sha256(pin_salt || ':' || NIP)`. `pin_salt` es por empresa y no cambia (`hr_settings_guard`). Es único por empresa.
- `kiosk_punch` registra el intento antes de responder, y devuelve JSON en vez de lanzar error para que el intento fallido no se revierta. Con 5 fallos en 5 minutos el kiosco se bloquea.
- Una segunda marca en menos de un minuto devuelve `duplicate`.
- Una entrada abierta de hace más de 20 horas se cierra con `missing_check_out = true` y se abre una nueva.
- `nuxt.config.ts` envía `Referrer-Policy: no-referrer` y `X-Robots-Tag: noindex` en `/kiosk/**` para que el token no se filtre.

No se usa `pgcrypto`: basta `sha256()` nativo, porque la fuerza bruta la limitan el bloqueo y el secreto del token.

## Vacaciones y permisos

| `kind` | Nómina |
|---|---|
| `vacation` | Se paga y genera prima vacacional. Descuenta saldo |
| `paid_leave` | Se paga |
| `unpaid_leave` | No se paga y no cotiza |
| `sick` | Incapacidad: la cubre el IMSS y no cotiza (salvo Retiro) |

- `days` lo calcula `hr_count_leave_days`: días con línea en el horario del empleado (lunes a viernes si no tiene), sin festivos. `half_day` vale 0.5.
- Aprobar solo es posible con `hr_review_leave_request`. Valida el saldo si el tipo `deducts_balance` y justifica las faltas del rango. El guard bloquea la aprobación directa con `UPDATE`.
- Cancelar una solicitud aprobada devuelve sus faltas a injustificadas.
- No se traslapan solicitudes pendientes o aprobadas del mismo empleado.
- `hr_generate_vacation_allocations(company, as_of)` asigna los días del año de servicio en curso (art. 76 LFT 2023): 12, 14, 16, 18, 20 y luego +2 cada cinco años. Si `employee_private.vacation_days` tiene valor, usa ese número. Es idempotente por `(empleado, tipo, service_year)`. La vigencia es de 18 meses.
- `v_hr_leave_balances` suma todas las asignaciones activas, sin descontar las vencidas.
- `hr_ensure_defaults` crea los ajustes y cuatro tipos básicos la primera vez.

## Inasistencias

`hr_detect_absences(company, from, to)` inserta una falta injustificada por día laborable sin `hr_attendance_day`, sin festivo y sin permiso aprobado. Revisa hasta ayer y solo empleados activos con horario. `(employee_id, absence_date)` es único: detectar de nuevo no duplica y una falta descartada (`active = false`) no reaparece.

Si después llega una marca de ese día, el trigger `hr_attendance_day_clears_absence` descarta la falta.

La nómina descuenta las faltas con `deduct_from_pay` que no vienen de un permiso.

## Festivos

`mexicoStatutoryHolidays(year)` en `app/utils/hr.ts` genera los días del art. 74 con los lunes recorridos y el 1 de octubre cada seis años (2024, 2030…).

## Código

| Pieza | Archivo |
|---|---|
| Utilidades, catálogos y errores | `app/utils/hr.ts` |
| Composables | `useHrClient`, `useHrSettings`, `useWorkSchedule`, `useAttendance`, `useKiosk` (+ `useKioskPublic`), `useLeave`, `useAbsence` |
| Componentes | `Hr/Notice`, `Hr/RangeFilter`, `WorkSchedule/Form`, `LeaveType/Form`, `LeaveRequest/Form` |
| Páginas | `/admin/work-schedules`, `/admin/attendances` (+ `report`), `/admin/absences`, `/admin/leaves`, `/admin/leave-allocations`, `/admin/leave-types`, `/admin/holidays`, `/admin/kiosks`, `/kiosk/[token]` |

## Nota sobre auto-imports

`mlly` (el escáner de exportaciones de Nuxt) se come la declaración siguiente a una línea como `export const X = [1, 2, 0] as const` sin punto y coma: el arreglo termina en caracteres que su expresión regular acepta y continúa en la línea siguiente. Por eso `WEEKDAY_ORDER` termina en `;`. Si una constante de `app/utils` no aparece en `.nuxt/imports.d.ts`, revisa este patrón.
