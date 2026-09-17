<script setup lang="ts">
import {
  getSectionDefinition,
  SECTION_ICON_OPTIONS,
  type SectionField,
  type WebsiteSection,
  type SectionBackground,
  type SectionPadding,
  type SectionAlign
} from '~/utils/website/sections'

/**
 * Formulario de una sección: genera los campos a partir de su definición en
 * el catálogo y edita también el estilo (fondo, espaciado, alineación).
 */
interface Props {
  section: WebsiteSection
  companyId: string
  /** Enlaces sugeridos para campos href (páginas publicadas, blog, etc.). */
  linkOptions?: { value: string; label: string }[]
}

const props = withDefaults(defineProps<Props>(), { linkOptions: () => [] })
const emit = defineEmits<{ 'update:section': [section: WebsiteSection] }>()

const definition = computed(() => getSectionDefinition(props.section.type))

const setProp = (key: string, value: unknown) => {
  emit('update:section', { ...props.section, props: { ...props.section.props, [key]: value } })
}

const setStyle = (patch: Partial<WebsiteSection['style']>) => {
  emit('update:section', { ...props.section, style: { ...props.section.style, ...patch } })
}

const listOf = (key: string): Record<string, unknown>[] => {
  const raw = props.section.props[key]
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : []
}

const emptyItem = (field: SectionField): Record<string, unknown> =>
  Object.fromEntries((field.itemFields ?? []).map(f => [f.key, f.type === 'boolean' ? false : f.type === 'icon' ? 'star' : '']))

const addItem = (field: SectionField) => {
  const items = listOf(field.key)
  if (field.maxItems && items.length >= field.maxItems) return
  setProp(field.key, [...items, emptyItem(field)])
}

const removeItem = (key: string, index: number) => setProp(key, listOf(key).filter((_, i) => i !== index))

const moveItem = (key: string, index: number, delta: number) => {
  const items = [...listOf(key)]
  const target = index + delta
  if (target < 0 || target >= items.length) return
  const [moved] = items.splice(index, 1)
  items.splice(target, 0, moved as Record<string, unknown>)
  setProp(key, items)
}

const setItemProp = (key: string, index: number, itemKey: string, value: unknown) => {
  setProp(key, listOf(key).map((item, i) => (i === index ? { ...item, [itemKey]: value } : item)))
}

const stringValue = (value: unknown): string => (value === null || value === undefined ? '' : String(value))

const BACKGROUNDS: { value: SectionBackground; label: string }[] = [
  { value: 'surface', label: 'Base' }, { value: 'muted', label: 'Suave' }, { value: 'primary', label: 'Color de marca' }, { value: 'dark', label: 'Oscuro' }
]
const PADDINGS: { value: SectionPadding; label: string }[] = [
  { value: 'sm', label: 'Compacto' }, { value: 'md', label: 'Medio' }, { value: 'lg', label: 'Amplio' }
]
const ALIGNS: { value: SectionAlign; label: string }[] = [
  { value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centrado' }
]

const iconOptions = SECTION_ICON_OPTIONS.map(o => ({ value: o.value, label: o.label }))
</script>

<template>
  <div v-if="definition" class="space-y-5">
    <div>
      <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Sección</p>
      <h3 class="text-lg font-bold text-slate-800">{{ definition.label }}</h3>
      <p class="text-sm text-slate-500">{{ definition.description }}</p>
    </div>

    <div v-for="field in definition.fields" :key="field.key">
      <!-- Listas -->
      <template v-if="field.type === 'list'">
        <div class="flex items-center justify-between mb-2">
          <p class="text-sm font-medium text-slate-700">{{ field.label }}</p>
          <button
            v-if="!field.maxItems || listOf(field.key).length < field.maxItems"
            type="button"
            class="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            @click="addItem(field)"
          >
            + {{ field.addLabel ?? 'Agregar' }}
          </button>
        </div>
        <div class="space-y-3">
          <div v-for="(item, index) in listOf(field.key)" :key="index" class="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-semibold text-slate-500">Elemento {{ index + 1 }}</span>
              <div class="flex items-center gap-1">
                <button type="button" class="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" :disabled="index === 0" aria-label="Subir" @click="moveItem(field.key, index, -1)">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" /></svg>
                </button>
                <button type="button" class="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" :disabled="index === listOf(field.key).length - 1" aria-label="Bajar" @click="moveItem(field.key, index, 1)">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                <button type="button" class="p-1 text-slate-400 hover:text-red-600" aria-label="Quitar" @click="removeItem(field.key, index)">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div class="space-y-3">
              <template v-for="sub in field.itemFields ?? []" :key="sub.key">
                <WebsiteImageField v-if="sub.type === 'image'" :model-value="stringValue(item[sub.key])" :label="sub.label" :company-id="companyId" aspect="square" @update:model-value="setItemProp(field.key, index, sub.key, $event)" />
                <FormSelect v-else-if="sub.type === 'icon'" :model-value="stringValue(item[sub.key]) || 'star'" :label="sub.label" :options="iconOptions" :searchable="false" size="sm" @update:model-value="setItemProp(field.key, index, sub.key, $event)" />
                <FormSelect v-else-if="sub.type === 'select'" :model-value="stringValue(item[sub.key])" :label="sub.label" :options="sub.options ?? []" :searchable="false" size="sm" @update:model-value="setItemProp(field.key, index, sub.key, $event)" />
                <FormTextArea v-else-if="sub.type === 'textarea'" :model-value="stringValue(item[sub.key])" :label="sub.label" :placeholder="sub.placeholder" :rows="3" size="sm" @update:model-value="setItemProp(field.key, index, sub.key, $event)" />
                <label v-else-if="sub.type === 'boolean'" class="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" :checked="item[sub.key] === true" class="w-4 h-4 text-indigo-600 rounded border-slate-300" @change="setItemProp(field.key, index, sub.key, ($event.target as HTMLInputElement).checked)" />
                  {{ sub.label }}
                </label>
                <div v-else-if="sub.type === 'href'">
                  <FormInput :model-value="stringValue(item[sub.key])" :label="sub.label" :placeholder="sub.placeholder ?? '/contacto o https://…'" :list="`links-${section.id}`" size="sm" @update:model-value="setItemProp(field.key, index, sub.key, $event)" />
                </div>
                <FormInput v-else :model-value="stringValue(item[sub.key])" :label="sub.label" :placeholder="sub.placeholder" :type="sub.type === 'url' ? 'url' : 'text'" size="sm" @update:model-value="setItemProp(field.key, index, sub.key, $event)" />
              </template>
            </div>
          </div>
          <p v-if="!listOf(field.key).length" class="text-xs text-slate-400">Sin elementos.</p>
        </div>
      </template>

      <!-- Texto enriquecido -->
      <template v-else-if="field.type === 'richtext'">
        <p class="block text-sm font-medium text-slate-700 mb-1.5">{{ field.label }}</p>
        <ClientOnly>
          <WebsiteRichTextEditor :model-value="stringValue(section.props[field.key])" mode="html" compact :company-id="companyId" @update:model-value="setProp(field.key, $event)" />
          <template #fallback>
            <div class="h-40 rounded-2xl border border-slate-200 bg-slate-50 animate-pulse" />
          </template>
        </ClientOnly>
      </template>

      <WebsiteImageField v-else-if="field.type === 'image'" :model-value="stringValue(section.props[field.key])" :label="field.label" :hint="field.hint" :company-id="companyId" @update:model-value="setProp(field.key, $event)" />

      <FormTextArea v-else-if="field.type === 'textarea'" :model-value="stringValue(section.props[field.key])" :label="field.label" :placeholder="field.placeholder" :hint="field.hint" :rows="field.key === 'html' ? 8 : 3" size="sm" @update:model-value="setProp(field.key, $event)" />

      <FormSelect v-else-if="field.type === 'select'" :model-value="(section.props[field.key] as string | number | null) ?? null" :label="field.label" :options="field.options ?? []" :hint="field.hint" :searchable="false" size="sm" @update:model-value="setProp(field.key, $event)" />

      <FormSelect v-else-if="field.type === 'icon'" :model-value="stringValue(section.props[field.key]) || 'star'" :label="field.label" :options="iconOptions" :searchable="false" size="sm" @update:model-value="setProp(field.key, $event)" />

      <FormInput v-else-if="field.type === 'number'" :model-value="Number(section.props[field.key] ?? field.min ?? 0)" :label="field.label" type="number" :min="field.min" :max="field.max" :hint="field.hint" size="sm" @update:model-value="setProp(field.key, Number($event))" />

      <label v-else-if="field.type === 'boolean'" class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer select-none">
        <input type="checkbox" :checked="section.props[field.key] === true" class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" @change="setProp(field.key, ($event.target as HTMLInputElement).checked)" />
        <span class="text-sm text-slate-700">{{ field.label }}</span>
      </label>

      <div v-else-if="field.type === 'href'">
        <FormInput :model-value="stringValue(section.props[field.key])" :label="field.label" :placeholder="field.placeholder ?? '/contacto o https://…'" :hint="field.hint" :list="`links-${section.id}`" size="sm" @update:model-value="setProp(field.key, $event)" />
      </div>

      <FormInput v-else :model-value="stringValue(section.props[field.key])" :label="field.label" :placeholder="field.placeholder" :hint="field.hint" :type="field.type === 'url' ? 'url' : 'text'" size="sm" @update:model-value="setProp(field.key, $event)" />
    </div>

    <datalist v-if="linkOptions.length" :id="`links-${section.id}`">
      <option v-for="option in linkOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
    </datalist>

    <!-- Estilo -->
    <div class="pt-5 border-t border-slate-100 space-y-4">
      <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Estilo</p>
      <div>
        <p class="text-sm font-medium text-slate-700 mb-1.5">Fondo</p>
        <div class="grid grid-cols-4 gap-2">
          <button v-for="bg in BACKGROUNDS" :key="bg.value" type="button" :class="['px-2 py-2 rounded-lg text-xs font-semibold border transition-colors', section.style.background === bg.value ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50']" @click="setStyle({ background: bg.value })">{{ bg.label }}</button>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <p class="text-sm font-medium text-slate-700 mb-1.5">Espaciado</p>
          <div class="flex rounded-lg border border-slate-200 overflow-hidden">
            <button v-for="pad in PADDINGS" :key="pad.value" type="button" :class="['flex-1 px-2 py-2 text-xs font-semibold transition-colors', section.style.padding === pad.value ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50']" @click="setStyle({ padding: pad.value })">{{ pad.label }}</button>
          </div>
        </div>
        <div>
          <p class="text-sm font-medium text-slate-700 mb-1.5">Alineación</p>
          <div class="flex rounded-lg border border-slate-200 overflow-hidden">
            <button v-for="al in ALIGNS" :key="al.value" type="button" :class="['flex-1 px-2 py-2 text-xs font-semibold transition-colors', section.style.align === al.value ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50']" @click="setStyle({ align: al.value })">{{ al.label }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
