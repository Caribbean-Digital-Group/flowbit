<script setup lang="ts">
import type { AvatarConfig } from '~/utils/valle/avatar'
import {
  ACCESSORIES,
  DEFAULT_AVATAR,
  HAIR_COLORS,
  HAIR_STYLES,
  OUTFIT_COLORS,
  SKIN_TONES,
  randomAvatar
} from '~/utils/valle/avatar'
import type { Direction } from '~/utils/valle/types'

/** Editor del avatar por capas. Cada cambio se emite completo; guardar es cosa del padre. */
interface Props {
  /** `false` si el avatar solo se guarda en este navegador (migración pendiente). */
  synced?: boolean
  saving?: boolean
  /** Muestra la confirmación tras guardar. */
  saved?: boolean
}

withDefaults(defineProps<Props>(), { synced: true, saving: false, saved: false })

const emit = defineEmits<{ save: [] }>()

const model = defineModel<AvatarConfig>({ default: () => ({ ...DEFAULT_AVATAR }) })

const previewDirections: Direction[] = ['down', 'right', 'up', 'left']
const previewIndex = ref(0)
const previewDirection = computed<Direction>(() => previewDirections[previewIndex.value] ?? 'down')

const patch = (changes: Partial<AvatarConfig>) => {
  model.value = { ...model.value, ...changes }
}

const rotate = () => {
  previewIndex.value = (previewIndex.value + 1) % previewDirections.length
}

const randomize = () => {
  model.value = randomAvatar()
}

const swatchClass = (selected: boolean): string =>
  `h-9 w-9 rounded-xl border-2 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${selected ? 'border-indigo-600 scale-110' : 'border-white shadow'}`

const chipClass = (selected: boolean): string =>
  `rounded-xl border px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${selected ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center gap-4">
      <button
        type="button"
        class="flex h-28 w-28 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-b from-sky-100 to-emerald-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        aria-label="Girar la vista previa del avatar"
        @click="rotate"
      >
        <ValleAvatarPreview :config="model" :size="96" :direction="previewDirection" />
      </button>
      <div class="space-y-2">
        <p class="text-sm text-slate-500">Toca el avatar para girarlo.</p>
        <button type="button" :class="chipClass(false)" @click="randomize">
          🎲 Al azar
        </button>
      </div>
    </div>

    <fieldset>
      <legend class="mb-2 text-sm font-semibold text-slate-800">Tono de piel</legend>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="option in SKIN_TONES"
          :key="option.value"
          type="button"
          :class="swatchClass(model.skin === option.value)"
          :style="{ backgroundColor: option.value }"
          :aria-label="option.label"
          :aria-pressed="model.skin === option.value"
          @click="patch({ skin: option.value })"
        />
      </div>
    </fieldset>

    <fieldset>
      <legend class="mb-2 text-sm font-semibold text-slate-800">Peinado</legend>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="option in HAIR_STYLES"
          :key="option.value"
          type="button"
          :class="chipClass(model.hairStyle === option.value)"
          :aria-pressed="model.hairStyle === option.value"
          @click="patch({ hairStyle: option.value })"
        >
          {{ option.label }}
        </button>
      </div>
    </fieldset>

    <fieldset v-if="model.hairStyle !== 'bald'">
      <legend class="mb-2 text-sm font-semibold text-slate-800">Color de cabello</legend>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="option in HAIR_COLORS"
          :key="option.value"
          type="button"
          :class="swatchClass(model.hairColor === option.value)"
          :style="{ backgroundColor: option.value }"
          :aria-label="option.label"
          :aria-pressed="model.hairColor === option.value"
          @click="patch({ hairColor: option.value })"
        />
      </div>
    </fieldset>

    <fieldset>
      <legend class="mb-2 text-sm font-semibold text-slate-800">Ropa</legend>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="option in OUTFIT_COLORS"
          :key="option.value"
          type="button"
          :class="swatchClass(model.outfit === option.value)"
          :style="{ backgroundColor: option.value }"
          :aria-label="option.label"
          :aria-pressed="model.outfit === option.value"
          @click="patch({ outfit: option.value })"
        />
      </div>
    </fieldset>

    <fieldset>
      <legend class="mb-2 text-sm font-semibold text-slate-800">Accesorio</legend>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="option in ACCESSORIES"
          :key="option.value"
          type="button"
          :class="chipClass(model.accessory === option.value)"
          :aria-pressed="model.accessory === option.value"
          @click="patch({ accessory: option.value })"
        >
          {{ option.label }}
        </button>
      </div>
    </fieldset>

    <p v-if="!synced" class="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
      Por ahora tu avatar se guarda solo en este navegador.
    </p>

    <BtnApp variant="primary" :disabled="saving" class="w-full" @click="emit('save')">
      {{ saving ? 'Guardando…' : 'Guardar avatar' }}
    </BtnApp>
    <p class="min-h-5 text-center text-sm font-semibold text-emerald-600" role="status">
      {{ saved ? '¡Avatar guardado! Ya se ve así en el mapa.' : '' }}
    </p>
  </div>
</template>
