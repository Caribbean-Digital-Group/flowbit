# Storefront — Tienda en línea por empresa

Cada `company` de Flowbit puede exponer una tienda pública multi-tenant en
`/stores/[company_slug]`. Las compras generan órdenes de venta reales en el
flujo de `orders` del dashboard, marcadas con `origin = 'storefront'`.

---

## Cómo activar una tienda

1. En el dashboard, ir a **Tienda en línea → Ajustes de tienda** (`/admin/storefront`).
2. Configurar el **slug** (URL pública) de la empresa. Debe ser único; solo minúsculas, números y guiones.
3. Completar branding (logo, banner, color), textos del hero, contacto y políticas.
4. Activar el switch **Estado de la tienda**.
5. Requisitos para poder vender:
   - Productos con **«Publicado en tienda»** (`product.is_published`) y `can_be_sold` activos (se gestionan desde `/admin/products`). Los marcados como **destacados** aparecen primero en la portada.
   - Al menos un **método de envío** (`/admin/storefront/shipping-methods`).
   - Al menos un **método de pago** activo (`/admin/payment-methods`, catálogo ya existente).
   - Opcional: **cupones** (`/admin/storefront/coupons`) — porcentaje o monto fijo, con vigencia, compra mínima y límite de usos.

La tienda queda disponible en `NUXT_PUBLIC_SITE_URL/stores/{slug}`.

## Rutas públicas

| Ruta | Contenido |
|---|---|
| `/stores/[company_slug]` | Landing: hero, categorías, destacados |
| `/stores/[company_slug]/products` | Catálogo con búsqueda, filtros (categoría, precio, stock), ordenamiento y paginación |
| `/stores/[company_slug]/products/[product_slug]` | Detalle: galería, atributos, cantidad, relacionados, JSON-LD |
| `/stores/[company_slug]/cart` | Carrito (persistido en localStorage por tienda) + cupones |
| `/stores/[company_slug]/checkout` | Checkout multi-paso: contacto → envío → pago → revisión |
| `/stores/[company_slug]/checkout/confirmation/[order_ref]` | Confirmación (requiere el email de la compra) |
| `/stores/[company_slug]/about` | Quiénes somos, contacto y políticas |
| `/stores/[company_slug]/account` | Login/registro opcional + historial de pedidos |

Si el slug no existe, la empresa no está activa o la tienda está desactivada,
todas las rutas muestran «Tienda no disponible» (los RPCs devuelven `not_found`).

## Arquitectura y decisiones

### Acceso público a datos
No hay lecturas directas de tablas desde el rol `anon`. Todo pasa por RPCs
`SECURITY DEFINER` (mismo patrón que `get_public_project_view`), definidos en
`supabase/migrations/20260707120000_create_storefront_module.sql`:

- `get_storefront(slug)` — branding + settings + categorías + destacados.
- `get_storefront_products(...)` — catálogo con filtros/orden/paginación.
- `get_storefront_product(slug, product_slug)` — detalle + relacionados.
- `get_storefront_checkout_info(slug)` — envíos + métodos de pago.
- `validate_storefront_coupon(slug, code, subtotal)` — validación de cupón.
- `place_storefront_order(...)` — checkout completo (ver abajo).
- `get_storefront_order(slug, ref, email)` — confirmación; exige email coincidente para evitar enumeración.
- `get_storefront_my_orders(slug)` — historial del usuario autenticado (solo `authenticated`).

Solo se exponen productos `is_published + can_be_sold + status='active'` de la
empresa resuelta; nunca costos, márgenes ni datos de otras empresas.

### Checkout (`place_storefront_order`)
- **Precios e impuestos siempre del servidor**: el cliente solo envía
  `product_id + quantity`; precio, costo y `tax_rate` se leen del producto.
- **Stock** validado con `SELECT ... FOR UPDATE` por producto.
- **Idempotencia**: el cliente genera un `checkout_token` (UUID) por intento de
  compra; la columna `order.checkout_token` es `UNIQUE` y si el token ya generó
  una orden se devuelve la existente (evita órdenes duplicadas por doble clic o reintentos).
- **Cliente**: se reutiliza el `partner` de negocio de la empresa con el mismo
  email (`rel_partner_company.relationship_type = 'partner'`) o se crea uno con
  rol `guest`.
- **Cupones**: porcentaje → `discount_percent` en cada línea; monto fijo →
  línea negativa. El contador `usage_count` se incrementa bajo lock.
- **Envío**: se agrega como línea de la orden («Envío — {método}») para que los
  triggers existentes calculen los totales; además se guarda
  `shipping_method_name`/`shipping_cost` en la orden para reporting.
- La orden nace **`posted`** (venta confirmada), `payment_status='unpaid'`, no entregada.

### Inventario
El stock **no** se descuenta en el checkout: igual que el resto del ERP, se
descuenta al confirmar el picking de salida. Flujo de cumplimiento:

1. La orden llega a `/admin/orders` con badge «Tienda en línea».
2. Al marcarla como entregada, el trigger existente crea el picking de salida.
3. Confirmar el picking descuenta el inventario.

El checkout valida disponibilidad al momento de comprar, pero entre la compra y
el picking puede haber sobreventa si se vende por otros canales (mismo
comportamiento que las órdenes de venta del panel).

### Pagos
El proyecto no integra una pasarela de pago; el checkout ofrece el catálogo
`payment_method` de la empresa (transferencia, contra entrega, etc.), registra
`payment_method_id` en la orden y la deja `unpaid`. El cobro se concilia desde
el dashboard (acción «pagar» existente). **Nunca se capturan ni almacenan datos
de tarjeta.** Si en el futuro se integra una pasarela, debe usarse
hosted-fields/checkout de la pasarela y actualizarse `payment_status` vía webhook.

### Origen de las órdenes
Nueva columna `order.origin` (`dashboard` | `pos` | `storefront`), con backfill
`pos` para órdenes con `pos_session_id`. `v_orders` fue recreada para exponerla.

### Facturación
El modelo de `order` solo tiene dirección de envío; no existe dirección de
facturación separada en el ERP, así que el checkout captura únicamente la de
envío (decisión documentada; agregar campos `billing_*` sería una migración aparte).

### Variantes de producto
El ERP no tiene matriz de variantes; `product.attributes` (JSONB) se muestra
como lista de características en el detalle. Un sistema de variantes con stock
por combinación requeriría modelado adicional.

### Tipos de TypeScript
`types/database.types.ts` no pudo regenerarse desde la sesión (requiere
credenciales del CLI). `types/storefront.types.ts` es un **shim temporal** que
extiende `Database` con las tablas nuevas, y los RPCs se llaman con cast
`as never` (patrón ya usado en `usePublicProject`). Tras correr
`npm run db:types`, se puede migrar a `Tables<'storefront_settings'>` etc. y
eliminar el shim.

## Archivos principales

| Capa | Archivos |
|---|---|
| Migración | `supabase/migrations/20260707120000_create_storefront_module.sql` |
| Composables | `useStorefront` (público), `useStorefrontSettings`, `useStorefrontCoupon`, `useStorefrontShippingMethod` |
| Estado | `app/stores/storefront.ts` (tienda actual + carrito persistido + toast) |
| Layout | `app/layouts/storefront.vue` |
| Páginas públicas | `app/pages/stores/[company_slug]/**` |
| Admin | `app/pages/admin/storefront/**` + entrada «Tienda en línea» en el sidebar |
| Componentes | `Storefront/ProductCard.vue`, `StorefrontCoupon/Form.vue`, `StorefrontShippingMethod/Form.vue` |
| Utils | `app/utils/storefront.ts` (`formatStorefrontCurrency`, `storefrontPath`) |

## Analítica

La tienda incluye analítica first-party (tracker propio, ingesta vía
`/api/storefront/analytics`, sesiones/rollups en Supabase y panel en
`/admin/storefront/analytics`), con banner de consentimiento de cookies.
Documentación completa en `docs/storefront-analytics.md`.
