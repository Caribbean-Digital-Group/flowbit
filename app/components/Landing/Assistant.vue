<script setup lang="ts">
interface SectionInfo {
  id: string
  emoji: string
  teaserTitle: string
  teaser: string
  title: string
  message: string
  highlight: string
  funFact?: string
  ctaLabel: string
  accentFrom: string
  accentTo: string
}

const SECTIONS: Record<string, SectionInfo> = {
  hero: {
    id: 'hero',
    emoji: '👋',
    teaserTitle: '¡Hola! Soy Bit',
    teaser: '¿Tu primera vez aquí? Te cuento todo sobre Flowbit.',
    title: 'Hola, soy Bit — tu guía en Flowbit',
    message: 'Flowbit es un ERP completo, gratuito y open source. Gestiona clientes, proyectos, órdenes e inventario desde un solo lugar, sin instalar nada y sin pagar un peso.',
    highlight: 'Sin tarjeta de crédito. Sin límites de usuarios. Sin trampa.',
    funFact: 'Puedes estar operando tu empresa en menos de 2 minutos desde que creas tu cuenta.',
    ctaLabel: 'Crear mi cuenta gratis →',
    accentFrom: 'from-indigo-500',
    accentTo: 'to-violet-600',
  },
  ecosistema: {
    id: 'ecosistema',
    emoji: '⚡',
    teaserTitle: '¡Todo conectado!',
    teaser: 'Cada módulo habla con los demás automáticamente.',
    title: 'El ecosistema que trabaja por ti',
    message: 'Cuando confirmas una orden en Flowbit, el almacén se actualiza solo. Cuando terminas un proyecto, el cliente ya tiene su historial. Los módulos se coordinan entre sí sin que tengas que duplicar datos.',
    highlight: '8+ módulos integrados trabajando en tiempo real.',
    funFact: 'Las empresas con sistemas integrados reducen el tiempo de operación hasta un 60% comparado con hojas de cálculo.',
    ctaLabel: 'Probar todos los módulos gratis →',
    accentFrom: 'from-violet-500',
    accentTo: 'to-fuchsia-600',
  },
  workflow: {
    id: 'workflow',
    emoji: '🔄',
    teaserTitle: '4 pasos, cero fricciones',
    teaser: 'Del cliente a la entrega en un solo flujo.',
    title: 'El flujo completo de tu negocio',
    message: 'Registra al cliente, crea el proyecto o la orden, y el almacén se sincroniza para el picking. Todo sin salir de la plataforma y sin repetir datos. Así de simple.',
    highlight: 'Cliente → Proyecto → Orden → Picking. Un flujo, cero duplicados.',
    funFact: 'Cada paso del workflow genera automáticamente el documento siguiente. No hay capturas manuales.',
    ctaLabel: 'Empezar mi flujo de negocio →',
    accentFrom: 'from-fuchsia-500',
    accentTo: 'to-pink-600',
  },
  ventajas: {
    id: 'ventajas',
    emoji: '✨',
    teaserTitle: '$0 para siempre',
    teaser: 'Sin letra chica, sin trucos, sin trampa.',
    title: '¿Por qué Flowbit y no otro ERP?',
    message: 'Los ERP tradicionales cobran miles al mes y te encierran en su plataforma. Flowbit es gratis para siempre, código abierto con licencia MIT y tus datos solo te pertenecen a ti.',
    highlight: 'Sin freemium. Sin trial de 14 días. Sin "plan básico". Todo gratis siempre.',
    funFact: 'Licencia MIT significa que puedes auditar, modificar y adaptar el código a tus necesidades sin restricciones.',
    ctaLabel: 'Cambiarme a Flowbit gratis →',
    accentFrom: 'from-indigo-500',
    accentTo: 'to-fuchsia-600',
  },
  'cta-final': {
    id: 'cta-final',
    emoji: '🎉',
    teaserTitle: '¡Tu empresa te espera!',
    teaser: '2 minutos para empezar a operar. Sin instalaciones.',
    title: '¡Tu empresa puede estar corriendo hoy!',
    message: 'Crea tu cuenta ahora, configura tu empresa, invita a tu equipo y empieza a registrar clientes, órdenes y proyectos. Sin instalaciones, sin servidores, sin configuraciones interminables.',
    highlight: '2 minutos para estar operando. Lo garantizamos.',
    ctaLabel: '¡Crear mi cuenta ahora, es gratis! 🚀',
    accentFrom: 'from-indigo-500',
    accentTo: 'to-fuchsia-600',
  },
}

const SECTION_ORDER = ['hero', 'ecosistema', 'workflow', 'ventajas', 'cta-final']

// Canal compartido con FormLogin
const externalViewRequest = useState<'login' | 'register' | 'forgot-password' | null>('landing-form-view', () => null)

function openRegisterForm() {
  externalViewRequest.value = 'register'
  document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth' })
  isOpen.value = false
  showTeaser.value = false
}

const isOpen = ref(false)
const currentSectionId = ref('hero')
const showTeaser = ref(false)
const isMascotBouncing = ref(false)
const hasInteracted = ref(false)

const currentSection = computed(() => (SECTIONS[currentSectionId.value] ?? SECTIONS['hero']) as SectionInfo)
const currentSectionIndex = computed(() => SECTION_ORDER.indexOf(currentSectionId.value))

let teaserTimer: ReturnType<typeof setTimeout> | null = null
let observers: IntersectionObserver[] = []

function triggerTeaser() {
  if (isOpen.value) return
  isMascotBouncing.value = true
  setTimeout(() => { isMascotBouncing.value = false }, 800)
  showTeaser.value = true
  if (teaserTimer) clearTimeout(teaserTimer)
  teaserTimer = setTimeout(() => { showTeaser.value = false }, 6000)
}

function toggle() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    showTeaser.value = false
    hasInteracted.value = true
    if (teaserTimer) clearTimeout(teaserTimer)
  }
}

function dismiss() {
  isOpen.value = false
}

function dismissTeaser() {
  showTeaser.value = false
  if (teaserTimer) clearTimeout(teaserTimer)
}

function scrollToSection(id: string) {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth' })
}

onMounted(() => {
  // Show first teaser after 3.5s
  setTimeout(() => {
    if (!hasInteracted.value) triggerTeaser()
  }, 3500)

  for (const id of SECTION_ORDER) {
    const el = document.getElementById(id)
    if (!el) continue

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.25) {
            if (currentSectionId.value !== id) {
              currentSectionId.value = id
              if (!isOpen.value) triggerTeaser()
            }
          }
        }
      },
      { threshold: 0.25 }
    )
    obs.observe(el)
    observers.push(obs)
  }
})

onUnmounted(() => {
  observers.forEach(o => o.disconnect())
  if (teaserTimer) clearTimeout(teaserTimer)
})
</script>

<template>
  <div class="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
    <!-- Panel expandido -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 scale-95 translate-y-3"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-95 translate-y-3"
    >
      <div
        v-if="isOpen"
        class="w-[340px] max-h-[calc(100vh-8rem)] flex flex-col rounded-3xl overflow-hidden shadow-2xl shadow-violet-500/30 border border-white/20"
        style="backdrop-filter: blur(20px);"
      >
        <!-- Header con gradiente dinámico -->
        <div :class="['relative flex-shrink-0 bg-gradient-to-br p-5 overflow-hidden', currentSection.accentFrom, currentSection.accentTo]">
          <!-- Decoración de fondo -->
          <div class="absolute inset-0 opacity-20" style="background-image: radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px); background-size: 20px 20px;" />
          <div class="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />

          <div class="relative flex items-start justify-between gap-3">
            <div class="flex items-center gap-3">
              <!-- Mascota header mini -->
              <div class="flex-shrink-0 w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm ring-1 ring-white/30">
                <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-9 h-9">
                  <line x1="20" y1="3" x2="20" y2="8" stroke="white" stroke-width="1.8" stroke-linecap="round" />
                  <circle cx="20" cy="2.5" r="2" fill="white" />
                  <rect x="7" y="8" width="26" height="18" rx="6" fill="rgba(255,255,255,0.9)" />
                  <circle cx="14.5" cy="16" r="4" fill="white" />
                  <circle cx="25.5" cy="16" r="4" fill="white" />
                  <circle cx="14.5" cy="16" r="2.5" fill="#4f46e5" />
                  <circle cx="25.5" cy="16" r="2.5" fill="#4f46e5" />
                  <circle cx="15.2" cy="15" r="1" fill="white" />
                  <circle cx="26.2" cy="15" r="1" fill="white" />
                  <path d="M14.5 22.5 Q20 26 25.5 22.5" stroke="#4f46e5" stroke-width="1.8" fill="none" stroke-linecap="round" />
                  <rect x="4" y="13" width="3" height="6" rx="1.5" fill="rgba(255,255,255,0.6)" />
                  <rect x="33" y="13" width="3" height="6" rx="1.5" fill="rgba(255,255,255,0.6)" />
                  <rect x="13" y="28" width="14" height="10" rx="4" fill="rgba(255,255,255,0.5)" />
                  <circle cx="17" cy="33" r="1.5" fill="rgba(255,255,255,0.9)" />
                  <circle cx="23" cy="33" r="1.5" fill="rgba(255,255,255,0.9)" />
                </svg>
              </div>
              <div>
                <p class="text-[11px] font-bold uppercase tracking-widest text-white/60 leading-none">Bit — Guía Flowbit</p>
                <p class="text-base font-bold text-white leading-tight mt-0.5">{{ currentSection.title }}</p>
              </div>
            </div>
            <button
              type="button"
              class="flex-shrink-0 p-1.5 rounded-xl text-white/60 hover:text-white hover:bg-white/20 transition-colors"
              @click="dismiss"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Indicadores de sección (dots) -->
          <div class="relative flex items-center gap-2 mt-4">
            <button
              v-for="(id, idx) in SECTION_ORDER"
              :key="id"
              type="button"
              :class="[
                'transition-all duration-300 rounded-full',
                idx === currentSectionIndex
                  ? 'w-6 h-2 bg-white'
                  : 'w-2 h-2 bg-white/40 hover:bg-white/70'
              ]"
              :title="SECTIONS[id]?.teaserTitle"
              @click="scrollToSection(id)"
            />
          </div>
        </div>

        <!-- Contenido -->
        <div class="flex-1 overflow-y-auto bg-white">
          <div class="p-5 space-y-4">
            <!-- Emoji grande de sección -->
            <div class="flex items-center gap-3">
              <div :class="['w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center text-2xl flex-shrink-0', currentSection.accentFrom, currentSection.accentTo]">
                {{ currentSection.emoji }}
              </div>
              <p class="text-sm text-slate-700 leading-relaxed flex-1">
                {{ currentSection.message }}
              </p>
            </div>

            <!-- Highlight -->
            <div :class="['rounded-2xl p-4 bg-gradient-to-r border',
              currentSection.accentFrom === 'from-indigo-500' ? 'from-indigo-50 to-violet-50 border-indigo-100' :
              currentSection.accentFrom === 'from-violet-500' ? 'from-violet-50 to-fuchsia-50 border-violet-100' :
              currentSection.accentFrom === 'from-fuchsia-500' ? 'from-fuchsia-50 to-pink-50 border-fuchsia-100' :
              'from-indigo-50 to-fuchsia-50 border-indigo-100'
            ]">
              <div class="flex items-start gap-2">
                <svg class="w-4 h-4 mt-0.5 flex-shrink-0 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                </svg>
                <p class="text-sm font-semibold text-slate-800 leading-relaxed">{{ currentSection.highlight }}</p>
              </div>
            </div>

            <!-- Fun fact -->
            <div v-if="currentSection.funFact" class="rounded-xl bg-amber-50 border border-amber-100 p-3">
              <div class="flex items-start gap-2">
                <span class="text-base flex-shrink-0">💡</span>
                <p class="text-xs text-amber-800 leading-relaxed">{{ currentSection.funFact }}</p>
              </div>
            </div>

            <!-- Módulos mini-grid (solo para ecosistema) -->
            <div v-if="currentSection.id === 'ecosistema'" class="grid grid-cols-4 gap-2">
              <div
                v-for="item in [['👥','Socios'],['📦','Productos'],['🛒','Órdenes'],['🎯','Proyectos'],['✅','Tareas'],['📋','Picking'],['🏭','Almacén'],['📊','CRM']]"
                :key="item[0]"
                class="flex flex-col items-center gap-1 p-2 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors"
              >
                <span class="text-lg">{{ item[0] }}</span>
                <span class="text-[10px] font-medium text-slate-600 text-center leading-tight">{{ item[1] }}</span>
              </div>
            </div>

            <!-- Pasos del workflow (solo para workflow) -->
            <div v-if="currentSection.id === 'workflow'" class="space-y-2">
              <div
                v-for="(step, i) in [['👤','Cliente','Registra al socio comercial'],['🎯','Proyecto','Define tareas y responsables'],['🛒','Orden','Genera el documento de venta'],['📋','Picking','Prepara y despacha del almacén']]"
                :key="i"
                class="flex items-center gap-3"
              >
                <div class="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {{ i + 1 }}
                </div>
                <div class="flex items-center gap-2 flex-1 min-w-0">
                  <span class="text-sm">{{ step[0] }}</span>
                  <div class="min-w-0">
                    <p class="text-xs font-bold text-slate-800">{{ step[1] }}</p>
                    <p class="text-[11px] text-slate-500 truncate">{{ step[2] }}</p>
                  </div>
                </div>
                <div v-if="i < 3" class="text-slate-300">→</div>
              </div>
            </div>

            <!-- Comparación (solo para ventajas) -->
            <div v-if="currentSection.id === 'ventajas'" class="rounded-xl border border-slate-100 overflow-hidden text-xs">
              <div class="grid grid-cols-3 bg-slate-50 border-b border-slate-100">
                <div class="p-2 font-semibold text-slate-500 text-center">Característica</div>
                <div class="p-2 font-semibold text-slate-500 text-center border-x border-slate-100">Otros ERP</div>
                <div class="p-2 font-bold text-indigo-700 text-center">Flowbit</div>
              </div>
              <div
                v-for="row in [['Precio mensual','$200-$2,000','$0 siempre'],['Usuarios','Limitado','Ilimitados'],['Código fuente','Privado','Open source MIT'],['Tus datos','En su nube','Solo tuyos']]"
                :key="row[0]"
                class="grid grid-cols-3 border-b border-slate-50 last:border-0"
              >
                <div class="p-2 text-slate-700 font-medium">{{ row[0] }}</div>
                <div class="p-2 text-slate-400 text-center border-x border-slate-100">{{ row[1] }}</div>
                <div class="p-2 text-emerald-600 font-bold text-center flex items-center justify-center gap-1">
                  <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                  {{ row[2] }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer CTA -->
        <div class="flex-shrink-0 bg-white border-t border-slate-100 p-4">
          <button
            type="button"
            :class="['block w-full text-center py-3.5 px-4 rounded-2xl font-bold text-white text-sm bg-gradient-to-r shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]', currentSection.accentFrom, currentSection.accentTo, 'hover:shadow-violet-500/40']"
            @click="openRegisterForm"
          >
            {{ currentSection.ctaLabel }}
          </button>
          <p class="mt-2 text-center text-[11px] text-slate-400">Sin tarjeta de crédito · Sin compromisos</p>
        </div>
      </div>
    </Transition>

    <!-- Speech bubble teaser -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 scale-90 translate-x-4"
      enter-to-class="opacity-100 scale-100 translate-x-0"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 scale-100 translate-x-0"
      leave-to-class="opacity-0 scale-90 translate-x-4"
    >
      <div
        v-if="showTeaser && !isOpen"
        class="flex items-center gap-2 max-w-[240px] cursor-pointer"
        @click="toggle"
      >
        <div class="relative bg-white rounded-2xl rounded-br-sm shadow-xl shadow-slate-300/50 border border-slate-200 px-4 py-3 flex-1">
          <p class="text-xs font-bold text-slate-800 leading-snug">{{ currentSection.teaserTitle }}</p>
          <p class="text-[11px] text-slate-500 leading-snug mt-0.5">{{ currentSection.teaser }}</p>
          <!-- Flecha de la burbuja -->
          <div class="absolute -bottom-2 right-4 w-4 h-2 overflow-hidden">
            <div class="w-3 h-3 bg-white border-r border-b border-slate-200 rotate-45 -translate-y-1.5 translate-x-0.5" />
          </div>
        </div>
        <button
          type="button"
          class="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 transition-colors -mr-1"
          @click.stop="dismissTeaser"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </Transition>

    <!-- Botón flotante principal (mascota Bit) -->
    <button
      type="button"
      :class="[
        'group relative flex items-center justify-center w-16 h-16 rounded-3xl shadow-2xl transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-violet-400/50',
        isOpen
          ? 'bg-white border-2 border-violet-200 shadow-violet-200/50'
          : 'bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 shadow-violet-500/50 hover:shadow-violet-500/70 hover:scale-110',
        isMascotBouncing && !isOpen ? 'animate-bounce' : ''
      ]"
      :title="isOpen ? 'Cerrar a Bit' : 'Hablar con Bit'"
      @click="toggle"
    >
      <Transition
        enter-active-class="transition duration-200"
        enter-from-class="opacity-0 scale-75 rotate-12"
        enter-to-class="opacity-100 scale-100 rotate-0"
        leave-active-class="transition duration-150"
        leave-from-class="opacity-100 scale-100 rotate-0"
        leave-to-class="opacity-0 scale-75 rotate-12"
        mode="out-in"
      >
        <svg v-if="isOpen" class="w-7 h-7 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
        </svg>

        <!-- Mascota Bit (estado cerrado) -->
        <svg v-else viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 drop-shadow-sm">
          <!-- Antena con luz parpadeante -->
          <line x1="22" y1="3" x2="22" y2="9" stroke="white" stroke-width="2" stroke-linecap="round" />
          <circle cx="22" cy="2.5" r="2.5" fill="white" class="animate-pulse" />

          <!-- Cabeza principal -->
          <rect x="6" y="9" width="32" height="22" rx="8" fill="rgba(255,255,255,0.95)" />

          <!-- Ojos (expresivos) -->
          <circle cx="15.5" cy="18.5" r="4.5" fill="white" />
          <circle cx="28.5" cy="18.5" r="4.5" fill="white" />
          <!-- Pupilas con brillo -->
          <circle cx="15.5" cy="18.5" r="3" fill="#4338ca" />
          <circle cx="28.5" cy="18.5" r="3" fill="#4338ca" />
          <!-- Brillos -->
          <circle cx="16.5" cy="17.2" r="1.2" fill="white" />
          <circle cx="29.5" cy="17.2" r="1.2" fill="white" />

          <!-- Sonrisa amplia -->
          <path d="M15 25 Q22 29.5 29 25" stroke="#4338ca" stroke-width="2" fill="none" stroke-linecap="round" />

          <!-- Mejillas rosadas -->
          <circle cx="11" cy="22" r="3" fill="rgba(244,114,182,0.25)" />
          <circle cx="33" cy="22" r="3" fill="rgba(244,114,182,0.25)" />

          <!-- Orejas/Botones laterales -->
          <rect x="3" y="15" width="3.5" height="7" rx="1.75" fill="rgba(255,255,255,0.7)" />
          <rect x="37.5" y="15" width="3.5" height="7" rx="1.75" fill="rgba(255,255,255,0.7)" />

          <!-- Cuerpo -->
          <rect x="14" y="33" width="16" height="11" rx="5" fill="rgba(255,255,255,0.55)" />
          <!-- Botones del cuerpo -->
          <circle cx="19" cy="38.5" r="1.8" fill="rgba(255,255,255,0.9)" />
          <circle cx="25" cy="38.5" r="1.8" fill="rgba(255,255,255,0.9)" />
        </svg>
      </Transition>

      <!-- Badge "Bit" -->
      <span
        v-if="!isOpen"
        class="absolute -top-1.5 -left-1.5 px-1.5 py-0.5 bg-white rounded-full text-[10px] font-black text-indigo-600 shadow-md border border-indigo-100 leading-none"
      >
        Bit
      </span>

      <!-- Pulso de atención (cuando hay teaser activo) -->
      <span v-if="showTeaser && !isOpen" class="absolute inset-0 rounded-3xl">
        <span class="absolute inset-0 rounded-3xl animate-ping bg-fuchsia-400/30" />
      </span>
    </button>
  </div>
</template>
