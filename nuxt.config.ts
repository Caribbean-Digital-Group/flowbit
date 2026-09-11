import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
const siteUrl = (process.env.NUXT_PUBLIC_SITE_URL || 'https://tryflowbit.netlify.app').replace(/\/$/, '')

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
    // El manual pasó de /admin/manual y /help a la sección pública /manual.
    '/help': { redirect: { to: '/manual', statusCode: 301 } },
    '/help/**': { redirect: { to: '/manual/**', statusCode: 301 } },
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
      htmlAttrs: { lang: 'es' },
      meta: [
        { name: 'author', content: 'Caribbean Digital Group' },
        // Las vistas privadas lo sobrescriben con noindex desde su layout
        { name: 'robots', content: 'index, follow' },
        { name: 'googlebot', content: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' },
        { name: 'theme-color', content: '#6366f1' },
        { name: 'apple-mobile-web-app-title', content: 'Flowbit' },
        { name: 'application-name', content: 'Flowbit' },
        { property: 'og:site_name', content: 'Flowbit' },
        { property: 'og:type', content: 'website' },
        { property: 'og:locale', content: 'es_ES' },
        // Respaldo para las páginas que no definen su propia imagen
        { property: 'og:image', content: `${siteUrl}/og-image.png` },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:alt', content: 'Flowbit — ERP open source' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:image', content: `${siteUrl}/og-image.png` },
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
