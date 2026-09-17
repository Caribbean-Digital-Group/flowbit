<script setup lang="ts">
import {
  SECTION_DEFINITIONS,
  SECTION_CATEGORY_LABELS,
  createSection,
  duplicateSection,
  getSectionDefinition,
  type SectionCategory,
  type WebsiteSection,
  type WebsiteSectionType
} from '~/utils/website/sections'

/** Lista ordenable de secciones de la página con catálogo para agregar. */
const sections = defineModel<WebsiteSection[]>({ required: true })
const selectedId = defineModel<string | null>('selectedId', { default: null })

const catalogOpen = ref(false)
const dragIndex = ref<number | null>(null)

const categories = computed(() => {
  const groups = new Map<SectionCategory, typeof SECTION_DEFINITIONS>()
  for (const def of SECTION_DEFINITIONS) {
    const list = groups.get(def.category) ?? []
    list.push(def)
    groups.set(def.category, list)
  }
  return Array.from(groups.entries()).map(([id, defs]) => ({ id, label: SECTION_CATEGORY_LABELS[id], defs }))
})

const add = (type: WebsiteSectionType) => {
  const section = createSection(type)
  const index = selectedId.value ? sections.value.findIndex(s => s.id === selectedId.value) : -1
  const next = [...sections.value]
  next.splice(index >= 0 ? index + 1 : next.length, 0, section)
  sections.value = next
  selectedId.value = section.id
  catalogOpen.value = false
}

const remove = (id: string) => {
  sections.value = sections.value.filter(s => s.id !== id)
  if (selectedId.value === id) selectedId.value = sections.value[0]?.id ?? null
}

const duplicate = (id: string) => {
  const index = sections.value.findIndex(s => s.id === id)
  if (index < 0) return
  const copy = duplicateSection(sections.value[index] as WebsiteSection)
  const next = [...sections.value]
  next.splice(index + 1, 0, copy)
  sections.value = next
  selectedId.value = copy.id
}

const toggleHidden = (id: string) => {
  sections.value = sections.value.map(s => (s.id === id ? { ...s, hidden: !s.hidden } : s))
}

const move = (index: number, delta: number) => {
  const target = index + delta
  if (target < 0 || target >= sections.value.length) return
  const next = [...sections.value]
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved as WebsiteSection)
  sections.value = next
}

const onDragStart = (index: number) => { dragIndex.value = index }
const onDrop = (index: number) => {
  if (dragIndex.value === null || dragIndex.value === index) return
  const next = [...sections.value]
  const [moved] = next.splice(dragIndex.value, 1)
  next.splice(index, 0, moved as WebsiteSection)
  sections.value = next
  dragIndex.value = null
}

const labelOf = (section: WebsiteSection): string => {
  const def = getSectionDefinition(section.type)
  const title = typeof section.props.title === 'string' && section.props.title.trim() ? section.props.title.trim() : null
  return title ? `${def?.label ?? section.type} · ${title}` : def?.label ?? section.type
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="flex items-center justify-between mb-3">
      <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Secciones ({{ sections.length }})</p>
      <button type="button" class="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800" @click="catalogOpen = true">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
        Agregar
      </button>
    </div>

    <ul class="space-y-1.5 flex-1 overflow-y-auto pr-1">
      <li
        v-for="(section, index) in sections"
        :key="section.id"
        draggable="true"
        :class="['group rounded-xl border px-2.5 py-2 flex items-center gap-2 cursor-pointer transition-colors', selectedId === section.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50', section.hidden ? 'opacity-60' : '']"
        @click="selectedId = section.id"
        @dragstart="onDragStart(index)"
        @dragover.prevent
        @drop="onDrop(index)"
      >
        <svg class="w-4 h-4 text-slate-300 flex-shrink-0 cursor-grab" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" /></svg>
        <svg class="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" :d="getSectionDefinition(section.type)?.icon" /></svg>
        <span class="flex-1 min-w-0 text-xs font-medium text-slate-700 truncate">{{ labelOf(section) }}</span>
        <div class="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
          <button type="button" class="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" :disabled="index === 0" title="Subir" @click.stop="move(index, -1)">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" /></svg>
          </button>
          <button type="button" class="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" :disabled="index === sections.length - 1" title="Bajar" @click.stop="move(index, 1)">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
          </button>
          <button type="button" class="p-1 text-slate-400 hover:text-slate-700" :title="section.hidden ? 'Mostrar' : 'Ocultar'" @click.stop="toggleHidden(section.id)">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path v-if="section.hidden" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A9.8 9.8 0 0112 5c4.5 0 8.3 2.9 9.5 7a10 10 0 01-1.7 3.1M6.6 6.6A10 10 0 002.5 12c1.2 4.1 5 7 9.5 7 1.6 0 3.1-.4 4.4-1" /><path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.5 12C3.7 7.9 7.5 5 12 5s8.3 2.9 9.5 7c-1.2 4.1-5 7-9.5 7s-8.3-2.9-9.5-7z" /></svg>
          </button>
          <button type="button" class="p-1 text-slate-400 hover:text-slate-700" title="Duplicar" @click.stop="duplicate(section.id)">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          </button>
          <button type="button" class="p-1 text-slate-400 hover:text-red-600" title="Eliminar" @click.stop="remove(section.id)">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </li>
    </ul>

    <button type="button" class="mt-3 w-full rounded-xl border-2 border-dashed border-slate-200 py-3 text-xs font-semibold text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors" @click="catalogOpen = true">
      + Agregar sección
    </button>

    <!-- Catálogo -->
    <Teleport to="body">
      <div v-if="catalogOpen" class="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" role="dialog" aria-modal="true" @click.self="catalogOpen = false">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden">
          <header class="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <h3 class="text-lg font-bold text-slate-800">Agregar una sección</h3>
              <p class="text-sm text-slate-500">Se insertará después de la sección seleccionada.</p>
            </div>
            <button type="button" class="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100" aria-label="Cerrar" @click="catalogOpen = false">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </header>
          <div class="flex-1 overflow-y-auto p-6 space-y-6">
            <div v-for="group in categories" :key="group.id">
              <p class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">{{ group.label }}</p>
              <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <button v-for="def in group.defs" :key="def.type" type="button" class="text-left rounded-xl border border-slate-200 p-4 hover:border-indigo-400 hover:bg-indigo-50/40 transition-colors" @click="add(def.type)">
                  <span class="inline-flex w-9 h-9 rounded-lg bg-slate-100 text-slate-600 items-center justify-center mb-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" :d="def.icon" /></svg>
                  </span>
                  <p class="font-semibold text-sm text-slate-800">{{ def.label }}</p>
                  <p class="text-xs text-slate-500 mt-1 leading-relaxed">{{ def.description }}</p>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
