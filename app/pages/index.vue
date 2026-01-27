<template>
  <div class="space-y-0 -mx-4 sm:-mx-6 lg:-mx-8">
    <!-- Hero Section -->
    <section class="relative bg-gradient-to-br from-white via-indigo-50/50 to-violet-50/50 overflow-hidden">
      <!-- Background Pattern -->
      <div class="absolute inset-0 opacity-40">
        <div class="absolute inset-0" style="background-image: url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%236366f1\' fill-opacity=\'0.15\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E');"></div>
      </div>
      <!-- Gradient orbs -->
      <div class="absolute top-0 left-1/4 w-96 h-96 bg-indigo-200/50 rounded-full blur-3xl"></div>
      <div class="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-200/50 rounded-full blur-3xl"></div>
      
      <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
        <div class="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <!-- Left Side - Content -->
          <div class="text-center lg:text-left">
            <span class="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium bg-indigo-100 text-indigo-700 border border-indigo-200 mb-6">
              <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"/>
              </svg>
              Plataforma SaaS de Gestión Operativa
            </span>
            
            <h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight mb-6">
              Gestiona tu operación 
              <span class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">en un solo lugar</span>
            </h1>
            
            <p class="text-lg sm:text-xl text-slate-600 mb-8 max-w-xl mx-auto lg:mx-0">
              Planifica, organiza y controla mantenimientos, reparaciones, soportes y trabajos técnicos. 
              Simplifica tu gestión operativa con Flowbit.
            </p>
            
            <div class="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <a href="#funcionalidades" class="inline-flex items-center justify-center px-6 py-3.5 border border-transparent text-base font-semibold rounded-xl text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40">
                Conoce más
                <svg class="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                </svg>
              </a>
              <a href="#ventajas" class="inline-flex items-center justify-center px-6 py-3.5 border border-slate-300 text-base font-medium rounded-xl text-slate-700 hover:bg-slate-100 hover:border-slate-400 transition-all">
                Ver ventajas
              </a>
            </div>
            
            <!-- Trust indicators -->
            <div class="mt-10 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-slate-600 text-sm">
              <div class="flex items-center gap-2">
                <svg class="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                </svg>
                Gratis para siempre
              </div>
              <div class="flex items-center gap-2">
                <svg class="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                </svg>
                Sin limite de usuarios
              </div>
              <div class="flex items-center gap-2">
                <svg class="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                </svg>
                Soporte 24/7
              </div>
            </div>
          </div>
          
          <!-- Right Side - Login Form -->
          <div class="lg:ml-auto w-full max-w-md mx-auto lg:mx-0">
            <div class="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-8 border border-slate-200">
              <div class="text-center mb-8">
                <div class="inline-flex items-center justify-center w-12 h-12 bg-indigo-100 rounded-xl mb-4">
                  <svg class="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                </div>
                <h2 class="text-2xl font-bold text-slate-900">Iniciar Sesión</h2>
                <p class="text-slate-500 mt-2">Accede a tu cuenta de Flowbit</p>
              </div>
              
              <form @submit.prevent="handleLogin" class="space-y-5">
                <div>
                  <label for="email" class="block text-sm font-medium text-slate-700 mb-1.5">
                    Correo electrónico
                  </label>
                  <input
                    id="email"
                    v-model="loginForm.email"
                    type="email"
                    required
                    class="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    placeholder="tu@email.com"
                  />
                </div>
                
                <div>
                  <label for="password" class="block text-sm font-medium text-slate-700 mb-1.5">
                    Contraseña
                  </label>
                  <div class="relative">
                    <input
                      id="password"
                      v-model="loginForm.password"
                      :type="showPassword ? 'text' : 'password'"
                      required
                      class="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all pr-12"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      @click="showPassword = !showPassword"
                      class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
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
                    <input type="checkbox" v-model="loginForm.remember" class="w-4 h-4 text-indigo-600 bg-white border-slate-300 rounded focus:ring-indigo-500">
                    <span class="ml-2 text-sm text-slate-600">Recordarme</span>
                  </label>
                  <a href="#" class="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors">
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
                
                <button
                  type="submit"
                  class="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40"
                >
                  Iniciar Sesión
                </button>
              </form>
              
              <div class="mt-6 text-center">
                <p class="text-sm text-slate-500">
                  ¿No tienes una cuenta?
                  <span class="text-indigo-600 hover:text-indigo-700 font-medium cursor-pointer transition-colors">
                    Regístrate gratis
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section id="funcionalidades" class="px-4 sm:px-6 lg:px-8 py-24 bg-slate-50 scroll-mt-20">
      <div class="max-w-7xl mx-auto">
        <!-- Section Header -->
        <div class="text-center mb-16">
          <span class="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold bg-indigo-100 text-indigo-700 mb-4">
            Funcionalidades
          </span>
          <h2 class="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Todo lo que necesitas para tu operación
          </h2>
          <p class="text-lg text-slate-600 max-w-2xl mx-auto">
            Flowbit integra todas las herramientas necesarias para gestionar tu negocio de manera eficiente y centralizada.
          </p>
        </div>
        
        <!-- Features Grid -->
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <!-- Feature 1 - Organization -->
          <div class="group bg-white rounded-2xl p-8 shadow-sm border border-slate-200/60 hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-200 transition-all duration-300">
            <div class="w-14 h-14 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/30 group-hover:scale-110 transition-transform duration-300">
              <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-slate-900 mb-3">Gestión de Organización</h3>
            <p class="text-slate-600">
              Administra sucursales, departamentos y equipos de trabajo. Define roles y permisos para cada usuario de tu organización.
            </p>
          </div>
          
          <!-- Feature 2 - Clients -->
          <div class="group bg-white rounded-2xl p-8 shadow-sm border border-slate-200/60 hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-200 transition-all duration-300">
            <div class="w-14 h-14 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-violet-500/30 group-hover:scale-110 transition-transform duration-300">
              <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-slate-900 mb-3">Gestión de Clientes</h3>
            <p class="text-slate-600">
              Mantén un registro completo de tus clientes, historial de servicios, contactos y documentación asociada en un solo lugar.
            </p>
          </div>
          
          <!-- Feature 3 - Products -->
          <div class="group bg-white rounded-2xl p-8 shadow-sm border border-slate-200/60 hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-200 transition-all duration-300">
            <div class="w-14 h-14 bg-gradient-to-br from-indigo-400 to-indigo-500 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-indigo-400/30 group-hover:scale-110 transition-transform duration-300">
              <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-slate-900 mb-3">Gestión de Productos</h3>
            <p class="text-slate-600">
              Catálogo de productos y servicios con control de inventario, precios, costos y disponibilidad en tiempo real.
            </p>
          </div>
          
          <!-- Feature 4 - Orders -->
          <div class="group bg-white rounded-2xl p-8 shadow-sm border border-slate-200/60 hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-200 transition-all duration-300">
            <div class="w-14 h-14 bg-gradient-to-br from-violet-400 to-violet-500 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-violet-400/30 group-hover:scale-110 transition-transform duration-300">
              <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-slate-900 mb-3">Órdenes de Compra y Venta</h3>
            <p class="text-slate-600">
              Gestiona órdenes de trabajo, cotizaciones, facturas y seguimiento completo del ciclo de venta y compra.
            </p>
          </div>
          
          <!-- Feature 5 - Maintenance -->
          <div class="group bg-white rounded-2xl p-8 shadow-sm border border-slate-200/60 hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-200 transition-all duration-300">
            <div class="w-14 h-14 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/30 group-hover:scale-110 transition-transform duration-300">
              <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-slate-900 mb-3">Mantenimientos y Reparaciones</h3>
            <p class="text-slate-600">
              Programa y da seguimiento a mantenimientos preventivos y correctivos. Historial completo de cada equipo o activo.
            </p>
          </div>
          
          <!-- Feature 6 - Accounting -->
          <div class="group bg-white rounded-2xl p-8 shadow-sm border border-slate-200/60 hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-200 transition-all duration-300">
            <div class="w-14 h-14 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-violet-500/30 group-hover:scale-110 transition-transform duration-300">
              <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-slate-900 mb-3">Contabilidad</h3>
            <p class="text-slate-600">
              Control financiero con reportes de ingresos, egresos, cuentas por cobrar/pagar y estados financieros básicos.
            </p>
          </div>
        </div>
        
        <!-- Additional Features Row -->
        <div class="mt-10 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="flex items-center gap-4 p-5 bg-white rounded-xl border border-slate-200/60 hover:border-indigo-200 hover:shadow-md transition-all">
            <div class="w-11 h-11 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </div>
            <div>
              <h4 class="font-semibold text-slate-900">Agenda y Calendario</h4>
              <p class="text-sm text-slate-500">Planifica tareas y citas</p>
            </div>
          </div>
          
          <div class="flex items-center gap-4 p-5 bg-white rounded-xl border border-slate-200/60 hover:border-indigo-200 hover:shadow-md transition-all">
            <div class="w-11 h-11 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
            </div>
            <div>
              <h4 class="font-semibold text-slate-900">Reportes y Análisis</h4>
              <p class="text-sm text-slate-500">Métricas en tiempo real</p>
            </div>
          </div>
          
          <div class="flex items-center gap-4 p-5 bg-white rounded-xl border border-slate-200/60 hover:border-indigo-200 hover:shadow-md transition-all">
            <div class="w-11 h-11 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
              </svg>
            </div>
            <div>
              <h4 class="font-semibold text-slate-900">Notificaciones</h4>
              <p class="text-sm text-slate-500">Alertas personalizadas</p>
            </div>
          </div>
          
          <div class="flex items-center gap-4 p-5 bg-white rounded-xl border border-slate-200/60 hover:border-indigo-200 hover:shadow-md transition-all">
            <div class="w-11 h-11 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
              </svg>
            </div>
            <div>
              <h4 class="font-semibold text-slate-900">App Móvil</h4>
              <p class="text-sm text-slate-500">Accede desde cualquier lugar</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Unique Advantages Section -->
    <section id="ventajas" class="relative bg-white px-4 sm:px-6 lg:px-8 py-24 scroll-mt-20 overflow-hidden">
      <!-- Decorative Background Shapes -->
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <!-- Large gradient blob top right -->
        <div class="absolute -top-32 -right-32 w-[500px] h-[500px] bg-gradient-to-br from-indigo-100/60 via-violet-100/40 to-indigo-50/60 rounded-full blur-3xl animate-blob"></div>
        <!-- Large gradient blob bottom left -->
        <div class="absolute -bottom-32 -left-32 w-[400px] h-[400px] bg-gradient-to-tr from-violet-100/60 via-indigo-100/40 to-violet-50/60 rounded-full blur-3xl animate-blob" style="animation-delay: 2s;"></div>
        
        <!-- Geometric shapes - all in brand colors -->
        <svg class="absolute top-20 left-10 w-20 h-20 text-indigo-200 animate-float opacity-60" viewBox="0 0 100 100">
          <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" fill="currentColor"/>
        </svg>
        <svg class="absolute top-40 right-20 w-16 h-16 text-violet-200 animate-float-delayed opacity-50" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="currentColor"/>
        </svg>
        <svg class="absolute bottom-32 left-1/4 w-12 h-12 text-indigo-200 animate-float opacity-70" viewBox="0 0 100 100">
          <rect x="10" y="10" width="80" height="80" rx="15" fill="currentColor" transform="rotate(15 50 50)"/>
        </svg>
        <svg class="absolute top-1/3 right-1/4 w-14 h-14 text-violet-200 animate-float-delayed opacity-60" viewBox="0 0 100 100">
          <polygon points="50,10 90,90 10,90" fill="currentColor"/>
        </svg>
      </div>

      <div class="max-w-7xl mx-auto relative">
        <!-- Section Header -->
        <div class="text-center mb-20">
          <span class="inline-flex items-center px-5 py-2.5 rounded-full text-sm font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 text-white mb-6 shadow-lg shadow-indigo-500/25">
            <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
            </svg>
            Ventajas Únicas
          </span>
          <h2 class="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 mb-6">
            ¿Por qué elegir 
            <span class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Flowbit</span>?
          </h2>
          <p class="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Una plataforma diseñada para democratizar la gestión operativa. 
            Sin barreras, sin costos ocultos, sin límites.
          </p>
        </div>
        
        <!-- Main Advantages - Bento Grid Layout -->
        <div class="grid lg:grid-cols-3 gap-6 mb-12">
          <!-- Card 1 - Gratis de por vida (Large) -->
          <div class="lg:col-span-2 group relative">
            <div class="absolute inset-0 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>
            <div class="relative h-full bg-gradient-to-br from-indigo-50 to-violet-50 rounded-3xl p-8 border border-indigo-100 hover:border-indigo-300 transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/20 hover:-translate-y-1 overflow-hidden">
              <!-- Decorative corner shape -->
              <div class="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-indigo-200/50 to-violet-200/50 rounded-full"></div>
              <div class="absolute -bottom-8 -left-8 w-32 h-32 bg-gradient-to-tr from-indigo-100/80 to-violet-100/80 rounded-full"></div>
              
              <div class="relative flex flex-col sm:flex-row items-start gap-6">
                <div class="flex-shrink-0">
                  <div class="w-20 h-20 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/30 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                    <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  </div>
                </div>
                <div class="flex-1">
                  <div class="flex flex-wrap items-center gap-3 mb-4">
                    <h3 class="text-2xl sm:text-3xl font-bold text-slate-900">Gratis de por vida</h3>
                    <span class="px-4 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-bold rounded-full shadow-lg">$0 SIEMPRE</span>
                  </div>
                  <p class="text-slate-600 text-lg leading-relaxed">
                    Sin costos ocultos, sin planes premium obligatorios. Accede a todas las funcionalidades sin pagar absolutamente nada. Nunca tendrás que sacar tu tarjeta de crédito. La gestión operativa profesional ahora es accesible para todos.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Card 2 - Open Source -->
          <div class="group relative">
            <div class="absolute inset-0 bg-gradient-to-r from-violet-500 to-indigo-500 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>
            <div class="relative h-full bg-gradient-to-br from-violet-50 to-indigo-50 rounded-3xl p-8 border border-violet-100 hover:border-violet-300 transition-all duration-500 hover:shadow-2xl hover:shadow-violet-500/20 hover:-translate-y-1 overflow-hidden">
              <div class="absolute -top-6 -right-6 w-24 h-24 bg-gradient-to-br from-violet-200/60 to-indigo-200/60 rounded-full"></div>
              
              <div class="relative">
                <div class="w-16 h-16 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-violet-500/30 mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                  <svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                </div>
                <div class="flex items-center gap-2 mb-3">
                  <h3 class="text-2xl font-bold text-slate-900">Open Source</h3>
                  <span class="px-3 py-1 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold rounded-full">MIT</span>
                </div>
                <p class="text-slate-600 leading-relaxed">
                  Código 100% abierto y transparente. Audita, modifica y contribuye al proyecto.
                </p>
              </div>
            </div>
          </div>
          
          <!-- Card 3 - Sin límite de usuarios -->
          <div class="group relative">
            <div class="absolute inset-0 bg-gradient-to-r from-indigo-400 to-violet-500 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>
            <div class="relative h-full bg-gradient-to-br from-indigo-50 to-slate-50 rounded-3xl p-8 border border-indigo-100 hover:border-indigo-300 transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/20 hover:-translate-y-1 overflow-hidden">
              <div class="absolute -bottom-6 -right-6 w-28 h-28 bg-gradient-to-tl from-indigo-200/60 to-violet-200/60 rounded-full"></div>
              
              <div class="relative">
                <div class="w-16 h-16 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/30 mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                  <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                  </svg>
                </div>
                <div class="flex items-center gap-2 mb-3">
                  <h3 class="text-2xl font-bold text-slate-900">Sin límites</h3>
                  <span class="px-3 py-1 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-bold rounded-full">ILIMITADO</span>
                </div>
                <p class="text-slate-600 leading-relaxed">
                  Invita a todo tu equipo sin restricciones. 5 o 500 usuarios, todos acceden igual.
                </p>
              </div>
            </div>
          </div>
          
          <!-- Card 4 - Sin conocimiento técnico (Large) -->
          <div class="lg:col-span-2 group relative">
            <div class="absolute inset-0 bg-gradient-to-r from-violet-500 to-indigo-600 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>
            <div class="relative h-full bg-gradient-to-br from-slate-50 to-indigo-50 rounded-3xl p-8 border border-slate-200 hover:border-indigo-300 transition-all duration-500 hover:shadow-2xl hover:shadow-violet-500/20 hover:-translate-y-1 overflow-hidden">
              <div class="absolute -top-10 -left-10 w-40 h-40 bg-gradient-to-br from-violet-200/50 to-indigo-200/50 rounded-full"></div>
              <div class="absolute -bottom-8 -right-8 w-32 h-32 bg-gradient-to-tr from-indigo-100/80 to-violet-100/80 rounded-full"></div>
              
              <div class="relative flex flex-col sm:flex-row items-start gap-6">
                <div class="flex-shrink-0">
                  <div class="w-20 h-20 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-violet-500/30 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                    <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                    </svg>
                  </div>
                </div>
                <div class="flex-1">
                  <div class="flex flex-wrap items-center gap-3 mb-4">
                    <h3 class="text-2xl sm:text-3xl font-bold text-slate-900">Sin conocimiento técnico</h3>
                    <span class="px-4 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-bold rounded-full shadow-lg">SUPER FÁCIL</span>
                  </div>
                  <p class="text-slate-600 text-lg leading-relaxed">
                    Interfaz intuitiva diseñada para cualquier usuario. No necesitas ser experto en tecnología para aprovechar al máximo todas las funcionalidades. Empieza a usar Flowbit en minutos, no en semanas.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Additional Features - Compact Cards -->
        <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <!-- Feature 1 -->
          <div class="group bg-white rounded-2xl p-6 border border-slate-200/80 hover:border-indigo-200 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1">
            <div class="w-14 h-14 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
              <svg class="w-7 h-7 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <h4 class="text-lg font-bold text-slate-900 mb-2">Acceso global</h4>
            <p class="text-slate-500 text-sm leading-relaxed">Trabaja desde cualquier lugar y dispositivo, 24/7.</p>
          </div>
          
          <!-- Feature 2 -->
          <div class="group bg-white rounded-2xl p-6 border border-slate-200/80 hover:border-violet-200 transition-all duration-300 hover:shadow-xl hover:shadow-violet-500/10 hover:-translate-y-1">
            <div class="w-14 h-14 bg-gradient-to-br from-violet-100 to-indigo-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
              <svg class="w-7 h-7 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
            </div>
            <h4 class="text-lg font-bold text-slate-900 mb-2">Rendimiento óptimo</h4>
            <p class="text-slate-500 text-sm leading-relaxed">Plataforma rápida y optimizada al máximo.</p>
          </div>
          
          <!-- Feature 3 -->
          <div class="group bg-white rounded-2xl p-6 border border-slate-200/80 hover:border-indigo-200 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1">
            <div class="w-14 h-14 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
              <svg class="w-7 h-7 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
            </div>
            <h4 class="text-lg font-bold text-slate-900 mb-2">Privacidad primero</h4>
            <p class="text-slate-500 text-sm leading-relaxed">Tus datos son tuyos. No vendemos información.</p>
          </div>
          
          <!-- Feature 4 -->
          <div class="group bg-white rounded-2xl p-6 border border-slate-200/80 hover:border-violet-200 transition-all duration-300 hover:shadow-xl hover:shadow-violet-500/10 hover:-translate-y-1">
            <div class="w-14 h-14 bg-gradient-to-br from-violet-100 to-indigo-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
              <svg class="w-7 h-7 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
              </svg>
            </div>
            <h4 class="text-lg font-bold text-slate-900 mb-2">Documentación completa</h4>
            <p class="text-slate-500 text-sm leading-relaxed">Guías y tutoriales para dominar la plataforma.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="px-4 sm:px-6 lg:px-8 py-24 bg-slate-50">
      <div class="max-w-4xl mx-auto">
        <div class="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden">
          <!-- Background decoration -->
          <div class="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl"></div>
          <div class="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-violet-500/20 rounded-full blur-3xl"></div>
          
          <div class="relative">
            <h2 class="text-3xl sm:text-4xl font-bold text-white mb-4">
              ¿Listo para optimizar tu operación?
            </h2>
            <p class="text-lg text-slate-300 mb-8 max-w-2xl mx-auto">
              Únete a cientos de empresas que ya confían en Flowbit para gestionar sus operaciones técnicas y de mantenimiento.
            </p>
            <div class="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="#" class="inline-flex items-center justify-center px-8 py-4 bg-white text-slate-900 font-semibold rounded-xl hover:bg-slate-100 transition-all shadow-lg shadow-white/10 hover:shadow-white/20">
                Regístrate gratis
                <svg class="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                </svg>
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

<style scoped>
/* Floating animation for geometric shapes */
@keyframes float {
  0%, 100% {
    transform: translateY(0px) rotate(0deg);
  }
  25% {
    transform: translateY(-15px) rotate(5deg);
  }
  50% {
    transform: translateY(-8px) rotate(-3deg);
  }
  75% {
    transform: translateY(-20px) rotate(3deg);
  }
}

@keyframes float-delayed {
  0%, 100% {
    transform: translateY(0px) rotate(0deg);
  }
  25% {
    transform: translateY(-12px) rotate(-5deg);
  }
  50% {
    transform: translateY(-18px) rotate(4deg);
  }
  75% {
    transform: translateY(-6px) rotate(-2deg);
  }
}

/* Blob animation for background shapes */
@keyframes blob {
  0%, 100% {
    transform: translate(0, 0) scale(1);
  }
  25% {
    transform: translate(20px, -30px) scale(1.05);
  }
  50% {
    transform: translate(-20px, 20px) scale(0.95);
  }
  75% {
    transform: translate(30px, 10px) scale(1.02);
  }
}

@keyframes gradient {
  0%, 100% {
    background-size: 200% 200%;
    background-position: left center;
  }
  50% {
    background-size: 200% 200%;
    background-position: right center;
  }
}

.animate-float {
  animation: float 8s ease-in-out infinite;
}

.animate-float-delayed {
  animation: float-delayed 10s ease-in-out infinite;
}

.animate-blob {
  animation: blob 15s ease-in-out infinite;
}

.animate-gradient {
  background-size: 200% 200%;
  animation: gradient 4s ease infinite;
}
</style>
