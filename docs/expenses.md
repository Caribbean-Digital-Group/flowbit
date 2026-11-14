# Gastos y estado de resultados

Registro de los gastos de operación (renta, servicios, publicidad, honorarios…) y
un estado de resultados mensual en base de caja que los cruza con los cobros y los
pagos a proveedores del flujo comercial. Tarea: TRY-10.

## Rutas

| Ruta | Vista | Descripción |
|---|---|---|
| `/admin/expenses` | Lista | Totales por estado, filtros (estado, categoría, fechas), acción «Marcar pagado» y exportación CSV. Acepta `?status=`, `?category=`, `?from=` y `?to=` |
| `/admin/expenses/create` | Alta | Acepta `?project=`, `?partner=` y `?category=` para prellenar |
| `/admin/expenses/[id]` | Detalle | Edición y cambios de estado desde el menú (aprobar, pagar, cancelar, regresar a borrador, archivar) |
| `/admin/expense-categories` | Catálogo | Categorías con color; el detalle enlaza a los gastos de la categoría |
| `/admin/reports/profit-loss` | Reporte | Estado de resultados por mes, desglose por categoría y exportación CSV |

En el sidebar viven en el grupo **Ventas / Compras**: «Gastos», «Estado de resultados»
y «Categorías de gasto».

## Modelo de datos

Migración: `20261114120000_create_expense_tables.sql`.

| Tabla | Uso |
|---|---|
| `expense_category` | Catálogo por empresa: `name` (único entre las activas, sin distinguir mayúsculas), `description`, `color` (token de la paleta: `slate`, `sky`, `indigo`, `violet`, `fuchsia`, `rose`, `amber`, `emerald`, `teal`) |
| `expense` | Gasto: `expense_date`, `description`, `category_id`, `partner_id` (proveedor), `project_id`, `payment_method_id`, `amount` (subtotal), `tax_amount` (IVA), `currency`, `reference` (folio o comprobante), `notes`, `status`, `paid_at` |

- **Total del gasto** = `amount + tax_amount`. Ninguno puede ser negativo.
- **Estados**: `draft` (Borrador) → `approved` (Aprobado) → `paid` (Pagado); `cancelled` (Cancelado).
  Desde «Pagado» o «Cancelado» se puede regresar a borrador.
- Ambas tablas tienen las columnas estándar (`active`, auditoría, `updated_at` con trigger).
  El borrado es lógico (`active = false`).
- Índice de texto completo `spanish` sobre descripción y folio.

### Reglas en base de datos (trigger `expense_before_write`)

- Categoría, proyecto y método de pago deben pertenecer a la empresa del gasto; el
  proveedor debe ser un contacto de la empresa (`rel_partner_company`).
- No se puede cambiar la empresa de un gasto.
- `paid_at`: al pasar a `paid` sin fecha de pago se usa `expense_date`; al salir de
  `paid` se limpia. Así el reporte siempre tiene una fecha de pago confiable.

### Seguridad (RLS)

Ambas tablas usan `public.user_belongs_to_company(company_id)`: cualquier miembro de
la empresa (owner, admin o member) puede leer, crear y actualizar. No hay política
`DELETE`, coherente con el borrado lógico.

## Estado de resultados

Base de caja, la misma decisión de negocio que el reporte de ventas:

| Renglón | Fuente | Regla |
|---|---|---|
| Ingresos | `get_sales_kpis` → `monthly[].income` | Cobrado neto (cobros − reembolsos), con IVA, en la fecha del cobro |
| Compras | `get_sales_kpis` → `monthly[].expense` | Pagos registrados en órdenes de compra, en la fecha del pago |
| Gastos | tabla `expense` | Solo `status = 'paid'`, por su total (subtotal + IVA), en el mes de `paid_at` |
| Resultado | — | Ingresos − compras − gastos |

- Los gastos en borrador, aprobados sin pagar o cancelados **no cuentan**. «Aprobado»
  significa autorizado, no pagado; contarlo mezclaría devengado con caja.
- El armado es puro y está probado: `buildProfitLoss` en `app/utils/expenses.ts`
  (`tests/utils/expenses.test.ts`). Genera todos los meses del periodo aunque no
  tengan movimientos, agrupa los gastos sin categoría como «Sin categoría» y ordena
  las categorías de mayor a menor gasto.
- Si `get_sales_kpis` no está disponible (migraciones de ventas sin aplicar o error),
  la página avisa y muestra solo los gastos.
- Los importes se suman tal como se capturaron: un gasto en otra moneda no se
  convierte. Conviene capturarlos en la moneda de la empresa.
- El periodo admite hasta cinco años.
- No sustituye la contabilidad fiscal (no hay devengado, depreciación ni IVA acreditable).

## Código

| Archivo | Rol |
|---|---|
| `app/composables/useExpense.ts` | CRUD, `setStatus`, `getPaidInRange` (para el reporte) |
| `app/composables/useExpenseCategory.ts` | CRUD del catálogo |
| `app/composables/useExpenseLookups.ts` | Opciones de categorías, proveedores, proyectos y métodos de pago |
| `app/utils/expenses.ts` | Etiquetas y colores de estado, `expenseTotal`, `buildProfitLoss` |
| `app/components/Expense/Form.vue` | Formulario (`ExpenseFormData`, `createEmptyExpenseForm`, `validateExpenseForm`) |
| `app/components/ExpenseCategory/Form.vue` | Formulario de categoría |
| `types/expense.types.ts` | Tipos temporales hasta correr `npm run db:types` |

Los listados usan `fetchAllRows`, así que no se cortan en 1000 filas.

## Pendientes tras el merge

1. `npm run db:push` (o el workflow de `main`) para aplicar la migración.
2. `npm run db:types` y, cuando `database.types.ts` incluya `expense` y
   `expense_category`, sustituir `types/expense.types.ts` por `Tables<'expense'>` y
   quitar el cast del cliente en los composables.
