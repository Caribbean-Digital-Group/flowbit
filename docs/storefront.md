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
El checkout ofrece dos vías:

- **Métodos manuales** — catálogo `payment_method` de la empresa
  (transferencia, contra entrega, etc.): registra `payment_method_id` en la
  orden y la deja `unpaid`; el cobro se concilia desde el dashboard (acción
  «pagar» existente).
- **Tarjeta vía Stripe** (opcional, por empresa) — Stripe Checkout hosted con
  confirmación por webhook y verificación al retorno. La orden se crea con
  `payment_provider='stripe'` y `payment_status` se actualiza en servidor.
  Documentación completa en `docs/storefront-stripe.md`.

**Nunca se capturan ni almacenan datos de tarjeta** en Flowbit; el cobro con
tarjeta ocurre en la página hospedada de Stripe.

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

## Diseño de la tienda (plantillas y paletas)

Cada tienda elige una **plantilla** y una **paleta**, y puede sobrescribir
colores, tipografía, esquinas, estilo de tarjeta y composición del hero desde
**Tienda en línea → Ajustes → Diseño de la tienda**, con vista previa en vivo.

### Motor de temas

`app/utils/storefrontTheme.ts` es la fuente única: datos puros, sin Vue.
Resuelve plantilla + paleta + ajustes del vendedor en un conjunto de variables
CSS `--sf-*` que el layout aplica en el nodo raíz. `app/assets/css/storefront.css`
define las clases (`sf-btn`, `sf-card`, `sf-heading`, `sf-bg-surface`…) que
consumen esos tokens.

> Regla del módulo: **ningún componente escribe un color literal**. Si hace
> falta un tono nuevo, se agrega como token, no como clase de Tailwind.
>
> `storefront.css` no está dentro de una capa de Tailwind, y en Tailwind v4 el
> CSS sin capa gana a las utilidades. Por eso `sf-border` no se combina con
> `border-x-0`/`border-b-0` (se dibujaría un marco completo): para un solo lado
> se usan `sf-border-t`, `sf-border-b` o `sf-border-y`. Lo mismo aplica a
> `display`: `sf-btn`, `sf-icon-btn`, `sf-badge` y `sf-card` lo fijan, así que
> `hidden`/`lg:hidden` se ponen en un contenedor, nunca en el mismo elemento. El pie de página usa
> `sf-footer`, `sf-footer-title`, `sf-footer-link` y `sf-footer-bar`, y lo
> comparten la tienda y el sitio web.

| Plantilla | Hero | Tarjeta | Superficie | Pensada para |
|---|---|---|---|---|
| `aurora` | split | elevated | clara | catálogos generales |
| `boutique` | editorial | minimal | clara | moda, joyería, belleza |
| `impulse` | banner | bordered | clara | electrónica y ofertas |
| `mercado` | centered | elevated | clara | alimentos y venta local |
| `noir` | banner | overlay | **oscura** | marcas premium y diseño |
| `esencial` | compact | bordered | clara | mayoristas y catálogos extensos |

Paletas incluidas: índigo, océano, bosque, coral, uva, ámbar, medianoche, rosa,
turquesa y grafito. Tipografías: sistema, editorial, moderna, cercana y
refinada (las que no son del sistema se cargan desde Google Fonts solo cuando
se eligen).

### Contraste garantizado

El vendedor puede elegir cualquier color, incluidos tonos claros donde el texto
blanco resulta ilegible. El motor lo resuelve sin quitarle el color:

- `--sf-primary` conserva **exactamente** el color elegido y se usa en
  superficies decorativas sin texto.
- `--sf-primary-contrast` es blanco o casi negro, el que mejor contraste dé.
- `--sf-primary-strong` es el color ajustado lo mínimo necesario para alcanzar
  **4.5:1 (WCAG AA)** con ese texto; es el que usan botones y badges.
- `--sf-primary-readable` es la versión utilizable como texto sobre el fondo.

Los tonos medios (índigo `#6366f1`, océano `#0284c7`) no alcanzan AA ni con
blanco ni con negro: por eso se ajusta el fondo y no el texto. Cuando eso
ocurre, el panel avisa al vendedor y le dice qué color se usará.

### Secciones configurables de la portada

Toggles en `storefront_settings`: `show_categories`, `show_featured`,
`show_story`, `show_benefits`, más `featured_limit` (4–12, aplicado en el RPC),
`hero_cta_label`, `announcement_link` y `benefits` (JSONB editable con icono,
título y texto). El hero muestra **imágenes reales del catálogo** en lugar de
ilustraciones genéricas.

### Archivos

| Capa | Archivos |
|---|---|
| Motor | `app/utils/storefrontTheme.ts` |
| Estilos | `app/assets/css/storefront.css` |
| Composable | `app/composables/useStorefrontTheme.ts` |
| Componentes | `Storefront/Hero.vue`, `Storefront/ProductCard.vue`, `Storefront/ThemePreview.vue` |
| Migración | `supabase/migrations/20260910120000_add_theme_to_storefront.sql` |

## Analítica

La tienda incluye analítica first-party (tracker propio, ingesta vía
`/api/storefront/analytics`, sesiones/rollups en Supabase y panel en
`/admin/storefront/analytics`), con banner de consentimiento de cookies.
Documentación completa en `docs/storefront-analytics.md`.
