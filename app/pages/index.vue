<template>
  <div class="space-y-20 -mx-4 sm:-mx-6 lg:-mx-8">
    <!-- Hero Section -->
    <section class="relative bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 overflow-hidden">
      <!-- Background Pattern -->
      <div class="absolute inset-0 opacity-10">
        <div class="absolute inset-0" style="background-image: url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E');"></div>
      </div>
      
      <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div class="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <!-- Left Side - Content -->
          <div class="text-center lg:text-left">
            <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-500/30 text-indigo-100 mb-6">
              <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"/>
              </svg>
              Plataforma SaaS de Gestión Operativa
            </span>
            
            <h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              Gestiona tu operación 
              <span class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 to-purple-200">en un solo lugar</span>
            </h1>
            
            <p class="text-lg sm:text-xl text-indigo-100 mb-8 max-w-xl mx-auto lg:mx-0">
              Planifica, organiza y controla mantenimientos, reparaciones, soportes y trabajos técnicos. 
              Simplifica tu gestión operativa con Flowbit.
            </p>
            
            <div class="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <a href="#funcionalidades" class="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-indigo-700 bg-white hover:bg-indigo-50 transition-colors shadow-lg">
                Conoce más
                <svg class="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                </svg>
              </a>
              <a href="#galeria" class="inline-flex items-center justify-center px-6 py-3 border-2 border-white/30 text-base font-medium rounded-lg text-white hover:bg-white/10 transition-colors">
                Ver galería
              </a>
            </div>
            
            <!-- Trust indicators -->
            <div class="mt-10 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-indigo-200 text-sm">
              <div class="flex items-center gap-2">
                <svg class="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                </svg>
                14 días gratis
              </div>
              <div class="flex items-center gap-2">
                <svg class="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                </svg>
                Sin tarjeta de crédito
              </div>
              <div class="flex items-center gap-2">
                <svg class="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                </svg>
                Soporte 24/7
              </div>
            </div>
          </div>
          
          <!-- Right Side - Login Form -->
          <div class="lg:ml-auto w-full max-w-md mx-auto lg:mx-0">
            <div class="bg-white rounded-2xl shadow-2xl p-8">
              <div class="text-center mb-8">
                <div class="inline-flex items-center justify-center w-12 h-12 bg-indigo-100 rounded-xl mb-4">
                  <svg class="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                </div>
                <h2 class="text-2xl font-bold text-gray-900">Iniciar Sesión</h2>
                <p class="text-gray-500 mt-2">Accede a tu cuenta de Flowbit</p>
              </div>
              
              <form @submit.prevent="handleLogin" class="space-y-5">
                <div>
                  <label for="email" class="block text-sm font-medium text-gray-700 mb-1">
                    Correo electrónico
                  </label>
                  <input
                    id="email"
                    v-model="loginForm.email"
                    type="email"
                    required
                    class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                    placeholder="tu@email.com"
                  />
                </div>
                
                <div>
                  <label for="password" class="block text-sm font-medium text-gray-700 mb-1">
                    Contraseña
                  </label>
                  <div class="relative">
                    <input
                      id="password"
                      v-model="loginForm.password"
                      :type="showPassword ? 'text' : 'password'"
                      required
                      class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors pr-12"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      @click="showPassword = !showPassword"
                      class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <svg v-if="!showPassword" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                      </svg>
                      <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div class="flex items-center justify-between">
                  <label class="flex items-center">
                    <input type="checkbox" v-model="loginForm.remember" class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500">
                    <span class="ml-2 text-sm text-gray-600">Recordarme</span>
                  </label>
                  <a href="#" class="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
                
                <button
                  type="submit"
                  class="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  Iniciar Sesión
                </button>
              </form>
              
              <div class="mt-6 text-center">
                <p class="text-sm text-gray-500">
                  ¿No tienes una cuenta?
                  <a href="#" class="text-indigo-600 hover:text-indigo-700 font-medium">
                    Regístrate gratis
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section id="funcionalidades" class="px-4 sm:px-6 lg:px-8 scroll-mt-20">
      <div class="max-w-7xl mx-auto">
        <!-- Section Header -->
        <div class="text-center mb-16">
          <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-700 mb-4">
            Funcionalidades
          </span>
          <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Todo lo que necesitas para tu operación
          </h2>
          <p class="text-lg text-gray-600 max-w-2xl mx-auto">
            Flowbit integra todas las herramientas necesarias para gestionar tu negocio de manera eficiente y centralizada.
          </p>
        </div>
        
        <!-- Features Grid -->
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <!-- Feature 1 - Organization -->
          <div class="group bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-lg hover:border-indigo-100 transition-all duration-300">
            <div class="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-indigo-600 transition-colors">
              <svg class="w-7 h-7 text-indigo-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-gray-900 mb-3">Gestión de Organización</h3>
            <p class="text-gray-600">
              Administra sucursales, departamentos y equipos de trabajo. Define roles y permisos para cada usuario de tu organización.
            </p>
          </div>
          
          <!-- Feature 2 - Clients -->
          <div class="group bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-lg hover:border-indigo-100 transition-all duration-300">
            <div class="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-emerald-600 transition-colors">
              <svg class="w-7 h-7 text-emerald-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-gray-900 mb-3">Gestión de Clientes</h3>
            <p class="text-gray-600">
              Mantén un registro completo de tus clientes, historial de servicios, contactos y documentación asociada en un solo lugar.
            </p>
          </div>
          
          <!-- Feature 3 - Products -->
          <div class="group bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-lg hover:border-indigo-100 transition-all duration-300">
            <div class="w-14 h-14 bg-amber-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-amber-600 transition-colors">
              <svg class="w-7 h-7 text-amber-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-gray-900 mb-3">Gestión de Productos</h3>
            <p class="text-gray-600">
              Catálogo de productos y servicios con control de inventario, precios, costos y disponibilidad en tiempo real.
            </p>
          </div>
          
          <!-- Feature 4 - Orders -->
          <div class="group bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-lg hover:border-indigo-100 transition-all duration-300">
            <div class="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-600 transition-colors">
              <svg class="w-7 h-7 text-blue-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-gray-900 mb-3">Órdenes de Compra y Venta</h3>
            <p class="text-gray-600">
              Gestiona órdenes de trabajo, cotizaciones, facturas y seguimiento completo del ciclo de venta y compra.
            </p>
          </div>
          
          <!-- Feature 5 - Maintenance -->
          <div class="group bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-lg hover:border-indigo-100 transition-all duration-300">
            <div class="w-14 h-14 bg-rose-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-rose-600 transition-colors">
              <svg class="w-7 h-7 text-rose-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-gray-900 mb-3">Mantenimientos y Reparaciones</h3>
            <p class="text-gray-600">
              Programa y da seguimiento a mantenimientos preventivos y correctivos. Historial completo de cada equipo o activo.
            </p>
          </div>
          
          <!-- Feature 6 - Accounting -->
          <div class="group bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-lg hover:border-indigo-100 transition-all duration-300">
            <div class="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-purple-600 transition-colors">
              <svg class="w-7 h-7 text-purple-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-gray-900 mb-3">Contabilidad</h3>
            <p class="text-gray-600">
              Control financiero con reportes de ingresos, egresos, cuentas por cobrar/pagar y estados financieros básicos.
            </p>
          </div>
        </div>
        
        <!-- Additional Features Row -->
        <div class="mt-8 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div class="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
            <div class="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </div>
            <div>
              <h4 class="font-medium text-gray-900">Agenda y Calendario</h4>
              <p class="text-sm text-gray-500">Planifica tareas y citas</p>
            </div>
          </div>
          
          <div class="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
            <div class="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
            </div>
            <div>
              <h4 class="font-medium text-gray-900">Reportes y Análisis</h4>
              <p class="text-sm text-gray-500">Métricas en tiempo real</p>
            </div>
          </div>
          
          <div class="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
            <div class="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
              </svg>
            </div>
            <div>
              <h4 class="font-medium text-gray-900">Notificaciones</h4>
              <p class="text-sm text-gray-500">Alertas personalizadas</p>
            </div>
          </div>
          
          <div class="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
            <div class="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
              </svg>
            </div>
            <div>
              <h4 class="font-medium text-gray-900">App Móvil</h4>
              <p class="text-sm text-gray-500">Accede desde cualquier lugar</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Gallery Section -->
    <section id="galeria" class="bg-gray-900 px-4 sm:px-6 lg:px-8 py-20 scroll-mt-20">
      <div class="max-w-7xl mx-auto">
        <!-- Section Header -->
        <div class="text-center mb-16">
          <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-500/20 text-indigo-300 mb-4">
            Galería
          </span>
          <h2 class="text-3xl sm:text-4xl font-bold text-white mb-4">
            Conoce la plataforma
          </h2>
          <p class="text-lg text-gray-400 max-w-2xl mx-auto">
            Explora las diferentes pantallas y funcionalidades de Flowbit. Interfaz intuitiva y moderna para una mejor experiencia.
          </p>
        </div>
        
        <!-- Gallery Grid -->
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <!-- Image 1 - Dashboard -->
          <div class="group relative overflow-hidden rounded-2xl bg-gray-800 aspect-video cursor-pointer">
            <img 
              src="https://placehold.co/600x400/1e1b4b/818cf8?text=Dashboard" 
              alt="Dashboard principal" 
              class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div class="absolute bottom-0 left-0 right-0 p-6">
                <h3 class="text-lg font-semibold text-white">Dashboard Principal</h3>
                <p class="text-sm text-gray-300">Vista general de métricas y KPIs</p>
              </div>
            </div>
          </div>
          
          <!-- Image 2 - Clients -->
          <div class="group relative overflow-hidden rounded-2xl bg-gray-800 aspect-video cursor-pointer">
            <img 
              src="https://placehold.co/600x400/1e1b4b/34d399?text=Clientes" 
              alt="Gestión de clientes" 
              class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div class="absolute bottom-0 left-0 right-0 p-6">
                <h3 class="text-lg font-semibold text-white">Gestión de Clientes</h3>
                <p class="text-sm text-gray-300">Administra tu cartera de clientes</p>
              </div>
            </div>
          </div>
          
          <!-- Image 3 - Orders -->
          <div class="group relative overflow-hidden rounded-2xl bg-gray-800 aspect-video cursor-pointer">
            <img 
              src="https://placehold.co/600x400/1e1b4b/f59e0b?text=Ordenes" 
              alt="Órdenes de trabajo" 
              class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div class="absolute bottom-0 left-0 right-0 p-6">
                <h3 class="text-lg font-semibold text-white">Órdenes de Trabajo</h3>
                <p class="text-sm text-gray-300">Seguimiento completo de órdenes</p>
              </div>
            </div>
          </div>
          
          <!-- Image 4 - Inventory -->
          <div class="group relative overflow-hidden rounded-2xl bg-gray-800 aspect-video cursor-pointer">
            <img 
              src="https://placehold.co/600x400/1e1b4b/ec4899?text=Inventario" 
              alt="Control de inventario" 
              class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div class="absolute bottom-0 left-0 right-0 p-6">
                <h3 class="text-lg font-semibold text-white">Control de Inventario</h3>
                <p class="text-sm text-gray-300">Gestión de productos y stock</p>
              </div>
            </div>
          </div>
          
          <!-- Image 5 - Calendar -->
          <div class="group relative overflow-hidden rounded-2xl bg-gray-800 aspect-video cursor-pointer">
            <img 
              src="https://placehold.co/600x400/1e1b4b/06b6d4?text=Calendario" 
              alt="Calendario de mantenimientos" 
              class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div class="absolute bottom-0 left-0 right-0 p-6">
                <h3 class="text-lg font-semibold text-white">Calendario</h3>
                <p class="text-sm text-gray-300">Programa mantenimientos y citas</p>
              </div>
            </div>
          </div>
          
          <!-- Image 6 - Reports -->
          <div class="group relative overflow-hidden rounded-2xl bg-gray-800 aspect-video cursor-pointer">
            <img 
              src="https://placehold.co/600x400/1e1b4b/a855f7?text=Reportes" 
              alt="Reportes y análisis" 
              class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div class="absolute bottom-0 left-0 right-0 p-6">
                <h3 class="text-lg font-semibold text-white">Reportes y Análisis</h3>
                <p class="text-sm text-gray-300">Visualiza datos y tendencias</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="px-4 sm:px-6 lg:px-8 pb-20">
      <div class="max-w-4xl mx-auto">
        <div class="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden">
          <!-- Background decoration -->
          <div class="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
          <div class="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
          
          <div class="relative">
            <h2 class="text-3xl sm:text-4xl font-bold text-white mb-4">
              ¿Listo para optimizar tu operación?
            </h2>
            <p class="text-lg text-indigo-100 mb-8 max-w-2xl mx-auto">
              Únete a cientos de empresas que ya confían en Flowbit para gestionar sus operaciones técnicas y de mantenimiento.
            </p>
            <div class="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="#" class="inline-flex items-center justify-center px-8 py-4 bg-white text-indigo-600 font-semibold rounded-xl hover:bg-indigo-50 transition-colors shadow-lg">
                Comenzar prueba gratuita
                <svg class="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                </svg>
              </a>
              <a href="#" class="inline-flex items-center justify-center px-8 py-4 border-2 border-white/30 text-white font-semibold rounded-xl hover:bg-white/10 transition-colors">
                Solicitar demo
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'

// Login form state
const loginForm = reactive({
  email: '',
  password: '',
  remember: false
})

const showPassword = ref(false)

// Handle login
const handleLogin = () => {
  console.log('Login attempt:', loginForm)
  // TODO: Implement actual login logic with Supabase
}
</script>
