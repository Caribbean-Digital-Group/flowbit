<script setup lang="ts">
import type { AvatarConfig } from '~/utils/valle/avatar'
import type { LocationSummary } from '~/utils/valle/summary'
import { buildLocationSummary, buildScoreboard } from '~/utils/valle/summary'
import type { LocationId } from '~/utils/valle/types'
import { VALLE_LOCATIONS, getValleLocation } from '~/utils/valle/locations'

definePageMeta({ layout: 'valle' })

useHead({ title: 'Valle Bit · Flowbit' })

type ViewMode = 'map' | 'list'
const VIEW_MODE_KEY = 'flowbit:valle-view'

interface GameCanvasApi {
  walkTo: (id: LocationId) => void
  interact: () => void
  setJoystick: (x: number, y: number) => void
}

const authStore = useAuthStore()
const { selectedCompanyId, selectedCompany } = storeToRefs(authStore)
const { data, isLoading, load, loadLocation } = useValleWorld()
const { avatar, isSynced, load: loadAvatar, save: saveAvatar } = useValleAvatar()

const gameRef = ref<GameCanvasApi | null>(null)
const viewMode = ref<ViewMode>('map')
const nearId = ref<LocationId | null>(null)
const openId = ref<LocationId | null>(null)
const isBitOpen = ref(false)
const isBitBusy = ref(false)
const draftAvatar = ref<AvatarConfig>({ ...avatar.value })
const isSavingAvatar = ref(false)
const isAvatarSaved = ref(false)

const markers = computed(() => buildScoreboard(data.value))

const summaries = computed(() =>
  Object.fromEntries(VALLE_LOCATIONS.map(location => [location.id, buildLocationSummary(location.id, data.value)])) as Record<LocationId, LocationSummary>)

const openLocation = computed(() => (openId.value ? getValleLocation(openId.value) ?? null : null))
const nearLocation = computed(() => (nearId.value ? getValleLocation(nearId.value) ?? null : null))
/** Lugar del que habla Bit: el que está abierto o, si no, el más cercano. */
const bitLocation = computed(() => openLocation.value ?? nearLocation.value)
const bitLiveLine = computed(() => (bitLocation.value ? summaries.value[bitLocation.value.id].liveLine : null))

const isPaused = computed(() => openId.value !== null || isBitBusy.value)

const enterLocation = (id: LocationId) => {
  openId.value = id
  nearId.value = id
  if (id === 'casa') {
    draftAvatar.value = { ...avatar.value }
    isAvatarSaved.value = false
  }
  void loadLocation(id, selectedCompanyId.value)
}

/** Desde un marcador o desde Bit: en el mapa el avatar camina hasta allá; en lista se abre directo. */
const goToLocation = (id: LocationId) => {
  openId.value = null
  if (viewMode.value === 'map' && gameRef.value) gameRef.value.walkTo(id)
  else enterLocation(id)
}

const onNear = (id: LocationId | null) => {
  nearId.value = id
  // Bit necesita el dato vivo del lugar aunque aún no se haya entrado.
  if (id) void loadLocation(id, selectedCompanyId.value)
}

const setViewMode = (mode: ViewMode) => {
  viewMode.value = mode
  if (mode === 'list') nearId.value = null
  try {
    window.localStorage.setItem(VIEW_MODE_KEY, mode)
  } catch {
    // modo privado: la preferencia dura lo que dure la visita
  }
}

const handleSaveAvatar = async () => {
  isSavingAvatar.value = true
  // Aunque la base no responda, el avatar queda guardado en este navegador.
  await saveAvatar(draftAvatar.value)
  isSavingAvatar.value = false
  isAvatarSaved.value = true
}

const onKeyDown = (event: KeyboardEvent) => {
  const target = event.target as HTMLElement | null
  if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
  if (event.metaKey || event.ctrlKey || event.altKey) return
  if (event.key.toLowerCase() === 'b' && !openId.value) isBitOpen.value = !isBitOpen.value
}

watch(selectedCompanyId, companyId => {
  openId.value = null
  void load(companyId)
}, { immediate: true })

onMounted(() => {
  let saved: string | null = null
  try {
    saved = window.localStorage.getItem(VIEW_MODE_KEY)
  } catch {
    saved = null
  }
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  viewMode.value = saved === 'map' || saved === 'list' ? saved : prefersReducedMotion ? 'list' : 'map'
  window.addEventListener('keydown', onKeyDown)
  void loadAvatar()
})

onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <main class="relative h-full w-full select-none">
    <h1 class="sr-only">Valle Bit</h1>

    <ValleGameCanvas
      v-if="viewMode === 'map'"
      ref="gameRef"
      :avatar="avatar"
      :paused="isPaused"
      @near="onNear"
      @enter="enterLocation"
    />
    <ValleListMode
      v-else
      :locations="VALLE_LOCATIONS"
      :summaries="summaries"
      @open="enterLocation"
    />

    <!-- Barra superior: salida, empresa, modo de vista y marcadores -->
    <div class="pointer-events-none absolute inset-x-0 top-0 z-10 space-y-2 bg-gradient-to-b from-slate-900/60 to-transparent pb-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div class="pointer-events-auto flex items-center gap-2 px-3">
        <NuxtLink
          to="/admin"
          aria-label="Volver al panel"
          class="flex items-center gap-1.5 rounded-xl bg-slate-900/85 px-3 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur transition-colors hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span class="sm:hidden">Panel</span>
          <span class="hidden sm:inline">Volver al panel</span>
        </NuxtLink>

        <div class="min-w-0 flex-1 text-white drop-shadow">
          <p class="truncate text-sm font-bold">Valle Bit</p>
          <p class="truncate text-xs text-white/80">{{ selectedCompany?.name ?? 'Sin empresa seleccionada' }}</p>
        </div>

        <button
          type="button"
          class="rounded-xl bg-slate-900/85 px-3 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur transition-colors hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          :aria-pressed="viewMode === 'list'"
          @click="setViewMode(viewMode === 'map' ? 'list' : 'map')"
        >
          {{ viewMode === 'map' ? '☰ Lista' : '🗺️ Mapa' }}
        </button>
      </div>

      <div class="pointer-events-auto">
        <ValleHud :markers="markers" :currency="data.currency" :loading="isLoading" @select="goToLocation" />
      </div>
    </div>

    <p
      v-if="!selectedCompanyId"
      class="absolute inset-x-3 top-32 z-10 mx-auto max-w-md rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-lg"
    >
      No tienes una empresa seleccionada. Elige una en el panel para ver sus datos en el valle.
    </p>

    <!-- Controles del mapa -->
    <template v-if="viewMode === 'map' && !isPaused">
      <div class="absolute bottom-6 left-4 z-20 hidden pb-[env(safe-area-inset-bottom)] pointer-coarse:block">
        <ValleJoystick @move="(x, y) => gameRef?.setJoystick(x, y)" />
      </div>

      <button
        v-if="nearLocation"
        type="button"
        class="absolute bottom-6 right-3 z-20 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-xl transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
        @click="enterLocation(nearLocation.id)"
      >
        <span aria-hidden="true">{{ nearLocation.emoji }}</span>
        Entrar a {{ nearLocation.name }}
        <kbd class="hidden rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-500 sm:inline">E</kbd>
      </button>
    </template>

    <ValleBitCompanion
      v-model:open="isBitOpen"
      :location="bitLocation"
      :live-line="bitLiveLine"
      :urgent-line="summaries.plaza.liveLine"
      @go="goToLocation"
      @open-location="enterLocation"
      @busy-change="busy => (isBitBusy = busy)"
    />

    <ValleLocationPanel
      v-if="openLocation && !isBitOpen"
      :location="openLocation"
      :summary="summaries[openLocation.id]"
      @close="openId = null"
      @help="isBitOpen = true"
    >
      <ValleAvatarEditor
        v-if="openLocation.id === 'casa'"
        v-model="draftAvatar"
        :synced="isSynced"
        :saving="isSavingAvatar"
        :saved="isAvatarSaved"
        @update:model-value="isAvatarSaved = false"
        @save="handleSaveAvatar"
      />
    </ValleLocationPanel>
  </main>
</template>
