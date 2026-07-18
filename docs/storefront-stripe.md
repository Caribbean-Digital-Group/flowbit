# Storefront — Pagos con tarjeta vía Stripe

Cada empresa puede conectar su propia cuenta de Stripe para cobrar con tarjeta
en el checkout de su tienda (`/stores/[company_slug]/checkout`). La integración
usa **Stripe Checkout (hosted)**: el cliente es redirigido a una página de pago
de Stripe, por lo que Flowbit **nunca captura ni almacena datos de tarjeta**
(cumplimiento PCI delegado a Stripe).

---

## Configuración (vendedor)

En **Tienda en línea → Ajustes** (`/admin/storefront`), sección
**Pasarela de pago — Stripe**:

1. Pegar la **publishable key** (`pk_...`) y la **secret key** (`sk_...` o
   `rk_...` restringida) de Stripe → Developers → API keys.
2. Activar el switch **Habilitado**.
3. **Recomendado:** crear un webhook en Stripe → Developers → Webhooks con la
   URL que muestra el panel (`{SITE_URL}/api/storefront/stripe/webhook`),
   suscrito a `checkout.session.completed` y
   `checkout.session.async_payment_succeeded`, y pegar el **signing secret**
   (`whsec_...`). Sin webhook la integración también funciona: el pago se
   verifica contra la API de Stripe cuando el cliente regresa a la página de
   confirmación.

## Requisito de despliegue

El backend necesita la clave `service_role` de Supabase para leer las
credenciales de Stripe (los RPCs de servicio solo son ejecutables por
`service_role`):

```
SUPABASE_SECRET_KEY=   # service_role key — SOLO en el servidor, nunca en el cliente
```

Sin esta variable, los endpoints `/api/storefront/stripe/*` responden `503` y
la tienda sigue operando con los métodos de pago manuales.

## Flujo de pago

1. El cliente elige **«Tarjeta de crédito o débito»** en el paso de pago del
   checkout (la opción solo aparece si la tienda habilitó Stripe; conviven con
   los métodos manuales del catálogo `payment_method`).
2. `place_storefront_order(..., p_payment_provider => 'stripe')` crea la orden
   `posted` / `unpaid` con `payment_provider='stripe'` y `payment_method_id`
   NULL (no aplica el catálogo manual).
3. El cliente llama `POST /api/storefront/stripe/session` con
   `{ slug, order_ref, email }`. El servidor:
   - Lee la orden y la secret key vía RPC `get_storefront_stripe_order`
     (service_role); el **monto sale siempre de la orden en BD**, nunca del
     cliente. El email debe coincidir con el de la compra (anti-enumeración).
   - Reutiliza la Checkout Session previa si sigue `open` (evita sesiones
     huérfanas en reintentos) y crea una nueva si no existe. Las URLs de
     retorno (`success_url`/`cancel_url`) se construyen con el dominio de la
     petición (headers de proxy incluidos), no con `NUXT_PUBLIC_SITE_URL`;
     si la sesión abierta apunta a otro dominio (ej. creada en localhost
     contra la misma BD), se expira y se genera una nueva.
   - Guarda `order.stripe_session_id` (`record_storefront_stripe_session`) y
     devuelve la URL de pago; el navegador redirige a Stripe.
4. Confirmación del cobro (dos caminos, ambos idempotentes):
   - **Webhook** `POST /api/storefront/stripe/webhook`: multi-tenant — el slug
     viaja en la metadata del evento y solo se usa para elegir con qué
     `stripe_webhook_secret` verificar la firma; un payload forjado con el
     slug de otra empresa no pasa la verificación. Si
     `payment_status='paid'`, llama `mark_storefront_order_paid`.
   - **Retorno del cliente**: la página de confirmación
     (`?stripe=success&session_id=...`) llama
     `POST /api/storefront/stripe/status`, que consulta la sesión
     directamente en la API de Stripe con la secret key y marca la orden si
     ya fue cobrada. El cliente no puede forzar el estado.
5. `mark_storefront_order_paid` valida moneda y monto (tolerancia de $0.50 por
   redondeo a unidades mínimas), marca `paid` (o `partial` si el monto no
   alcanza), y registra `paid_at`, `stripe_session_id` y
   `stripe_payment_intent_id`. Es idempotente ante reintentos del webhook.
6. Si el cliente cancela (`?stripe=cancelled`) o falla la creación de la
   sesión, la orden queda `unpaid` y la confirmación muestra el botón
   **«Pagar ahora con tarjeta»** para reintentar.

## Seguridad

- La **secret key** y el **webhook secret** viven en `storefront_settings` y
  solo se leen mediante RPCs `SECURITY DEFINER` con `GRANT ... TO service_role`
  y `REVOKE ... FROM PUBLIC, anon, authenticated` explícito. Los RPCs públicos
  (`get_storefront_checkout_info`) exponen únicamente `enabled` y la
  publishable key (pública por diseño).
- Los endpoints `session`/`status` aplican rate-limit por IP (mismo limiter de
  analítica) y validan shape de slug/ref/email.
- Precios, montos y estado de pago se resuelven siempre en servidor.

## Archivos

| Capa | Archivos |
|---|---|
| Migración | `supabase/migrations/20260717120000_add_stripe_to_storefront.sql` |
| Endpoints | `server/api/storefront/stripe/{session,status,webhook}.post.ts` |
| Utils server | `server/utils/storefrontStripe.ts` |
| Checkout | `app/pages/stores/[company_slug]/checkout/index.vue` |
| Confirmación | `app/pages/stores/[company_slug]/checkout/confirmation/[order_ref].vue` |
| Admin | `app/pages/admin/storefront/index.vue` (sección Stripe) |
| SDK | `stripe` (npm, solo servidor) |

## Pruebas

Con las claves `pk_test_...`/`sk_test_...` de Stripe, la tarjeta de prueba
`4242 4242 4242 4242` (cualquier fecha futura y CVC) completa el flujo. Para
probar el webhook en local: `stripe listen --forward-to
localhost:3000/api/storefront/stripe/webhook` y usar el `whsec_...` que
imprime el CLI.
