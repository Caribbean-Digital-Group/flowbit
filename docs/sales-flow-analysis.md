# Análisis del flujo comercial — CRM, ventas, sitio web, POS e inventario

> Fecha: 2026-11-03 · Rama analizada: `feat-storefront` (commit `e02c931`)
>
> Objetivo: que cada peso que entra y cada unidad que sale del almacén se pueda
> rastrear de punta a punta, desde el primer contacto del cliente hasta el cobro
> y la devolución.

---

## 1. Resumen ejecutivo

Flowbit ya tiene piezas sólidas: un **libro de inventario append-only**
(`stock_move`) con costo promedio y origen, **sesiones de caja** con corte X/Z,
un checkout de tienda **idempotente con precios del servidor** y analítica
first-party que liga eventos `purchase` a órdenes.

El problema no está en cada módulo por separado, sino en **las costuras entre
ellos**. Hoy no se puede responder con datos confiables a preguntas como:

| Pregunta de negocio | ¿Se puede responder hoy? | Motivo |
|---|---|---|
| ¿Cuánto vendí este mes, neto de devoluciones e IVA? | ❌ | El dashboard suma `amount_total` (con IVA) y no resta devoluciones POS |
| ¿Cuánto cobré realmente y cuándo? | ❌ | No hay libro de pagos fuera del POS; `paid_at` solo lo llena Stripe |
| ¿Cuánto vendió cada canal (panel / POS / tienda)? | ⚠️ Parcial | Las ventas POS creadas después de jul‑2026 quedan con `origin = 'dashboard'` |
| ¿Qué falta entregar de esta orden? | ❌ | `order_line.quantity_delivered` nunca se actualiza; no hay backorders |
| ¿Cuál fue el margen real de la venta? | ❌ | El margen usa `cost_price` del producto, no el costo promedio que salió del libro |
| ¿Cuánto vale mi inventario? | ⚠️ Distorsionado | Las entradas de compra no se valoran al precio de la orden de compra |
| ¿Cuánto stock hay en el almacén Norte? | ⚠️ Solo reporte | La validación de salida usa el saldo global, no el del almacén |
| ¿Qué leads terminaron en venta y cuánto facturaron? | ❌ | El vínculo lead ↔ orden es manual y no mueve la etapa |

Las correcciones se agrupan en **cinco ejes** (§4) y un **plan en cuatro fases**
(§6). La fase 1 corrige datos que hoy se registran mal y es prerrequisito de
cualquier reporte.

---

## 2. Flujo actual de una venta

```
 Sitio web ──(formulario)──► website_submission ──(botón manual)──► crm_lead
                                                                        │
                                                         (vínculo manual crm_lead_order)
                                                                        ▼
 Panel ───────────────► order (draft) ──post_order──► order (posted)
 Tienda ─place_storefront_order────────────────────► order (posted, unpaid)
 POS ───register_pos_sale──► order (posted, paid, delivered) ──► picking confirmado
                                                                        │
                       usuario marca is_delivered = true                │
                                     │                                  │
                                     ▼                                  ▼
                         picking (borrador) ──publicar──confirmar──► stock_move (out)
                                                                        │
                                                         product.stock_quantity / avg_cost

 Cobro: panel → botón «pagar» (payment_status = 'paid', sin monto ni fecha)
        POS   → pos_payment (monto, método, cambio)
        Stripe→ webhook → paid_at
```

Tres caminos distintos crean ventas, dos registran pagos y ninguno retroalimenta
a la orden cuando el almacén entrega.

---

## 3. Hallazgos por módulo

Severidad: 🔴 dato incorrecto hoy · 🟠 hueco de trazabilidad · 🟡 mejora de proceso

### 3.1 Ventas (órdenes)

| # | Sev. | Hallazgo | Dónde |
|---|---|---|---|
| V1 | 🔴 | **`is_delivered` está invertido.** Marcar la orden como entregada es lo que *crea* el picking en borrador; la orden dice «entregada» mientras el stock sigue en el almacén. | `sync_picking_on_order_delivery` en `20260507102000_create_inventory_control_module.sql:578` |
| V2 | 🔴 | **La entrega no retroalimenta a la orden.** Confirmar un picking no actualiza `order_line.quantity_delivered` (ninguna migración la escribe). | `apply_picking_inventory` en `20260911120000_…:521` |
| V3 | 🔴 | **Pickings parciales sin backorder.** Si se escanean 7 de 10 unidades, el picking se confirma como parcial y las 3 restantes desaparecen del flujo. | `20260529200000_partial_picking_inventory_control.sql` |
| V4 | 🔴 | **No se puede cancelar lo que no salió.** `handle_order_state_change` bloquea cancelar si `is_delivered`, aunque el picking siga en borrador. | `20260126233937_…:309` |
| V5 | 🔴 | **`tax_included` se ignora.** El cálculo de línea siempre suma el IVA encima del precio; con precios con IVA incluido los totales salen inflados. | `calculate_order_line_totals`, `20260126233937_…:219` |
| V6 | 🟠 | **Pago sin monto ni fecha.** «Pagar» solo cambia `payment_status`; `partial` existe en el CHECK pero no hay dónde guardar cuánto se abonó. `paid_at` solo lo llena Stripe. | `app/pages/admin/orders/[id]/index.vue:451` |
| V7 | 🟠 | **Margen con costo teórico.** `order_line.unit_cost` toma `product.cost_price` al crear la línea; el costo real (promedio) queda en `stock_move.unit_cost` y nunca vuelve a la línea. | `populate_order_line_from_product`, `20260126233937_…:361` |
| V8 | 🟠 | El picking de venta siempre usa el **almacén por defecto**; la orden no tiene almacén de salida. | `sync_order_to_draft_picking`, línea 432 |
| V9 | 🟡 | `v_orders` no tiene `security_invoker` (ver memoria de vistas `v_*`): fuga entre empresas al consultar la vista sin filtro. | `20260707120000_…:97` |

### 3.2 Punto de venta

| # | Sev. | Hallazgo | Dónde |
|---|---|---|---|
| P1 | 🔴 | **Las ventas POS nuevas quedan con `origin = 'dashboard'`.** `register_pos_sale` no asigna `origin`; solo hubo un backfill único al crear la columna. Consecuencia en cadena: `derive_stock_origin` las etiqueta `sale` en el libro, y los reportes por canal subestiman el POS. | `20260610030500_fix_pos_sale_order_line_insert.sql:9`, backfill en `20260707120000_…:84` |
| P2 | 🔴 | **Precio, costo, IVA y descuento vienen del navegador.** El RPC inserta `unit_price`, `unit_cost`, `tax_rate` y `discount_percent` del JSON del cliente. `pos_register.max_discount_percent` solo se aplica en la UI: un cajero puede vender a cualquier precio llamando al RPC. | mismo archivo, inserción de `order_line` |
| P3 | 🔴 | **Las devoluciones no reducen la venta.** `register_pos_refund` crea el picking de entrada y un `pos_payment` negativo, pero la orden original conserva su `amount_total`; el dashboard sigue contando el ingreso completo. | `20260610022803_create_pos_module.sql:795` |
| P4 | 🟠 | **Lotes y series ficticios.** Productos con lote salen como `VENTA-POS` y con serie como `POS-xxxxxxxx`: se rompe la trazabilidad por lote justo en el canal de mayor volumen. | `register_pos_sale`, bloque de `picking_line` |
| P5 | 🟠 | La devolución reingresa al **costo promedio vigente**, no al costo con el que salió; la valoración se mueve con cada devolución. | `record_stock_move` con `p_unit_cost = NULL` |

### 3.3 Inventario

| # | Sev. | Hallazgo | Dónde |
|---|---|---|---|
| I1 | 🔴 | **Las compras no valoran al precio de compra.** `apply_picking_inventory` siempre pasa `p_unit_cost => NULL`, así que una entrada de compra usa el promedio vigente o `cost_price`. El promedio ponderado nunca refleja lo que realmente se pagó. | `20260911120000_…:612` |
| I2 | 🔴 | **Validación de stock global, no por almacén.** La salida se valida contra `product.stock_quantity` (toda la empresa). Un almacén puede quedar en negativo mientras otro tiene saldo. | `apply_picking_inventory`, paso 1 |
| I3 | 🟠 | **Sin reservas.** La tienda valida stock al comprar pero no aparta; entre el checkout y la confirmación del picking otro canal puede vender las mismas unidades (documentado como sobreventa aceptada en `docs/storefront.md`). | `place_storefront_order` |
| I4 | 🟠 | La tienda no tiene **almacén de cumplimiento** configurable. | `storefront_settings` |
| I5 | 🟡 | El costo de **envío** es una línea sin producto: correcto para totales, pero se mezcla con ventas de producto en reportes de margen. | `place_storefront_order` |

**Fortalezas a conservar:** libro inmutable, una sola vía de cambio de stock,
origen sellado por picking, kardex con saldo corrido y tareas de reabasto
idempotentes.

### 3.4 CRM

| # | Sev. | Hallazgo | Dónde |
|---|---|---|---|
| C1 | 🟠 | **No hay «Crear cotización» desde el lead.** El vínculo `crm_lead_order` se hace a mano después de crear la orden en otra pantalla. | `useCrmLead.ts:196` |
| C2 | 🟠 | **Ganar la orden no gana el lead.** Confirmar o cobrar la orden vinculada no mueve el lead a la etapa ganada ni actualiza `amount` con el total real. El pipeline mide montos estimados, no vendidos. | — |
| C3 | 🟠 | Las órdenes de **tienda y POS** de clientes con lead abierto no se asocian, aunque se identifica al cliente por email. | `place_storefront_order` |
| C4 | 🟡 | `crm_lead.amount` es el único dato de valor; no hay campo «ingreso realizado» para comparar pronóstico contra venta. | — |

### 3.5 Sitio web y tienda en línea

| # | Sev. | Hallazgo | Dónde |
|---|---|---|---|
| W1 | 🟠 | Los formularios del sitio solo llegan al CRM con un **botón manual** (`convert_website_submission_to_lead`). | `20260916180000_…:2619` |
| W2 | 🟠 | **La atribución se queda en la analítica.** La tienda liga `purchase` a la orden con UTM y sesión, pero la orden no guarda la fuente: no se puede filtrar ventas por campaña ni llevarla al lead. | `20260707140000_…` |
| W3 | 🟡 | Las órdenes de tienda nacen `posted` pero esperan a que alguien las marque «entregadas» para generar picking: no existe una **cola de surtido**. | `docs/storefront.md` §Inventario |

### 3.6 Dashboard y reportes

| # | Sev. | Hallazgo | Dónde |
|---|---|---|---|
| D1 | 🔴 | **«Ingresos» = suma de `amount_total` de órdenes posted.** Incluye IVA y envío, no resta devoluciones y no distingue facturado de cobrado. | `app/pages/admin/index.vue:241` |
| D2 | 🟠 | Se descargan **todas las órdenes** de la empresa al navegador para sumar dos meses. No escala. | `app/pages/admin/index.vue:667` |
| D3 | 🟠 | No existe reporte de **ventas por canal**, **cuentas por cobrar** ni **margen real**. | — |

---

## 4. Modelo objetivo

### 4.1 Ciclo de vida único de la venta

Todos los canales (panel, POS, tienda) recorren los mismos estados. Cada estado
lo calcula la base de datos a partir de documentos, nunca de una casilla manual.

```
            ┌─────────── order_state ───────────┐
 Lead ──► draft (cotización) ──► posted ──────────────────────────────► closed
                                   │                                     ▲
           delivery_status:  pending ──► partial ──► delivered ──────────┤
               (de picking confirmado → order_line.quantity_delivered)   │
                                   │                                     │
           payment_status:   unpaid  ──► partial ──► paid ───────────────┘
               (de SUM(order_payment.amount) vs amount_total)
                                   │
           refunds:          order_refund → resta ingreso, reingresa stock
```

| Campo | Hoy | Objetivo |
|---|---|---|
| `is_delivered` | Casilla manual que dispara el picking | Derivado: `delivery_status IN ('pending','partial','delivered')` |
| `order_line.quantity_delivered` | Nunca se escribe | Lo actualiza `apply_picking_inventory` (neto de devoluciones) |
| `payment_status` | Se fija a mano | Derivado por trigger desde el libro de pagos |
| `paid_at` | Solo Stripe | Fecha del pago que completó el total |
| Acción del usuario | «Marcar entregada» | «Preparar entrega» (crea/publica el picking) |

### 4.2 Libro de pagos (`order_payment`)

Una tabla para **todos** los cobros y reembolsos, sin importar el canal:

```sql
order_payment (
  id, company_id, order_id,
  payment_method_id,
  amount        NUMERIC(15,2) NOT NULL,   -- negativo = reembolso
  paid_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  source        TEXT CHECK (source IN ('dashboard','pos','stripe')),
  pos_session_id, pos_payment_id,         -- trazabilidad al corte de caja
  stripe_payment_intent_id,
  reference, notes, active, auditoría…
)
```

- El POS escribe aquí además de `pos_payment` (que sigue siendo la base del corte).
- El webhook de Stripe escribe aquí en lugar de solo marcar la orden.
- El botón «pagar» del panel pide **monto, fecha y método**; permite abonos.
- Un trigger recalcula `payment_status`, `is_paid` y `paid_at` de la orden.

### 4.3 Devoluciones como documento

`order_refund` + `order_refund_line` (cantidad, importe, motivo), ligados a la
orden original, al picking de entrada y al pago negativo. Así:

- La venta neta = `amount_untaxed` − devoluciones (`amount_untaxed` devuelto).
- El reingreso al almacén se valora al **costo con el que salió** (se lee del
  `stock_move` de salida original), no al promedio del día.
- Funciona igual para POS, panel y tienda (hoy solo el POS sabe devolver).

### 4.4 Inventario por almacén y reservas

```sql
stock_quant (company_id, product_id, warehouse_id,
             quantity, reserved_quantity, avg_cost)   -- PK (product, warehouse)
```

- `record_stock_move` mantiene `stock_quant` además de `product.stock_quantity`
  (que pasa a ser la suma, por compatibilidad).
- La validación de salida se hace contra el **almacén del picking**.
- **Reserva**: al confirmar (`posted`) una orden de panel o tienda se reserva en
  el almacén de salida; al confirmar el picking se consume; al cancelar se libera.
  Disponible = `quantity − reserved_quantity`. El checkout de tienda valida contra
  disponible y deja de haber sobreventa entre canales.
- `order.warehouse_id` y `storefront_settings.warehouse_id` definen de dónde sale.

### 4.5 Costo real y margen

- Las **entradas de compra** se valoran al precio de la línea de la orden de
  compra (`order_line.unit_price` neto de descuento, convertido con `exchange_rate`).
- Al confirmar una salida de venta se escribe en `order_line.cost_delivered` el
  costo real tomado del libro; el margen real = `subtotal − cost_delivered`.
- `order_line.unit_cost` se conserva como costo estimado (cotización).

### 4.6 Libro de ingresos (`v_revenue_ledger`)

Vista con `security_invoker = true` que une, por fecha y canal, los eventos que
mueven el ingreso:

| Evento | Fecha | Signo | Fuente |
|---|---|---|---|
| Venta confirmada | `confirmation_date` | + `amount_untaxed` | `order` (sale, posted) |
| Devolución | `order_refund.created_at` | − importe sin IVA | `order_refund` |
| Cobro | `paid_at` | + | `order_payment` |
| Reembolso | `paid_at` | − | `order_payment` |
| Costo de venta | `stock_move.occurred_at` | − `total_cost` | `stock_move` (out, sale/pos/storefront) |

Columnas comunes: `company_id, occurred_at, channel, order_id, partner_id,
lead_id, utm_source, kind, amount`. Sobre ella se construye
`get_sales_kpis(company, desde, hasta)`, que calcula en servidor:

- Ventas brutas, devoluciones, **ventas netas** (sin IVA) e IVA trasladado.
- Cobrado vs. por cobrar (antigüedad 0‑30 / 31‑60 / 61‑90 / +90).
- Costo de venta y **margen bruto real**, por canal y por producto.
- Ticket promedio, unidades vendidas, tasa de devolución.

### 4.7 CRM conectado a la venta

- **«Crear cotización»** en el lead: abre una orden `draft` con el contacto y la
  liga en `crm_lead_order`.
- Trigger: cuando una orden ligada pasa a `posted`, el lead se mueve a la
  primera etapa `is_won` y guarda `won_amount` (ingreso realizado) junto al
  `amount` estimado.
- Al crear una orden de tienda o POS para un partner con **un solo lead abierto**,
  se liga automáticamente (con evento en `crm_history`).
- Opción en ajustes del sitio: «Convertir mensajes en leads automáticamente».

### 4.8 Atribución de canal y campaña

`order` gana `utm_source`, `utm_medium`, `utm_campaign` y
`analytics_session_id`, copiados por `place_storefront_order` de la sesión de
analítica. El lead creado desde el sitio hereda la misma fuente. Resultado:
**campaña → visita → lead → orden → cobro** en una sola consulta.

---

## 5. Trazabilidad resultante

Con el modelo objetivo, cada venta deja esta cadena consultable:

```
crm_lead ─► crm_lead_order ─► order ─┬─► order_line ─► picking_line ─► stock_move (out, costo real)
   ▲                                 │                                     │
   │ utm / submission                ├─► order_payment (cobros / reembolsos, sesión POS)
   │                                 │
website_submission / analytics       └─► order_refund ─► picking (entrada) ─► stock_move (in, costo original)
```

Y las preguntas del §1 se responden así:

| Pregunta | Fuente |
|---|---|
| Ventas netas del mes, por canal | `get_sales_kpis` sobre `v_revenue_ledger` |
| Cobrado y por cobrar | `order_payment` + `payment_status` derivado |
| Pendiente de entregar | `order_line.quantity − quantity_delivered` + backorders |
| Margen real por venta | `order_line.cost_delivered` (del libro) |
| Valor del inventario por almacén | `stock_quant` |
| Leads → ventas → ingresos | `crm_lead.won_amount` + `crm_lead_order` |
| Ventas por campaña | `order.utm_*` |

---

## 6. Plan de implementación

Cada fase es una migración nueva (nunca se editan las existentes) más los
cambios de UI. Las migraciones las aplica el usuario con `npm run db:push` y
`npm run db:types`.

### Fase 1 — Corregir los datos que hoy se registran mal ✅ implementada

Migración `20261103120000_fix_sales_flow_data_integrity.sql` (pendiente de
`db:push`) + `app/utils/orderMath.ts`, POS y formulario de órdenes. Ver §7.

| Tarea | Hallazgos |
|---|---|
| `register_pos_sale` asigna `origin = 'pos'` + backfill de órdenes con `pos_session_id` y re-sellado de `picking.origin` | P1 |
| `register_pos_sale` lee precio, costo e IVA del producto en servidor y valida el descuento contra `max_discount_percent` (con excepción para `admin`/`owner`) | P2 |
| Entradas de compra valoradas al precio de la orden de compra | I1 |
| `calculate_order_line_totals` respeta `tax_included` | V5 |
| `security_invoker = true` en `v_orders`, `v_pickings`, `v_stock_moves` y demás `v_*` | V9 |

### Fase 2 — Entrega y pagos derivados de documentos

| Tarea | Hallazgos |
|---|---|
| `apply_picking_inventory` actualiza `quantity_delivered` y `cost_delivered`; nuevo `delivery_status` derivado | V2, V7 |
| Backorder automático al confirmar un picking parcial | V3 |
| Reemplazar «Marcar entregada» por «Preparar entrega»; permitir cancelar mientras nada haya salido | V1, V4 |
| Tabla `order_payment` + trigger de `payment_status`; POS y Stripe escriben ahí; modal de abono en el panel | V6 |
| `order_refund` genérico; el POS lo usa; reingreso al costo original | P3, P5 |

### Fase 3 — Inventario multi-almacén y reservas

| Tarea | Hallazgos |
|---|---|
| `stock_quant` + backfill desde `stock_move` | I2 |
| Validación por almacén; `order.warehouse_id`, `storefront_settings.warehouse_id` | I2, I4, V8 |
| Reservas al confirmar orden; disponible = existencia − reservado en tienda y POS | I3 |
| POS: selección de lote/serie real (o bloqueo de productos rastreados sin captura) | P4 |
| Cola de surtido de órdenes de tienda (`delivery_status = 'pending'`) | W3 |

### Fase 4 — Reportes, CRM y atribución

| Tarea | Hallazgos |
|---|---|
| `v_revenue_ledger` + `get_sales_kpis`; el dashboard consume el RPC | D1, D2, D3 |
| Página `/admin/reports/sales`: ventas netas, cobranza, margen, por canal/producto/vendedor, exportación CSV | D3 |
| «Crear cotización» desde el lead; trigger lead ganado + `won_amount` | C1, C2, C4 |
| Auto-vínculo de órdenes de tienda/POS a lead abierto | C3 |
| `order.utm_*` y conversión automática de mensajes del sitio | W1, W2 |
| Artículos del manual (`app/utils/manual/`) para el nuevo flujo de entrega, pagos y reportes | — |

### Riesgos y decisiones abiertas

| Tema | Decisión necesaria |
|---|---|
| Ingreso reconocido | ¿Al confirmar la orden (devengado) o al cobrar (flujo de caja)? El ledger soporta ambos; hay que elegir cuál muestra el dashboard por defecto. |
| Reserva en órdenes del panel | ¿Reservar al confirmar o solo al «Preparar entrega»? Reservar antes evita sobreventa pero inmoviliza stock de cotizaciones largas. |
| Datos históricos | Las órdenes antiguas no tienen pagos con monto ni `quantity_delivered`; el backfill propuesto asume pago total en `paid` y entrega total en pickings confirmados. |
| Facturación (CFDI) | Fuera de alcance; `is_invoiced` sigue manual. El modelo deja lugar para un módulo de facturas que lea `order_payment`. |
| Shims de tipos | `db:types` falla desde la sesión; cada fase añadirá columnas a los shims (`types/*.types.ts`) hasta regenerar. |

---

## 7. Fase 1 — qué cambió

| Hallazgo | Cambio | Efecto visible |
|---|---|---|
| P1 | Trigger `enforce_pos_order_origin` (toda orden con `pos_session_id` es `origin = 'pos'`) + backfill de órdenes, pickings y asientos del libro (`sale` → `pos`, solo la etiqueta) | Reportes por canal e inventario por origen correctos, también hacia atrás |
| P2 | `register_pos_sale` toma precio, costo (promedio), IVA, modo fiscal y descripción del producto; valida `max_discount_percent` salvo owner/admin; suma líneas repetidas al validar stock | Un precio manipulado o un ticket con precio viejo se rechaza: «El precio de X cambió…» |
| I1 | `apply_picking_inventory` valora las recepciones de compra al precio neto de la OC (con `exchange_rate` si la OC está en otra moneda) | El costo promedio refleja lo pagado |
| V5 + extra | Nueva columna `order_line.price_include_tax` (NULL = hereda `order.tax_included`). Tienda y POS la fijan desde `product.tax_included`. | **Tienda y POS dejan de sobrecobrar** productos con IVA incluido (se mostraba $116 y se cobraba $134.56) |
| extra | El trigger de autocompletado de líneas (`trigger_order_line_a_populate`) corre antes del cálculo | Una línea agregada solo con producto ya no queda en $0 |
| extra | `record_stock_move` y `apply_picking_inventory` dejan de ser invocables por clientes; `set_picking_status` valida la empresa | Nadie puede mover stock ni confirmar pickings de otra empresa vía RPC |
| V9 | `security_invoker = true` y `REVOKE … FROM anon` en **todas** las vistas `v_*`; política nueva para ver partners (también archivados) de las empresas propias | Fin de la fuga entre empresas por vistas; los clientes archivados conservan su nombre en órdenes históricas |

**Datos históricos:** ningún importe se recalcula. Las líneas de órdenes ya
confirmadas con `tax_included = true` quedan fijadas en `price_include_tax = false`
(como se calcularon). Solo las órdenes en borrador se recalculan al cambiar
«precios con IVA».

**Verificación:** la cadena completa de migraciones se aplicó sobre PostgreSQL 17
(PGlite) con stubs de Supabase. Se reprodujo el bug de origen con la versión
anterior y se comprobó: backfill de los tres niveles, inmutabilidad del libro,
venta POS con IVA incluido y excluido (232 = 116 + 116), rechazo de precio
manipulado y de IVA/costo del cliente, límite de descuento de cajero vs. owner,
stock agregado, valoración de compra (7 × $50 + 10 × $80 → promedio $67.6471),
autocompletado y recálculo de líneas en el panel, orden de tienda con IVA incluido,
RLS de vistas entre empresas, permisos de las funciones de stock, devolución y
corte X del POS, y cuadre libro = saldo.

**Pendiente tras `db:push`:** un ticket POS que haya quedado guardado en el
navegador antes del despliegue y contenga productos con IVA incluido fallará al
cobrar («Los pagos no cubren el total»); basta con descartarlo y volver a
capturarlo.
