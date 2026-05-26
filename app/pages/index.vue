<script setup lang="ts">
const config = useRuntimeConfig()
const siteUrl = config.public.siteUrl as string

const pageTitle = 'Flowbit — ERP gratuito y open source para gestionar tu empresa'
const pageDescription = 'Plataforma todo-en-uno para gestionar clientes, proyectos, órdenes, inventario y almacenes. Gratis para siempre, código abierto con licencia MIT. Sin límites, sin fricciones.'
const ogImage = `${siteUrl}/og-image.png`

useSeoMeta({
  title: pageTitle,
  description: pageDescription,
  keywords: 'ERP gratuito, gestión operativa, open source, proyectos, inventario, órdenes, clientes, almacén, picking, MIT, Nuxt, Supabase',
  ogTitle: pageTitle,
  ogDescription: pageDescription,
  ogImage,
  ogUrl: siteUrl,
  twitterTitle: pageTitle,
  twitterDescription: 'Gestiona clientes, proyectos, órdenes, inventario y almacenes — gratis y sin límites. Open source MIT.',
  twitterImage: ogImage,
})

useHead({
  link: [{ rel: 'canonical', href: siteUrl }],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Organization',
            '@id': `${siteUrl}/#organization`,
            name: 'Flowbit',
            url: siteUrl,
            sameAs: ['https://github.com/Caribbean-Digital-Group/flowbit'],
          },
          {
            '@type': 'WebSite',
            '@id': `${siteUrl}/#website`,
            url: siteUrl,
            name: 'Flowbit',
            description: pageDescription,
            publisher: { '@id': `${siteUrl}/#organization` },
            inLanguage: 'es-ES',
          },
          {
            '@type': 'SoftwareApplication',
            name: 'Flowbit',
            operatingSystem: 'Web',
            applicationCategory: 'BusinessApplication',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            description: pageDescription,
            url: siteUrl,
            license: 'https://opensource.org/licenses/MIT',
          },
        ],
      }),
    },
  ],
})

const modules = [
  { name: 'Partners', label: 'Clientes', icon: 'users' },
  { name: 'Products', label: 'Productos', icon: 'box' },
  { name: 'Orders', label: 'Órdenes', icon: 'doc' },
  { name: 'Projects', label: 'Proyectos', icon: 'rocket' },
  { name: 'Tasks', label: 'Tareas', icon: 'check' },
  { name: 'Pickings', label: 'Pickings', icon: 'truck' },
  { name: 'Warehouses', label: 'Almacenes', icon: 'building' },
  { name: 'Reports', label: 'Reportes', icon: 'chart' },
]

const workflow = [
  { step: '01', title: 'Cliente', description: 'Registra socios comerciales con toda su información fiscal y de contacto.', color: 'from-indigo-500 to-indigo-600' },
  { step: '02', title: 'Proyecto', description: 'Crea proyectos, asigna tareas y monitorea progreso en tiempo real.', color: 'from-violet-500 to-violet-600' },
  { step: '03', title: 'Orden', description: 'Genera órdenes de venta o compra a partir de tu catálogo de productos.', color: 'from-fuchsia-500 to-fuchsia-600' },
  { step: '04', title: 'Almacén', description: 'Picking, inventario y trazabilidad completa desde el almacén.', color: 'from-indigo-500 via-violet-500 to-fuchsia-500' },
]
</script>

<template>
  <div class="w-full overflow-hidden">
    <!-- ============================================ -->
    <!-- HERO SECTION -->
    <!-- ============================================ -->
    <section class="relative bg-slate-950 overflow-hidden">
      <!-- Mesh gradient background -->
      <div class="absolute inset-0">
        <div class="absolute top-0 -left-40 w-[600px] h-[600px] bg-indigo-600/30 rounded-full blur-[120px]"></div>
        <div class="absolute top-1/3 right-0 w-[500px] h-[500px] bg-fuchsia-600/25 rounded-full blur-[120px]"></div>
        <div class="absolute bottom-0 left-1/3 w-[500px] h-[500px] bg-violet-600/30 rounded-full blur-[120px]"></div>
      </div>

      <!-- Animated dot grid -->
      <div class="absolute inset-0 opacity-[0.15]">
        <div class="absolute inset-0" style="background-image: radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px); background-size: 32px 32px;"></div>
      </div>

      <!-- Subtle scan line -->
      <div class="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent"></div>

      <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
        <div class="grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center">
          <!-- Left - Content -->
          <div class="text-center lg:text-left">
            <!-- Badge -->
            <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 mb-8">
              <span class="relative flex h-2 w-2">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-fuchsia-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2 w-2 bg-fuchsia-500"></span>
              </span>
              <span class="text-sm font-medium text-slate-300">Open Source · MIT License · v1.0</span>
            </div>

            <!-- Title -->
            <h1 class="text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-[1.05] mb-6 tracking-tight">
              Operación
              <span class="block">
                en <span class="relative inline-block">
                  <span class="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300">flujo</span>
                  <svg class="absolute -bottom-2 left-0 w-full" height="12" viewBox="0 0 200 12" preserveAspectRatio="none">
                    <path d="M2 8 Q 50 2, 100 8 T 198 8" stroke="url(#underline)" stroke-width="3" fill="none" stroke-linecap="round"/>
                    <defs>
                      <linearGradient id="underline" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="#818cf8"/>
                        <stop offset="50%" stop-color="#a78bfa"/>
                        <stop offset="100%" stop-color="#e879f9"/>
                      </linearGradient>
                    </defs>
                  </svg>
                </span> continuo.
              </span>
            </h1>

            <p class="text-lg sm:text-xl text-slate-400 mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Una plataforma todo-en-uno para gestionar clientes, proyectos, órdenes, inventario y almacenes.
              <span class="text-slate-200 font-medium">Sin licencias. Sin límites. Sin fricciones.</span>
            </p>

            <!-- CTA buttons -->
            <div class="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-12">
              <a href="#ecosistema" class="group relative inline-flex items-center justify-center px-7 py-4 font-semibold rounded-xl text-white bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 hover:shadow-2xl hover:shadow-violet-500/40 transition-all duration-300 overflow-hidden">
                <span class="absolute inset-0 bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></span>
                <span class="relative flex items-center">
                  Explorar plataforma
                  <svg class="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
                  </svg>
                </span>
              </a>
              <a href="#workflow" class="inline-flex items-center justify-center px-7 py-4 font-medium rounded-xl text-slate-200 bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all">
                <svg class="mr-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Cómo funciona
              </a>
            </div>

            <!-- Stats inline -->
            <div class="grid grid-cols-3 gap-6 max-w-md mx-auto lg:mx-0 pt-8 border-t border-white/10">
              <div>
                <div class="text-3xl font-bold text-white">8+</div>
                <div class="text-sm text-slate-400 mt-1">Módulos integrados</div>
              </div>
              <div>
                <div class="text-3xl font-bold bg-gradient-to-r from-indigo-300 to-fuchsia-300 bg-clip-text text-transparent">$0</div>
                <div class="text-sm text-slate-400 mt-1">Para siempre</div>
              </div>
              <div>
                <div class="text-3xl font-bold text-white">∞</div>
                <div class="text-sm text-slate-400 mt-1">Usuarios incluidos</div>
              </div>
            </div>
          </div>

          <!-- Right - Login Card with floating decoration -->
          <div class="relative">
            <!-- Floating geometric decoration behind -->
            <div class="absolute -inset-8 pointer-events-none">
              <!-- Orbital ring -->
              <svg class="absolute inset-0 w-full h-full animate-spin-slow opacity-20" viewBox="0 0 400 400" fill="none">
                <circle cx="200" cy="200" r="180" stroke="url(#ring-gradient)" stroke-width="1" stroke-dasharray="4 8"/>
                <defs>
                  <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#818cf8"/>
                    <stop offset="100%" stop-color="#e879f9"/>
                  </linearGradient>
                </defs>
              </svg>

              <!-- Floating dots -->
              <div class="absolute top-0 left-1/2 w-3 h-3 bg-fuchsia-400 rounded-full shadow-lg shadow-fuchsia-500/50 animate-float-soft"></div>
              <div class="absolute top-1/2 right-0 w-2 h-2 bg-indigo-400 rounded-full shadow-lg shadow-indigo-500/50 animate-float-soft" style="animation-delay: 1s;"></div>
              <div class="absolute bottom-1/4 left-0 w-2.5 h-2.5 bg-violet-400 rounded-full shadow-lg shadow-violet-500/50 animate-float-soft" style="animation-delay: 2s;"></div>
            </div>

            <!-- Glow border -->
            <div class="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 rounded-3xl blur opacity-30"></div>

            <div class="relative">
              <FormLogin />
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom fade -->
      <div class="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-slate-950 to-transparent"></div>
    </section>

    <!-- ============================================ -->
    <!-- MARQUEE - MÓDULOS -->
    <!-- ============================================ -->
    <section class="relative bg-slate-950 border-y border-white/10 py-8 overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-r from-slate-950 via-transparent to-slate-950 z-10 pointer-events-none"></div>
      <div class="flex gap-8 animate-marquee whitespace-nowrap">
        <template v-for="i in 3" :key="i">
          <div v-for="mod in modules" :key="`${i}-${mod.name}`" class="inline-flex items-center gap-3 text-2xl font-semibold text-slate-500 hover:text-white transition-colors">
            <span class="w-2 h-2 rounded-full bg-gradient-to-br from-indigo-400 to-fuchsia-400"></span>
            {{ mod.label }}
            <span class="text-slate-700 mx-4">/</span>
          </div>
        </template>
      </div>
    </section>

    <!-- ============================================ -->
    <!-- ECOSISTEMA - BENTO GRID -->
    <!-- ============================================ -->
    <section id="ecosistema" class="relative bg-white px-4 sm:px-6 lg:px-8 py-24 scroll-mt-20 overflow-hidden">
      <!-- Background mesh -->
      <div class="absolute inset-0 opacity-50">
        <div class="absolute top-20 right-10 w-[400px] h-[400px] bg-indigo-200/40 rounded-full blur-3xl"></div>
        <div class="absolute bottom-20 left-10 w-[400px] h-[400px] bg-fuchsia-200/30 rounded-full blur-3xl"></div>
      </div>

      <div class="relative max-w-7xl mx-auto">
        <!-- Header -->
        <div class="max-w-3xl mb-16">
          <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-100 to-fuchsia-100 border border-indigo-200/50 mb-6">
            <svg class="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z"/>
            </svg>
            <span class="text-sm font-semibold text-indigo-700">El ecosistema Flowbit</span>
          </div>
          <h2 class="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 mb-6 tracking-tight">
            Cada módulo,
            <span class="block">
              una <span class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600">pieza de la operación</span>.
            </span>
          </h2>
          <p class="text-xl text-slate-600 leading-relaxed">
            Módulos diseñados para conversar entre sí. Todo lo que hagas en clientes se refleja en órdenes, proyectos y almacén automáticamente.
          </p>
        </div>

        <!-- Bento Grid -->
        <div class="grid grid-cols-1 md:grid-cols-6 gap-5 auto-rows-[180px]">
          <!-- Partners - Big -->
          <div class="md:col-span-3 md:row-span-2 group relative bg-gradient-to-br from-indigo-50 via-white to-violet-50 rounded-3xl p-8 border border-indigo-100 hover:border-indigo-300 transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/20 overflow-hidden">
            <!-- Abstract decoration -->
            <div class="absolute -top-20 -right-20 w-64 h-64 bg-gradient-to-br from-indigo-300/40 to-violet-300/40 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700"></div>
            <div class="absolute -bottom-10 -left-10 w-40 h-40 bg-gradient-to-tr from-violet-200/50 to-fuchsia-200/30 rounded-full blur-xl"></div>

            <div class="relative h-full flex flex-col">
              <div class="flex items-start justify-between mb-6">
                <div class="w-16 h-16 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/30 group-hover:rotate-6 group-hover:scale-110 transition-all duration-500">
                  <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                  </svg>
                </div>
                <span class="px-3 py-1 text-xs font-bold rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">CORE</span>
              </div>

              <h3 class="text-2xl font-bold text-slate-900 mb-3">Gestión de Clientes</h3>
              <p class="text-slate-600 leading-relaxed mb-6 flex-1">
                Socios comerciales con datos fiscales completos, contactos, direcciones múltiples e historial.
                Búsqueda inteligente y categorización por tipo de partner.
              </p>

              <!-- Mini preview chips -->
              <div class="flex flex-wrap gap-2">
                <span class="px-3 py-1.5 rounded-full text-xs font-medium bg-white border border-slate-200 text-slate-700 shadow-sm">RFC y datos fiscales</span>
                <span class="px-3 py-1.5 rounded-full text-xs font-medium bg-white border border-slate-200 text-slate-700 shadow-sm">Direcciones múltiples</span>
                <span class="px-3 py-1.5 rounded-full text-xs font-medium bg-white border border-slate-200 text-slate-700 shadow-sm">Historial completo</span>
              </div>
            </div>
          </div>

          <!-- Projects -->
          <div class="md:col-span-3 group relative bg-slate-900 rounded-3xl p-8 border border-slate-800 hover:border-violet-500/50 transition-all duration-500 hover:shadow-2xl hover:shadow-violet-500/30 overflow-hidden">
            <div class="absolute -top-10 -right-10 w-48 h-48 bg-violet-600/30 rounded-full blur-3xl group-hover:bg-violet-600/50 transition-colors duration-700"></div>

            <div class="relative h-full flex items-start gap-6">
              <div class="w-14 h-14 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-2xl flex items-center justify-center shadow-xl shadow-violet-500/40 flex-shrink-0">
                <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
              </div>
              <div class="flex-1">
                <h3 class="text-xl font-bold text-white mb-2">Proyectos</h3>
                <p class="text-slate-400 text-sm leading-relaxed mb-4">
                  Define proyectos por tipo, asigna responsables, monitorea progreso con KPIs en tiempo real.
                </p>
                <div class="flex items-center gap-4 text-xs">
                  <span class="flex items-center gap-1.5 text-emerald-400">
                    <span class="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                    En curso
                  </span>
                  <span class="flex items-center gap-1.5 text-amber-400">
                    <span class="w-1.5 h-1.5 bg-amber-400 rounded-full"></span>
                    Pendiente
                  </span>
                  <span class="flex items-center gap-1.5 text-violet-400">
                    <span class="w-1.5 h-1.5 bg-violet-400 rounded-full"></span>
                    Completado
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Tasks -->
          <div class="md:col-span-3 group relative bg-white rounded-3xl p-8 border border-slate-200 hover:border-fuchsia-300 transition-all duration-500 hover:shadow-2xl hover:shadow-fuchsia-500/20 overflow-hidden">
            <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-fuchsia-100 to-transparent rounded-bl-full"></div>

            <div class="relative h-full flex items-start gap-6">
              <div class="w-14 h-14 bg-gradient-to-br from-fuchsia-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-xl shadow-fuchsia-500/30 flex-shrink-0">
                <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                </svg>
              </div>
              <div class="flex-1">
                <h3 class="text-xl font-bold text-slate-900 mb-2">Tareas</h3>
                <p class="text-slate-600 text-sm leading-relaxed">
                  Desglose granular del trabajo. Asigna, prioriza, vincula a proyectos y mide el avance real.
                </p>
              </div>
            </div>
          </div>

          <!-- Orders -->
          <div class="md:col-span-2 group relative bg-gradient-to-br from-fuchsia-50 to-white rounded-3xl p-6 border border-fuchsia-100 hover:border-fuchsia-300 transition-all duration-500 hover:shadow-2xl hover:shadow-fuchsia-500/20 overflow-hidden">
            <div class="w-12 h-12 bg-gradient-to-br from-fuchsia-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-fuchsia-500/30 mb-4 group-hover:scale-110 transition-transform">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
            </div>
            <h3 class="text-lg font-bold text-slate-900 mb-1">Órdenes</h3>
            <p class="text-sm text-slate-600">Venta, compra y cotizaciones unificadas.</p>
          </div>

          <!-- Products -->
          <div class="md:col-span-2 group relative bg-white rounded-3xl p-6 border border-slate-200 hover:border-indigo-300 transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/20 overflow-hidden">
            <div class="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-4 group-hover:scale-110 transition-transform">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
              </svg>
            </div>
            <h3 class="text-lg font-bold text-slate-900 mb-1">Productos</h3>
            <p class="text-sm text-slate-600">Catálogo con costos, precios y existencias.</p>
          </div>

          <!-- Warehouses -->
          <div class="md:col-span-2 group relative bg-gradient-to-br from-violet-50 to-white rounded-3xl p-6 border border-violet-100 hover:border-violet-300 transition-all duration-500 hover:shadow-2xl hover:shadow-violet-500/20 overflow-hidden">
            <div class="w-12 h-12 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/30 mb-4 group-hover:scale-110 transition-transform">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
              </svg>
            </div>
            <h3 class="text-lg font-bold text-slate-900 mb-1">Almacenes</h3>
            <p class="text-sm text-slate-600">Múltiples bodegas con picking integrado.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ============================================ -->
    <!-- WORKFLOW -->
    <!-- ============================================ -->
    <section id="workflow" class="relative bg-slate-950 px-4 sm:px-6 lg:px-8 py-24 scroll-mt-20 overflow-hidden">
      <!-- Background -->
      <div class="absolute inset-0">
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-violet-600/20 via-fuchsia-600/10 to-transparent rounded-full blur-3xl"></div>
      </div>
      <!-- Grid -->
      <div class="absolute inset-0 opacity-[0.07]" style="background-image: linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px); background-size: 60px 60px;"></div>

      <div class="relative max-w-7xl mx-auto">
        <!-- Header -->
        <div class="text-center max-w-3xl mx-auto mb-20">
          <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 mb-6">
            <svg class="w-4 h-4 text-fuchsia-400" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"/>
            </svg>
            <span class="text-sm font-semibold text-slate-300">Workflow integrado</span>
          </div>
          <h2 class="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 tracking-tight">
            De cliente a entrega,
            <span class="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300">en un solo flujo.</span>
          </h2>
          <p class="text-xl text-slate-400 leading-relaxed">
            Cada acción genera información que alimenta al siguiente módulo. Sin duplicar capturas, sin perder contexto.
          </p>
        </div>

        <!-- Connected Flow -->
        <div class="relative">
          <!-- Connecting line for desktop -->
          <svg class="hidden lg:block absolute top-12 left-0 w-full h-20 z-0 pointer-events-none" viewBox="0 0 1200 80" preserveAspectRatio="none">
            <path d="M 100 40 Q 400 -20, 600 40 T 1100 40" stroke="url(#flow-line)" stroke-width="2" fill="none" stroke-dasharray="6 6" class="animate-dash"/>
            <defs>
              <linearGradient id="flow-line" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#6366f1"/>
                <stop offset="50%" stop-color="#a855f7"/>
                <stop offset="100%" stop-color="#e879f9"/>
              </linearGradient>
            </defs>
          </svg>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
            <div v-for="(item, idx) in workflow" :key="item.step" class="group relative">
              <!-- Node -->
              <div class="relative bg-slate-900/60 backdrop-blur-sm border border-white/10 rounded-3xl p-6 hover:border-white/20 hover:bg-slate-900/80 transition-all duration-500 hover:-translate-y-2 h-full">
                <!-- Step number with gradient ring -->
                <div class="relative w-24 h-24 mx-auto mb-6">
                  <div :class="['absolute inset-0 rounded-full bg-gradient-to-br opacity-20 blur-xl group-hover:opacity-40 transition-opacity', item.color]"></div>
                  <div :class="['relative w-full h-full rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-2xl shadow-2xl', item.color]">
                    {{ item.step }}
                  </div>
                  <!-- Pulse ring -->
                  <div :class="['absolute inset-0 rounded-full bg-gradient-to-br opacity-50 animate-ping-slow', item.color]" :style="{ animationDelay: `${idx * 0.4}s` }"></div>
                </div>

                <h3 class="text-xl font-bold text-white text-center mb-3">{{ item.title }}</h3>
                <p class="text-slate-400 text-sm text-center leading-relaxed">{{ item.description }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============================================ -->
    <!-- VENTAJAS - CREATIVE LAYOUT -->
    <!-- ============================================ -->
    <section id="ventajas" class="relative bg-gradient-to-b from-white via-indigo-50/30 to-white px-4 sm:px-6 lg:px-8 py-24 scroll-mt-20 overflow-hidden">
      <!-- Decorative -->
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <svg class="absolute top-20 left-10 w-24 h-24 text-indigo-200/60 animate-float" viewBox="0 0 100 100">
          <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" fill="currentColor"/>
        </svg>
        <svg class="absolute top-40 right-20 w-20 h-20 text-violet-200/60 animate-float-delayed" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="currentColor"/>
        </svg>
        <svg class="absolute bottom-32 left-1/4 w-16 h-16 text-fuchsia-200/60 animate-float" viewBox="0 0 100 100">
          <rect x="10" y="10" width="80" height="80" rx="15" fill="currentColor" transform="rotate(15 50 50)"/>
        </svg>
      </div>

      <div class="relative max-w-7xl mx-auto">
        <!-- Header -->
        <div class="text-center max-w-3xl mx-auto mb-20">
          <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/25 mb-6">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
            </svg>
            <span class="text-sm font-semibold">Ventajas únicas</span>
          </div>
          <h2 class="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 mb-6 tracking-tight">
            ¿Por qué
            <span class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600">Flowbit</span>?
          </h2>
          <p class="text-xl text-slate-600 leading-relaxed">
            Democratizamos la gestión operativa profesional. Sin licencias caras, sin lock-in, sin sorpresas.
          </p>
        </div>

        <!-- Bento Grid -->
        <div class="grid grid-cols-1 md:grid-cols-6 gap-5">
          <!-- Gratis (Large) -->
          <div class="md:col-span-4 group relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-10 border border-slate-800 hover:border-indigo-500/50 transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/30">
            <!-- Decorative -->
            <div class="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-indigo-500/30 rounded-full blur-3xl group-hover:bg-indigo-500/50 transition-colors duration-700"></div>
            <div class="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-fuchsia-500/20 rounded-full blur-3xl"></div>

            <!-- Mini code-like decoration -->
            <div class="absolute top-6 right-6 font-mono text-xs text-slate-600">
              <div>$ cost.compare</div>
              <div class="text-indigo-400">→ flowbit: $0/mo</div>
            </div>

            <div class="relative">
              <div class="text-9xl font-bold bg-gradient-to-br from-white via-indigo-200 to-fuchsia-300 bg-clip-text text-transparent leading-none mb-6">$0</div>
              <h3 class="text-3xl font-bold text-white mb-3">Gratis. Para siempre.</h3>
              <p class="text-slate-300 text-lg leading-relaxed max-w-xl">
                Sin freemium, sin trial. Todas las funcionalidades, todos los módulos, todos los usuarios.
                Nunca te pediremos una tarjeta de crédito.
              </p>
            </div>
          </div>

          <!-- Open Source -->
          <div class="md:col-span-2 group relative overflow-hidden bg-white rounded-3xl p-8 border border-slate-200 hover:border-slate-900 transition-all duration-500 hover:shadow-2xl">
            <div class="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center shadow-xl mb-6 group-hover:rotate-6 transition-transform">
              <svg class="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </div>
            <div class="flex items-center gap-2 mb-3">
              <h3 class="text-xl font-bold text-slate-900">Open Source</h3>
              <span class="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-900 text-white">MIT</span>
            </div>
            <p class="text-slate-600 text-sm leading-relaxed">
              Código 100% público. Audita, modifica, contribuye o forkéalo.
            </p>
          </div>

          <!-- Sin límites -->
          <div class="md:col-span-2 group relative overflow-hidden bg-gradient-to-br from-indigo-50 to-white rounded-3xl p-8 border border-indigo-100 hover:border-indigo-300 transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/20">
            <div class="absolute -top-10 -right-10 w-32 h-32 bg-indigo-200/40 rounded-full blur-2xl"></div>
            <div class="relative">
              <div class="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-indigo-600 to-violet-600 mb-3">∞</div>
              <h3 class="text-xl font-bold text-slate-900 mb-2">Sin límites</h3>
              <p class="text-slate-600 text-sm leading-relaxed">
                5 o 5.000 usuarios. Todos acceden con todos los permisos que asignes.
              </p>
            </div>
          </div>

          <!-- Privacidad -->
          <div class="md:col-span-2 group relative overflow-hidden bg-white rounded-3xl p-8 border border-slate-200 hover:border-violet-300 transition-all duration-500 hover:shadow-2xl hover:shadow-violet-500/20">
            <div class="w-14 h-14 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/30 mb-6 group-hover:scale-110 transition-transform">
              <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
            </div>
            <h3 class="text-xl font-bold text-slate-900 mb-2">Privacidad primero</h3>
            <p class="text-slate-600 text-sm leading-relaxed">
              Tus datos son tuyos. No vendemos información ni rastreamos comportamiento.
            </p>
          </div>

          <!-- Sin conocimiento técnico -->
          <div class="md:col-span-2 group relative overflow-hidden bg-gradient-to-br from-fuchsia-50 to-white rounded-3xl p-8 border border-fuchsia-100 hover:border-fuchsia-300 transition-all duration-500 hover:shadow-2xl hover:shadow-fuchsia-500/20">
            <div class="absolute -bottom-10 -right-10 w-32 h-32 bg-fuchsia-200/40 rounded-full blur-2xl"></div>
            <div class="relative">
              <div class="w-14 h-14 bg-gradient-to-br from-fuchsia-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg shadow-fuchsia-500/30 mb-6 group-hover:scale-110 transition-transform">
                <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                </svg>
              </div>
              <h3 class="text-xl font-bold text-slate-900 mb-2">Cero curva técnica</h3>
              <p class="text-slate-600 text-sm leading-relaxed">
                Interfaz intuitiva. Si sabes usar Excel, sabes usar Flowbit.
              </p>
            </div>
          </div>
        </div>

        <!-- Mini feature row -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
          <div class="flex items-center gap-3 p-5 bg-white rounded-2xl border border-slate-200/80 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/10 transition-all">
            <div class="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div>
              <h4 class="font-semibold text-slate-900 text-sm">Acceso global</h4>
              <p class="text-xs text-slate-500">Cualquier dispositivo, 24/7</p>
            </div>
          </div>

          <div class="flex items-center gap-3 p-5 bg-white rounded-2xl border border-slate-200/80 hover:border-violet-200 hover:shadow-lg hover:shadow-violet-500/10 transition-all">
            <div class="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
            </div>
            <div>
              <h4 class="font-semibold text-slate-900 text-sm">Rendimiento óptimo</h4>
              <p class="text-xs text-slate-500">Nuxt 4 + Supabase</p>
            </div>
          </div>

          <div class="flex items-center gap-3 p-5 bg-white rounded-2xl border border-slate-200/80 hover:border-fuchsia-200 hover:shadow-lg hover:shadow-fuchsia-500/10 transition-all">
            <div class="w-10 h-10 bg-fuchsia-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-fuchsia-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
              </svg>
            </div>
            <div>
              <h4 class="font-semibold text-slate-900 text-sm">Documentación</h4>
              <p class="text-xs text-slate-500">Guías y tutoriales completos</p>
            </div>
          </div>

          <div class="flex items-center gap-3 p-5 bg-white rounded-2xl border border-slate-200/80 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/10 transition-all">
            <div class="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
            </div>
            <div>
              <h4 class="font-semibold text-slate-900 text-sm">Multi-tenant</h4>
              <p class="text-xs text-slate-500">RLS y permisos por empresa</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============================================ -->
    <!-- CTA FINAL -->
    <!-- ============================================ -->
    <section class="relative px-4 sm:px-6 lg:px-8 py-24 bg-white overflow-hidden">
      <div class="relative max-w-6xl mx-auto">
        <div class="relative bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 rounded-[2.5rem] p-12 sm:p-16 overflow-hidden">
          <!-- Dynamic decoration -->
          <div class="absolute top-0 right-0 w-96 h-96 bg-indigo-500/30 rounded-full blur-3xl animate-blob"></div>
          <div class="absolute bottom-0 left-0 w-96 h-96 bg-fuchsia-500/30 rounded-full blur-3xl animate-blob" style="animation-delay: 3s;"></div>
          <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl animate-blob" style="animation-delay: 6s;"></div>

          <!-- Dot grid -->
          <div class="absolute inset-0 opacity-20" style="background-image: radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px); background-size: 24px 24px;"></div>

          <div class="relative text-center">
            <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-8">
              <span class="relative flex h-2 w-2">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span class="text-sm font-medium text-slate-200">Aceptando registros ahora mismo</span>
            </div>

            <h2 class="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 tracking-tight">
              Empieza a fluir
              <span class="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300">en menos de 2 minutos.</span>
            </h2>
            <p class="text-xl text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed">
              Crea tu cuenta, invita a tu equipo y empieza a operar. Sin instalaciones, sin configuraciones interminables.
            </p>

            <div class="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="#" class="group inline-flex items-center justify-center px-8 py-4 bg-white text-slate-900 font-semibold rounded-xl hover:bg-slate-100 transition-all shadow-2xl hover:shadow-white/20 hover:-translate-y-0.5">
                Crear cuenta gratis
                <svg class="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                </svg>
              </a>
              <a href="https://github.com/Caribbean-Digital-Group/flowbit" target="_blank" rel="noopener" class="group inline-flex items-center justify-center px-8 py-4 bg-white/5 backdrop-blur-sm border border-white/20 text-white font-medium rounded-xl hover:bg-white/10 transition-all">
                <svg class="mr-2 w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                Ver en GitHub
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* Marquee infinite */
@keyframes marquee {
  0% { transform: translateX(0); }
  100% { transform: translateX(-33.333%); }
}

.animate-marquee {
  animation: marquee 40s linear infinite;
}

/* Slow spin */
@keyframes spin-slow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-spin-slow {
  animation: spin-slow 30s linear infinite;
}

/* Float soft */
@keyframes float-soft {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-12px); }
}

.animate-float-soft {
  animation: float-soft 4s ease-in-out infinite;
}

/* Float - classic */
@keyframes float {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  25% { transform: translateY(-15px) rotate(5deg); }
  50% { transform: translateY(-8px) rotate(-3deg); }
  75% { transform: translateY(-20px) rotate(3deg); }
}

@keyframes float-delayed {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  25% { transform: translateY(-12px) rotate(-5deg); }
  50% { transform: translateY(-18px) rotate(4deg); }
  75% { transform: translateY(-6px) rotate(-2deg); }
}

.animate-float {
  animation: float 8s ease-in-out infinite;
}

.animate-float-delayed {
  animation: float-delayed 10s ease-in-out infinite;
}

/* Ping slow */
@keyframes ping-slow {
  0% { transform: scale(1); opacity: 0.7; }
  100% { transform: scale(1.4); opacity: 0; }
}

.animate-ping-slow {
  animation: ping-slow 2.5s cubic-bezier(0, 0, 0.2, 1) infinite;
}

/* Dash animation */
@keyframes dash {
  to { stroke-dashoffset: -24; }
}

.animate-dash {
  animation: dash 2s linear infinite;
}

/* Blob */
@keyframes blob {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(20px, -30px) scale(1.05); }
  50% { transform: translate(-20px, 20px) scale(0.95); }
  75% { transform: translate(30px, 10px) scale(1.02); }
}

.animate-blob {
  animation: blob 15s ease-in-out infinite;
}

/* Radial gradient utility */
.bg-gradient-radial {
  background-image: radial-gradient(var(--tw-gradient-stops));
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .animate-marquee,
  .animate-spin-slow,
  .animate-float-soft,
  .animate-float,
  .animate-float-delayed,
  .animate-ping-slow,
  .animate-dash,
  .animate-blob {
    animation: none;
  }
}
</style>
