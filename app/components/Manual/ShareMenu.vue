<script setup lang="ts">
import type { DocArticle } from '~/composables/useManual'
import type { ShareTarget } from '~/utils/manualShare'

interface Props {
  article: DocArticle
  /** Ancla de la sección concreta que se comparte (consejos, campos, guía…). */
  sectionId?: string
  /** Texto alterno a publicar; por defecto se usa el resumen del artículo. */
  sectionText?: string
  /** Botón discreto de icono, para usarse dentro de una sección. */
  compact?: boolean
  align?: 'left' | 'right'
}

const props = withDefaults(defineProps<Props>(), {
  sectionId: undefined,
  sectionText: undefined,
  compact: false,
  align: 'right'
})

const {
  articleUrl,
  copy,
  copyLink,
  copyArticle,
  canUseNativeShare,
  shareNative,
  shareTo,
  downloadCard,
  socialText
} = useManualShare()

const isOpen = ref(false)
const isGenerating = ref(false)
const container = ref<HTMLElement | null>(null)

const shareText = computed(() => props.sectionText ?? socialText(props.article))
const publicUrl = computed(() => articleUrl(props.article.id, props.sectionId))
const nativeAvailable = computed(() => canUseNativeShare())

interface NetworkOption {
  id: ShareTarget
  label: string
  color: string
  path: string
  viewBox?: string
}

// Glifos de marca simplificados: el proyecto no usa librería de iconos.
const NETWORKS: NetworkOption[] = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    color: 'text-[#25D366]',
    path: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.825 9.825 0 016.988 2.896 9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.892c0 2.096.549 4.142 1.595 5.945L0 24l6.335-1.652a12.06 12.06 0 005.71 1.447h.006c6.585 0 11.946-5.336 11.949-11.896 0-3.176-1.24-6.165-3.495-8.411'
  },
  {
    id: 'x',
    label: 'X',
    color: 'text-slate-900',
    path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z'
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    color: 'text-[#0A66C2]',
    path: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z'
  },
  {
    id: 'facebook',
    label: 'Facebook',
    color: 'text-[#1877F2]',
    path: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z'
  },
  {
    id: 'telegram',
    label: 'Telegram',
    color: 'text-[#229ED9]',
    path: 'M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z'
  },
  {
    id: 'email',
    label: 'Correo',
    color: 'text-slate-500',
    path: 'M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z'
  }
]

function toggle() {
  isOpen.value = !isOpen.value
}

function close() {
  isOpen.value = false
}

function handleClickOutside(event: MouseEvent) {
  if (container.value && !container.value.contains(event.target as Node)) close()
}

function handleEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}

watch(isOpen, open => {
  if (import.meta.server) return
  if (open) {
    document.addEventListener('click', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
  } else {
    document.removeEventListener('click', handleClickOutside)
    document.removeEventListener('keydown', handleEscape)
  }
})

onUnmounted(() => {
  if (import.meta.server) return
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleEscape)
})

async function handleNative() {
  await shareNative(props.article, props.sectionId)
  close()
}

async function handleCopyLink() {
  await copyLink(props.article.id, props.sectionId)
  close()
}

async function handleCopyContent() {
  if (props.sectionText) {
    await copy(`${props.sectionText}\n\n${publicUrl.value}`, 'Sección copiada')
  } else {
    await copyArticle(props.article)
  }
  close()
}

function handleNetwork(target: ShareTarget) {
  shareTo(target, props.article, props.sectionId, shareText.value)
  close()
}

async function handleCard() {
  isGenerating.value = true
  await downloadCard(props.article)
  isGenerating.value = false
  close()
}
</script>

<template>
  <div ref="container" class="relative inline-block">
    <!-- Disparador -->
    <button
      type="button"
      :class="[
        'inline-flex items-center gap-1.5 rounded-lg font-semibold transition-colors',
        compact
          ? 'p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600'
          : 'px-3 py-1.5 text-xs bg-white border border-slate-200 text-slate-600 hover:border-indigo-200 hover:text-indigo-700 hover:bg-indigo-50/60',
        isOpen && !compact ? 'border-indigo-300 text-indigo-700 bg-indigo-50' : '',
        isOpen && compact ? 'bg-slate-100 text-indigo-600' : ''
      ]"
      :title="sectionId ? 'Compartir esta sección' : 'Compartir esta guía'"
      aria-label="Compartir"
      @click.stop="toggle"
    >
      <svg :class="compact ? 'w-3.5 h-3.5' : 'w-3.5 h-3.5'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342a3 3 0 100-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684zm0-12.632a3 3 0 105.368-2.684 3 3 0 00-5.368 2.684z" />
      </svg>
      <span v-if="!compact">Compartir</span>
    </button>

    <!-- Menú -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 scale-95 -translate-y-1"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        :class="[
          'absolute z-40 mt-2 w-72 rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-300/40 overflow-hidden',
          align === 'right' ? 'right-0' : 'left-0'
        ]"
      >
        <!-- Vista previa de lo que se comparte -->
        <div class="px-4 py-3 bg-gradient-to-br from-indigo-50 to-violet-50 border-b border-slate-100">
          <p class="text-[10px] font-bold uppercase tracking-wider text-indigo-500 mb-1">
            {{ sectionId ? 'Compartir sección' : 'Compartir documentación' }}
          </p>
          <p class="text-xs font-semibold text-slate-800 leading-snug line-clamp-2">{{ article.title }}</p>
          <p class="mt-1 text-[11px] text-slate-500 truncate">{{ publicUrl }}</p>
        </div>

        <div class="p-2">
          <!-- Compartir nativo del dispositivo -->
          <button
            v-if="nativeAvailable"
            type="button"
            class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-sm font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
            @click="handleNative"
          >
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Compartir con…
          </button>

          <button
            type="button"
            class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-sm font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
            @click="handleCopyLink"
          >
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Copiar enlace
          </button>

          <button
            type="button"
            class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-sm font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
            @click="handleCopyContent"
          >
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {{ sectionId ? 'Copiar contenido' : 'Copiar documentación' }}
          </button>

          <button
            type="button"
            :disabled="isGenerating"
            class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-sm font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors disabled:opacity-60"
            @click="handleCard"
          >
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {{ isGenerating ? 'Generando imagen…' : 'Descargar tarjeta para redes' }}
          </button>
        </div>

        <!-- Redes sociales -->
        <div class="px-3 pb-3 pt-1 border-t border-slate-100">
          <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">Publicar en</p>
          <div class="grid grid-cols-6 gap-1">
            <button
              v-for="network in NETWORKS"
              :key="network.id"
              type="button"
              :class="['flex items-center justify-center h-9 rounded-xl hover:bg-slate-100 transition-colors', network.color]"
              :title="network.label"
              :aria-label="`Compartir en ${network.label}`"
              @click="handleNetwork(network.id)"
            >
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path :d="network.path" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
