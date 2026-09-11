# Inventario — trazabilidad, valoración y reabastecimiento

El inventario dejó de ser «un número en el producto» para convertirse en un
**libro de movimientos auditable**. Cada unidad que entra o sale deja un asiento
con su origen, su costo y el saldo resultante.

---

## El problema que resuelve

Antes de la migración `20260911120000_create_inventory_traceability_module`:

| Situación | Consecuencia |
|---|---|
| `product.stock_quantity` era editable desde el formulario | Cualquiera reescribía el stock sin dejar rastro |
| No existía registro de movimientos | Imposible responder «¿de dónde salieron estas unidades?» |
| El costo no se capturaba al mover | La valoración histórica no se podía reconstruir |
| El origen era texto libre en las notas | No se distinguía una venta del panel de una del POS |
| No había reportes de existencias ni valoración | El valor del inventario se calculaba a mano |

## Arquitectura

```
Confirmación de picking ─┐
Ajuste registrado ───────┼─► record_stock_move() ─► stock_move (append-only)
Alta con existencias ────┘          │
                                    ├─► product.stock_quantity  (saldo)
                                    ├─► product.avg_cost        (promedio ponderado)
                                    └─► trigger ─► tarea de reabastecimiento en la agenda
```

`record_stock_move` es **la única vía** por la que el stock puede cambiar. Un
trigger sobre `product` rechaza cualquier `UPDATE` directo de `stock_quantity`:

```
ERROR: El stock no se modifica directamente. Usa un ajuste de inventario
       (create_stock_adjustment) o confirma un movimiento.
```

## Tipos y origen de los movimientos

`picking.origin` y `stock_move.origin` comparten el enum `stock_move_origin`:

| Origen | Cuándo se registra |
|---|---|
| `initial` | Saldo de apertura al implantar el libro o al dar de alta un producto con existencias |
| `purchase` | Picking de entrada ligado a una orden de compra |
| `sale` | Picking de salida de una orden de venta del panel |
| `pos` | Venta cobrada en el punto de venta (`order.origin = 'pos'`) |
| `storefront` | Pedido de la tienda en línea (`order.origin = 'storefront'`) |
| `return_in` / `return_out` | Devolución de cliente / a proveedor (`picking.is_return`) |
| `adjustment` | Ajuste manual con motivo obligatorio |
| `manual` | Movimiento de almacén sin documento asociado |

El origen se sella en el picking al crearlo (`derive_stock_origin`) y se copia a
cada asiento. Los pickings anteriores a la migración se tipifican en el backfill.

## Valoración

Costo **promedio ponderado**, recalculado en cada entrada:

```
nuevo_promedio = (saldo × promedio_actual + entrada × costo_entrada)
                 ÷ (saldo + entrada)
```

Las salidas se valoran al promedio vigente. El asiento guarda `unit_cost`,
`total_cost` y `avg_cost_after`, de modo que la valoración de cualquier fecha es
reconstruible. `v_product_stock.stock_value = stock_quantity × unit_cost`.

> Los productos con existencias pero sin costo capturado valen $0 y subvalúan el
> total. El panel los cuenta aparte (`uncosted_count`) y lo advierte.

## Reabastecimiento automático

Cuando el stock cruza el mínimo, un trigger crea una tarea en el proyecto
interno **«Reabastecimiento de inventario»**:

- **Idempotente**: la tarea lleva el código `RESTOCK-<producto>`; si ya hay una
  abierta se actualiza en lugar de duplicarse.
- **Prioridad según gravedad**: `urgent` si el stock es negativo, `high` si está
  agotado, `medium` si está bajo el mínimo.
- **Se cierra sola** cuando el producto vuelve a nivel correcto.
- **Nunca bloquea una venta**: si la tarea falla (por ejemplo, una empresa sin
  miembros de equipo a quien asignarla), se registra una advertencia y el
  movimiento de inventario continúa.

Para que aparezcan en la agenda, la tarea necesita responsable:
`inventory_settings.restock_responsible_partner_id`. Si no está definido, se usa
el propietario del equipo.

## API de base de datos

| Función | Uso |
|---|---|
| `record_stock_move(...)` | Interna: escribe el asiento y actualiza saldo y promedio |
| `create_stock_adjustment(product, cantidad, motivo, almacén?)` | Ajuste manual; el motivo es obligatorio |
| `get_inventory_summary(company)` | Totales, valoración, desglose por categoría y almacén, alertas |
| `get_product_stock_card(product, limite)` | Kardex con saldo corrido |
| `generate_restock_tasks(company)` | Sincroniza la agenda con el estado del catálogo |
| `get_warehouse_stock(warehouse)` | Existencias y valoración de un almacén |
| `derive_stock_origin(order, tipo, es_devolución)` | Deduce el origen de un movimiento |

| Vista | Contenido |
|---|---|
| `v_product_stock` | Existencias, mínimos, costo, valoración y semáforo por producto |
| `v_stock_moves` | Libro con producto, almacén y documento resueltos |
| `v_pickings` | Ahora incluye `origin` y `move_value` |

## Interfaz

| Ruta | Contenido |
|---|---|
| `/admin/inventory` | Tablero: valor del inventario, alertas, valoración por categoría y almacén, reporte filtrable, exportación CSV, ajuste, sincronización de la agenda y **ajustes del módulo** |
| `/admin/inventory/[id]` | Trazabilidad del producto: kardex con origen, documento, lote/serie, costo y saldo |
| `/admin/pickings` | Listado con columna de origen y **valor del movimiento** |
| `/admin/products/[id]` | Stock de solo lectura y **historial tomado del libro** (incluye ajustes y costos) |
| `/admin/warehouses/[id]` | **Existencias y valoración de ese almacén**, calculadas desde el libro |

### Ajustes del módulo

`Inventario → Ajustes` (`Inventory/SettingsModal.vue`) escribe en
`inventory_settings`:

| Ajuste | Efecto |
|---|---|
| Crear tareas automáticamente | Activa o apaga el trigger de reabastecimiento |
| Responsable de surtir | Partner al que se asignan las tareas; sin él se usa el propietario del equipo |
| Días para surtir | Plazo que se pone como `due_date` de la tarea |

### Existencias por almacén

`product.stock_quantity` es el saldo **de toda la empresa**. El reparto entre
almacenes solo lo conoce `stock_move`, y lo resuelve
`get_warehouse_stock(warehouse_id)` (migración
`20260911160000_add_warehouse_stock_report`). Cada almacén valora sus unidades
al costo de **sus propias entradas**, no al promedio global: si Central recibió
a $20 y Norte a $25, cada uno se valora con su costo.

## Archivos

| Capa | Archivos |
|---|---|
| Migraciones | `20260911120000_create_inventory_traceability_module.sql`, `20260911160000_add_warehouse_stock_report.sql` |
| Tipos | `types/inventory.types.ts` (shim hasta regenerar `database.types.ts`) |
| Composable | `app/composables/useInventory.ts` |
| Páginas | `app/pages/admin/inventory/index.vue`, `app/pages/admin/inventory/[id].vue` |
| Componentes | `app/components/Inventory/SettingsModal.vue` |

## Verificación

La migración se aplicó y probó contra un PostgreSQL 16 real, sobre la cadena
completa de migraciones del proyecto. Casos cubiertos: asiento de apertura,
bloqueo de edición directa, promedio ponderado, ajuste con y sin motivo,
cuadre libro/saldo, inmutabilidad del libro, creación y cierre idempotente de
tareas, deducción de origen (panel/POS), rechazo de salida sin existencias,
kardex y resumen.
