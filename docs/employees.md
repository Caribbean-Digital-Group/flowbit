# Empleados

Un empleado es un contacto (`partner`) marcado como tal en una empresa. El módulo no crea una persona nueva: nombre, correo, teléfonos, dirección y RFC siguen en `partner` y se editan en Contactos.

## Modelo de datos

| Tabla | Contenido | Quién lee | Quién escribe |
|---|---|---|---|
| `employee` | Puesto, departamento, jefe, fechas y estado | Todo el equipo | Owner y admin |
| `employee_private` | Datos privados, ajustes de RR. HH. y CFDI | Owner y admin | Owner y admin |
| `employee_department` | Catálogo de departamentos | Todo el equipo | Owner y admin |
| `v_employees` | `employee` con los datos del contacto, departamento y jefe | Según el RLS de sus tablas | — |

RLS filtra por fila y no por columna. Por eso los datos sensibles van en una tabla aparte. No agregues a `employee` nada que el equipo no deba leer.

`employee` es único por `(company_id, partner_id)`: una persona que trabaja en dos empresas tiene un expediente en cada una.

## Reglas

- **Alta:** solo por el RPC `register_employee`, que crea `employee` y `employee_private` en la misma transacción. Las dos tablas no tienen política de INSERT.
- **Contacto nuevo:** el mismo RPC crea el contacto, así que un fallo no deja un contacto huérfano.
- **Estado y archivo:** `status` indica si la persona sigue trabajando. `active = false` es el borrado lógico y quita la marca de empleado.
- **Reactivación:** volver a marcar a una persona archivada recupera su expediente.
- **Contacto:** archivar un empleado no modifica su `partner`.
- **Empresa:** un trigger impide usar contactos de otra empresa o personas morales, y cambiar la empresa o el contacto de un expediente. Las FK compuestas impiden asignar departamentos o jefes de otra empresa.

## Fecha de nacimiento

Se guarda en `employee_private.birth_date` y no en `partner.birthdate`. La política de `partner` permite leer contactos activos fuera de la empresa, así que un dato sensible no debe vivir ahí.

## CFDI

Los campos `cfdi_*` guardan claves de los catálogos del SAT para el CFDI de nómina. Las opciones viven en `app/utils/employee.ts` y la base no las restringe, para que un cambio de catálogo no requiera una migración.

Este módulo solo captura datos. El cálculo de nómina vive en [payroll.md](payroll.md) y todavía no timbra. Antes de timbrar hay que validar las claves contra el catálogo vigente del SAT.

## Asistencia y nómina

La migración `20261107180000_create_hr_payroll_suite` agrega:

- `employee.work_schedule_id`: horario de trabajo, visible para el equipo. `v_employees` se recreó para incluirlo junto con `work_schedule_name`.
- `employee_private.infonavit_credit_number`, `infonavit_discount_type` e `infonavit_discount_value`: crédito INFONAVIT del trabajador.
- El salario vigente de `hr_salary` se copia por trigger a `monthly_salary`, `cfdi_contribution_base` y `cfdi_integrated_daily_wage`.
- `vacation_days`, si tiene valor, sustituye a los días de ley en la asignación anual de vacaciones.

Detalle en [hr.md](hr.md) y [payroll.md](payroll.md).

## Tipos

Mientras no se aplique la migración, los tipos viven en `types/employee.types.ts`. Tras correr `npm run db:push && npm run db:types` se puede sustituir por los tipos generados y eliminar el archivo.
