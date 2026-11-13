# Aprobaciones: motor multinivel

Cómo funciona el módulo de Aprobaciones desde TRY-18. Para el uso desde el panel, ver el manual (`/manual/approval-requests-list`, `approval-flows`, `approval-settings` y `approval-dashboard`).

## Decisiones de diseño

| Decisión | Por qué |
|---|---|
| El motor vive en Postgres (RPC `SECURITY DEFINER`) | Igual que RR. HH. y órdenes: nadie se salta un nivel desde el cliente. La vista previa y el simulador llaman a la misma función que el envío (`approval_resolve_plan`), así que nunca muestran algo distinto de lo que pasará. |
| El flujo se copia en la solicitud al enviarla | `approval_flow` es una plantilla. Al enviar, sus niveles se materializan en `approval_request_step` y `approval_request_approver`. Editar un flujo no afecta a las solicitudes en curso, y la versión (`approval_flow.version`) sube sola. |
| El modo simple se modela como un flujo de un nivel | Hay un solo motor. Una categoría sin `flow_id` se comporta como antes: el solicitante elige a un aprobador registrado que autorice la categoría, y esa persona decide. |
| Estado general y niveles aparte | `approval_request.status` solo tiene `draft`, `published` (en la interfaz, «En revisión»), `approved`, `rejected`, `cancelled`, `returned` y `expired`. El «nivel N de M» se calcula a partir de los pasos de la ronda actual. |
| Bitácora de solo inserción | `approval_request_event` no admite `UPDATE` ni `DELETE` (trigger), y cada evento guarda `sha256(prev_hash ‖ contenido)`. `approval_verify_event_chain` detecta alteraciones. |
| Avisos como actividades | No hay proveedor de correo. Cada aviso es una fila de `approval_activity` que leen la campana del panel y la agenda. |

### Decisiones del dueño

- Modo simple sin cambios: el solicitante elige a un aprobador.
- Aprueban los aprobadores registrados activos y los owners de la empresa (`approval_is_eligible`).
- Si un nivel no resuelve a nadie (sin jefe directo, sin aprobadores de la categoría, ninguna condición aplica), pasa a los owners.
- Un aprobador sin categorías asignadas no autoriza ninguna. Antes autorizaba todas.
- El reenvío tras devolución empieza en el nivel 1. Es configurable por empresa (`restart_from_first`) y por flujo.
- Owner y admin pueden forzar una resolución con motivo (`approval_force_resolve`). Queda en el reporte de cumplimiento.
- Los permisos de RR. HH. pasan por el motor.

## Modelo de datos

Migraciones: `20261108120000` (estados nuevos del enum), `20261108120100` (esquema), `20261108120200` (funciones) y `20261108120300` (seguridad, integraciones y migración de datos).

| Tabla | Para qué |
|---|---|
| `approval_settings` | Políticas por empresa: funciones avanzadas, no aprobar lo propio, no pedir dos veces, motivo obligatorio, plazos y escalamiento. Sin fila = valores por defecto. |
| `approval_category` (+) | `flow_id`, `field_schema` (formulario dinámico), `allow_lines`, `require_attachment`, `confidential`, `critical_fields`, `sla_days`, `auto_approve_max_amount`, `source_kind` |
| `approval_manager(_category)` (+) | `max_amount`: límite general y por categoría |
| `approval_flow` / `_step` / `_step_approver` | Plantilla: niveles (secuencia, modo `any`/`all`/`quorum`, informativo, condición, plazo) y reglas de aprobadores |
| `approval_request` (+) | Prioridad, fecha requerida, `field_values`, capturista (en nombre de), origen (`source_type`/`source_id`), ronda, fechas de cada estado, nota y motivo de resolución, `forced`, `auto_approved` |
| `approval_request_line` | Partidas. Con partidas activas, el monto es su suma (trigger). |
| `approval_request_step` / `_approver` | Copia del flujo por ronda y decisión de cada persona |
| `approval_request_event` | Bitácora encadenada, con IP y user-agent cuando PostgREST los envía |
| `approval_request_comment` | Conversación con menciones |
| `approval_request_attachment` | Metadatos. Los archivos viven en el bucket privado `approval-attachments`, con la ruta `{company}/{request}/{archivo}`. |
| `approval_rejection_reason` | Catálogo de motivos de rechazo |
| `approval_delegation` | Suplencias temporales (con fechas) o permanentes, opcionalmente por categoría |
| `approval_activity` | Avisos por persona (campana y agenda) |
| `approval_request_template` | Plantillas personales o de la empresa; las recurrentes crean un borrador cada semana o mes |

## Resolución del plan (`approval_resolve_plan`)

1. **Modo simple:** un nivel con el aprobador elegido. Si la solicitud viene de otro módulo y no tiene aprobador elegido, decide el jefe directo y, si no hay, los owners.
2. **Flujo:** por cada nivel activo cuya condición se cumple, se resuelven sus reglas:
   - `manager`: una persona concreta.
   - `category_managers`: los aprobadores registrados de la categoría, filtrados por su límite de monto.
   - `owners`.
   - `direct_manager` y `department_manager`: según el organigrama de RR. HH. (`employee.manager_id` y `employee_department.manager_id`).
   - `manager_chain`: jefe, jefe del jefe… hasta alguien cuyo límite cubra el monto. Todos aprueban.
3. **Límites:** si el aprobador de una regla no cubre el monto, se escala por su cadena de jefes (`approval_escalate_for_amount`).
4. **Post-proceso:**
   - Respaldo a owners para niveles vacíos.
   - Delegación vigente (`approval_delegate_of`, sin ciclos).
   - Quitar al solicitante, si aplica. Solo con funciones avanzadas encendidas: en modo simple se respeta lo que eligió.
   - No pedir dos veces a la misma persona en niveles consecutivos.
   - Ajuste del quórum al número de personas disponibles.
   - Una empresa con un solo owner que también solicita: decide esa persona (`self_unavoidable`).

**Condiciones:** `{"match": "all" | "any", "rules": [{"field", "op", "value"}]}`.
- Campos: `amount`, `priority`, `lines_total`, `line_count`, `department_id`, `requester_partner_id`, `product_ids`, `field.<clave>`.
- Operadores: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `between`, `in`, `not_in`, `contains`, `empty`, `not_empty`.

## Ciclo de vida

| Acción | RPC | Quién |
|---|---|---|
| Enviar o reenviar | `approval_submit_request` | Solicitante, capturista, owner/admin |
| Aprobar (con observaciones) o rechazar (con motivo) | `approval_decide` | Aprobador pendiente del nivel activo |
| Devolver para corrección | `approval_return_request` | Aprobador pendiente (no aplica a solicitudes de otro módulo) |
| Revocar mi aprobación | `approval_revoke_decision` | Quien aprobó, mientras siga en revisión. Los niveles posteriores vuelven a esperar. |
| Agregar aprobador | `approval_add_approver` | Aprobador pendiente u owner/admin, en un nivel nuevo o en paralelo |
| Reasignar | `approval_reassign` | El propio aprobador u owner/admin |
| Forzar | `approval_force_resolve` | Owner/admin, con motivo |
| Editar en revisión | `approval_update_submitted` | Solicitante. Un cambio en `critical_fields` reinicia el flujo desde el nivel 1. |
| Cancelar / volver a borrador | `approval_cancel_with_reason` / `approval_reset_request_to_draft` | Solicitante u owner/admin |
| Decidir varias | `approval_bulk_decide` | Devuelve el resultado de cada solicitud |

Las firmas anteriores siguen funcionando: `approval_publish_request`, `approval_approve_request`, `approval_reject_request` y `approval_cancel_request`. Con `require_reject_reason` encendido, `approval_reject_request` sin motivo falla.

**Guard:** el trigger `approval_request_guard` impide cambiar estado, fechas de decisión, ronda, origen o resolución fuera del motor (`approval.engine = on`). También impide editar el contenido de una solicitud enviada si no es con `approval_update_submitted`.

## Plazos y escalamiento

`approval_process_sla()` corre cada hora con pg_cron (job `approval-sla`). Un owner/admin también puede correrlo para su empresa con `approval_run_sla_now`. El proceso:

- Recuerda a los aprobadores de niveles vencidos cada `reminder_every_hours`.
- Escala una vez por nivel según `escalation_action`: `escalate_manager` (jefe del aprobador o, si no hay, los owners), `escalate_owners`, `auto_approve` o `auto_reject`.
- Expira solicitudes en revisión después de `expire_after_days`.
- Crea los borradores de las plantillas recurrentes.

Los plazos cuentan días hábiles con `approval_add_business_days`: sin sábados, domingos ni días de `hr_holiday`. Vencen al final del día en la hora de la Ciudad de México.

## Integración con RR. HH.

- La categoría precargada «Vacaciones» pasa a ser **«Vacaciones y permisos (RR. HH.)»** (`source_kind = 'hr_leave'`). No se ofrece al crear solicitudes a mano.
- Un `hr_leave_request` pendiente crea y envía su solicitud (`approval_create_for_leave`, trigger `hr_leave_request_sync_approval_trigger`). Sin flujo, aprueba el jefe directo; sin jefe, los owners. Se le puede asignar un flujo a la categoría.
- Al resolverse, `approval_on_resolved` aplica `hr_apply_leave_review`, el mismo código de antes: valida el saldo y justifica las faltas. Si no hay saldo, la aprobación falla y la solicitud sigue en revisión.
- Cancelar el permiso cancela la solicitud y al revés.
- `hr_review_leave_request` conserva su firma. Con una solicitud abierta, la decisión de owner/admin desde RR. HH. queda como resolución forzada.
- El guard de RR. HH. admite la sincronización del motor (`approval.syncing = on`). Gracias a eso, un jefe que no es admin puede aprobar los permisos de su equipo.

## Seguridad

- **Visibilidad de una solicitud** (`approval_row_visible`): solicitante, capturista, aprobadores involucrados, responsable del departamento (si la categoría no es confidencial) y owner/admin. La política evalúa las columnas de la fila, para que `INSERT … RETURNING` funcione.
- **Tablas de ejecución, bitácora y comentarios:** solo lectura para el panel. Se escriben por RPC.
- **Funciones:** se revocó `EXECUTE` a `PUBLIC`, `anon` y `authenticated` en todas las `approval_*`, y solo se concede a `authenticated` lo que llama el panel o usan las políticas.
- **Adjuntos:** bucket privado y URL firmada de 5 minutos.

## Funciones pendientes

- Correo, WhatsApp, Slack y webhooks: no hay infraestructura de envío. Los avisos viven en la campana y la agenda.
- Presupuestos por departamento: no existe un módulo de presupuestos que consultar.
- Otros documentos de origen (por ejemplo, bloquear una orden de compra mayor a cierto monto): el gancho `approval_on_resolved` y `source_type` están listos. Hoy solo se integra RR. HH.
- Firma electrónica avanzada: la bitácora encadenada prepara el terreno, pero no la sustituye.

## Pruebas

- `tests/utils/approvals.test.ts`: etiquetas, formulario dinámico, condiciones, validación de flujos y CSV.
- El motor se probó contra PostgreSQL real con PGlite: 39 escenarios de modo simple, seguridad, multinivel, reglas, delegación, plazos y RR. HH. La batería vive fuera del repo, en el scratchpad de la sesión, igual que en TRY-15.

## Después de migrar

```bash
npm run db:push
npm run db:types   # luego puede eliminarse types/approval.types.ts y usar Tables<'approval_flow'>, etc.
```
