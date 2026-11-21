# Encabezados de seguridad HTTP

Flowbit envía una base de encabezados de seguridad en **todas** las rutas: el
panel (`/admin`, `/pos`), las páginas públicas, la tienda, los sitios web, el
kiosco y las rutas Nitro (`/health`, `/api/**`).

## Dónde se declaran

Una sola fuente: `securityHeaders` en `nuxt.config.ts`, aplicada con
`routeRules['/**']`.

- En desarrollo y en cualquier servidor Node, Nitro los agrega a cada respuesta.
- En Netlify, el preset de Nitro los copia también al archivo `dist/_headers`.

No los dupliques en `netlify.toml` ni en `public/_headers`.

## Qué se envía y por qué

| Encabezado | Valor | Protege contra |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Que el navegador «adivine» el tipo de un archivo y ejecute como script algo que no lo es. |
| `X-Frame-Options` | `SAMEORIGIN` | Clickjacking: otro sitio no puede incrustar Flowbit en un iframe. |
| `Content-Security-Policy` | `frame-ancestors 'self'` | Lo mismo que el anterior, en su versión moderna. |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), browsing-topics=()` | Uso de cámara, micrófono, ubicación o seguimiento publicitario por scripts de terceros. |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Que la sesión viaje alguna vez por HTTP sin cifrar. |

### Decisiones

- **`SAMEORIGIN` y no `DENY`:** la impresión de órdenes (`/admin/orders/[id]`)
  usa un iframe del mismo origen.
- **Sin `Referrer-Policy` global:** el kiosco (`/kiosk/**`) necesita
  `no-referrer` porque su token viaja en la URL. Netlify concatena los valores
  cuando dos reglas de `_headers` coinciden en la misma ruta, y el valor global
  anularía el del kiosco. Los navegadores ya usan
  `strict-origin-when-cross-origin` por defecto.
- **Sin cámara:** ningún módulo la usa hoy. Si un módulo la necesita (por
  ejemplo, escanear QR desde el navegador), habilítala solo para su ruta con una
  regla más específica, por ejemplo
  `'/admin/pickings/**': { headers: { 'Permissions-Policy': 'camera=(self)' } }`,
  y quita `camera=()` del valor global para evitar el mismo problema de
  concatenación.
- **Sin CSP completa (todavía):** Nuxt inyecta scripts inline y el panel llama a
  Supabase y a Stripe. Una CSP estricta debe probarse primero en modo
  `Content-Security-Policy-Report-Only` para no romper la app.

## Cómo verificar

```bash
npm run build && npm run test:e2e   # incluye e2e/security-headers.spec.ts
curl -sI https://tryflowbit.netlify.app/manual | grep -iE 'x-frame|nosniff|permissions|strict-transport|content-security'
```
