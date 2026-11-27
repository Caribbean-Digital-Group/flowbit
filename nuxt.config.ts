import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
const siteUrl = (process.env.NUXT_PUBLIC_SITE_URL || 'https://tryflowbit.netlify.app').replace(/\/$/, '')

// Verificación de propiedad en Google Search Console y Bing Webmaster Tools
// (método «etiqueta HTML»). Se leen al compilar; vacías no se emite la etiqueta.
const searchVerificationMeta = [
  { name: 'google-site-verification', content: process.env.NUXT_PUBLIC_GOOGLE_SITE_VERIFICATION },
  { name: 'msvalidate.01', content: process.env.NUXT_PUBLIC_BING_SITE_VERIFICATION },
].filter((meta): meta is { name: string, content: string } => Boolean(meta.content))

// Base de encabezados HTTP de seguridad. Sin CSP completa todavía: Nuxt inyecta
// scripts inline y el panel habla con Supabase y Stripe (ver docs/security-headers.md).
// Sin Referrer-Policy global a propósito: Netlify concatena valores repetidos de
// reglas que se traslapan y anularía el `no-referrer` del kiosco; el navegador ya
// usa strict-origin-when-cross-origin por defecto.
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy': "frame-ancestors 'self'",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
}

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  future: {
    compatibilityVersion: 4,
  },
  modules: ['@pinia/nuxt'],
  runtimeConfig: {
    // Solo servidor: clave service_role para los RPCs de Stripe (nunca llega al cliente)
    supabaseSecretKey: process.env.SUPABASE_SECRET_KEY,
    // Solo servidor: protege /api/health/keepalive (opcional; si está vacío el
    // endpoint queda abierto pero estrangulado a un latido por minuto)
    healthPingToken: process.env.HEALTH_PING_TOKEN || '',
    public: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
      siteUrl,
    },
  },
  routeRules: {
    // Encabezados de seguridad para todas las rutas (docs/security-headers.md).
    // Nitro los aplica en el servidor y el preset de Netlify los copia a `_headers`.
    // SAMEORIGIN (no DENY): la impresión de órdenes usa un iframe del mismo origen.
    '/**': { headers: securityHeaders },
    // El manual pasó de /admin/manual y /help a la sección pública /manual.
    '/help': { redirect: { to: '/manual', statusCode: 301 } },
    '/help/**': { redirect: { to: '/manual/**', statusCode: 301 } },
    // El token del kiosco viaja en la URL: no se envía como Referer ni se indexa.
    '/kiosk/**': { headers: { 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' } },
  },
  alias: {
    '~/types': '../types',
  },
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [
      tailwindcss(),
    ],
  },
  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      htmlAttrs: { lang: 'es-MX' },
      meta: [
        { name: 'author', content: 'Flowbit' },
        // Las vistas privadas lo sobrescriben con noindex desde su layout
        { name: 'robots', content: 'index, follow' },
        { name: 'googlebot', content: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' },
        { name: 'theme-color', content: '#6366f1' },
        { name: 'apple-mobile-web-app-title', content: 'Flowbit' },
        { name: 'application-name', content: 'Flowbit' },
        { property: 'og:site_name', content: 'Flowbit ERP' },
        { property: 'og:type', content: 'website' },
        { property: 'og:locale', content: 'es_MX' },
        // Respaldo para las páginas que no definen su propia imagen
        { property: 'og:image', content: `${siteUrl}/og-image.png` },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:alt', content: 'Flowbit ERP, el ERP open source en español hecho para México' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:image', content: `${siteUrl}/og-image.png` },
        ...searchVerificationMeta,
      ],
      link: [
        // El SVG lo prefieren los navegadores modernos; el .ico cubre al resto
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico', sizes: '16x16 32x32 48x48' },
        { rel: 'icon', type: 'image/png', sizes: '96x96', href: '/favicon-96x96.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
      ],
    },
  },
})
