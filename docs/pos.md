# Punto de Venta (POS) — Guía de uso para cajeros

El POS de Flowbit vive en la ruta **`/pos`** y reutiliza el modelo de órdenes de venta:
cada ticket cobrado es una orden (`SO-XXXXXX`) confirmada, marcada como entregada y pagada,
con su picking de salida confirmado (el inventario se descuenta en tiempo real).

## Flujo del turno

### 1. Apertura de caja

1. Entra a `/pos` (o desde el panel: **Punto de Venta → Terminal POS**).
2. Selecciona tu caja y pulsa **Abrir caja**.
3. Captura el **fondo inicial en efectivo** y confirma. Queda registrado quién abrió, cuándo y con cuánto.

> Una caja solo puede tener **una sesión abierta a la vez** y no es posible vender sin sesión abierta.

### 2. Venta

1. El cursor siempre está en la **búsqueda** (escanea el código de barras o teclea nombre/SKU + `Enter`).
2. Usa el prefijo `3*` antes de escanear para agregar 3 unidades de golpe.
3. Ajusta cantidades con `+` / `−` o editando el número en la línea.
4. Cliente: por defecto "Público general" (configurable por caja); con `F3` asocias o das de alta un cliente.
5. Descuentos con `F4` (por línea o al ticket, en % o monto). Si excedes tu límite, necesitas un supervisor.
6. `F6` pone el ticket **en espera** para atender a otro cliente; recupéralo después desde el badge ámbar.
7. Cobra con `F9`: elige método (teclas `1–9`), captura lo recibido (en efectivo hay botones de denominaciones
   y "Exacto"), aplica el pago y confirma. Se admiten **pagos mixtos** (efectivo + tarjeta, etc.).
8. El **cambio** se muestra en grande hasta iniciar la siguiente venta (`Enter`). Imprime el ticket si lo piden.

La venta en curso se guarda localmente: si recargas la pantalla, el ticket no se pierde.

### 3. Movimientos de efectivo

- `F7` abre el registro de **entradas** (ej. cambio adicional) y **salidas** (ej. retiro parcial).
- El motivo es obligatorio y todo movimiento afecta el efectivo esperado del corte.

### 4. Devoluciones

- Botón **Devolución** en el encabezado: busca la venta por folio (`SO-…`), indica cantidades por línea,
  método de reembolso y motivo.
- La devolución **reintegra inventario** (picking de entrada confirmado) y descuenta del corte de la sesión actual.
- Una anulación después de cobrar = devolución total de la venta.

### 5. Corte de caja

- **Corte X** (`F10`): reporte informativo imprimible sin cerrar la sesión.
- **Corte Z** (`F12`): cierra la sesión.
  1. Declara lo **contado** por método de pago (si la caja tiene *corte ciego*, no verás el esperado).
  2. El sistema calcula el esperado por método: `apertura + ventas en efectivo + entradas − salidas − devoluciones`.
  3. Las diferencias que excedan la **tolerancia** configurada exigen justificación.
  4. Al confirmar, la sesión queda **cerrada e inmutable** y se genera el reporte de corte imprimible.

El historial de cortes está en **Punto de Venta → Sesiones de caja** del panel admin.

## Mapa de atajos

| Atajo | Acción |
|---|---|
| `F1` / `?` | Ayuda con el mapa de atajos |
| `F2` | Foco en búsqueda de productos |
| `F3` | Buscar / asociar cliente (alta rápida incluida) |
| `F4` | Aplicar descuento (línea seleccionada o ticket) |
| `F6` | Poner ticket en espera / ver tickets en espera |
| `F7` | Movimiento de efectivo (entrada/salida) |
| `F9` | Ir a cobro |
| `F10` | Corte X (informativo) |
| `F12` | Corte Z / cerrar sesión de caja |
| `Enter` | Agregar producto buscado / confirmar pago |
| `Esc` | Cancelar acción / cerrar modal |
| `↑` `↓` | Navegar líneas del ticket |
| `+` / `−` | Cantidad de la línea seleccionada |
| `Supr` | Eliminar línea seleccionada |
| `Ctrl+Supr` | Descartar ticket completo (con confirmación) |
| `1`–`9` (en cobro) | Selección rápida de método de pago |
| `Ctrl+P` | Reimprimir último ticket |
| `N*` | Prefijo multiplicador antes de escanear (ej. `3*`) |

## Configuración (administradores)

- **Cajas**: `admin → Punto de Venta → Cajas`. Por caja se define: almacén de salida, cliente por defecto,
  límite de descuento para cajeros, corte ciego y tolerancia de diferencias.
- **Métodos de pago**: `admin → Ventas/Compras → Métodos de pago`. Marca con `is_cash` (columna en BD) los
  métodos de efectivo para que participen del fondo, movimientos y cambio.
- **Roles**: los miembros (`member`) operan como cajeros; `admin`/`owner` actúan como supervisores
  (descuentos sin límite, gestión de cajas).
