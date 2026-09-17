<script setup lang="ts">
import '~/assets/css/storefront.css'
import '~/assets/css/website.css'
import { resolveStorefrontTheme, type ThemeOverrides } from '~/utils/storefrontTheme'
import type { WebsiteSection } from '~/utils/website/sections'

/**
 * Constructor de páginas: lista de secciones (izquierda), formulario de la
 * sección seleccionada (centro) y vista previa en vivo (derecha) renderizada
 * con el mismo SectionRenderer y tema que el sitio público.
 */
interface Props {
  companyId: string
  companySlug: string
  themeOverrides: ThemeOverrides
  linkOptions?: { value: string; label: string }[]
}

const props = withDefaults(defineProps<Props>(), { linkOptions: () => [] })
const sections = defineModel<WebsiteSection[]>({ required: true })

const selectedId = ref<string | null>(sections.value[0]?.id ?? null)
const device = ref<'desktop' | 'mobile'>('desktop')
const panel = ref<'edit' | 'preview'>('edit')

const selected = computed(() => sections.value.find(s => s.id === selectedId.value) ?? null)

const updateSelected = (section: WebsiteSection) => {
  sections.value = sections.value.map(s => (s.id === section.id ? section : s))
}

const themeStyle = computed(() => resolveStorefrontTheme(props.themeOverrides).tokens)

// Las secciones dinámicas (blog, tienda, contacto) leen el store del sitio:
// se inicializa en modo vista previa para que la maqueta muestre datos reales.
const websiteStore = useWebsiteStore()
watch(() => props.companySlug, (slug) => {
  if (slug) void websiteStore.initialize(slug, true)
}, { immediate: true })

watch(sections, (list) => {
  if (selectedId.value && !list.some(s => s.id === selectedId.value)) selectedId.value = list[0]?.id ?? null
})

const scrollToSelected = () => {
  if (!selectedId.value || typeof document === 'undefined') return
  document.getElementById(`section-${selectedId.value}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

watch(selectedId, () => void nextTick(scrollToSelected))
</script>

<template>
  <div class="grid grid-cols-1 xl:grid-cols-12 gap-4 min-h-[70vh]">
    <!-- Lista -->
    <aside class="xl:col-span-3 bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-4 xl:max-h-[calc(100vh-14rem)] xl:sticky xl:top-24 flex flex-col">
      <WebsiteSectionList v-model="sections" v-model:selected-id="selectedId" />
    </aside>

    <!-- Editor / Vista previa -->
    <div class="xl:col-span-9 flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div class="flex items-center gap-1 rounded-xl bg-white border border-slate-200 p-1 shadow-sm">
          <button type="button" :class="['px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors', panel === 'edit' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700']" @click="panel = 'edit'">Editar sección</button>
          <button type="button" :class="['px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors', panel === 'preview' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700']" @click="panel = 'preview'">Solo vista previa</button>
        </div>
        <div class="flex items-center gap-1 rounded-xl bg-white border border-slate-200 p-1 shadow-sm">
          <button type="button" :class="['px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors', device === 'desktop' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700']" @click="device = 'desktop'">Escritorio</button>
          <button type="button" :class="['px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors', device === 'mobile' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700']" @click="device = 'mobile'">Celular</button>
        </div>
      </div>

      <div :class="['grid gap-4', panel === 'edit' ? 'lg:grid-cols-12' : '']">
        <div v-if="panel === 'edit'" class="lg:col-span-5 bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-5 lg:max-h-[calc(100vh-14rem)] overflow-y-auto lg:sticky lg:top-24">
          <WebsiteSectionEditor
            v-if="selected"
            :section="selected"
            :company-id="companyId"
            :link-options="linkOptions"
            @update:section="updateSelected"
          />
          <div v-else class="py-16 text-center text-sm text-slate-400">Selecciona una sección para editarla o agrega una nueva.</div>
        </div>

        <div :class="panel === 'edit' ? 'lg:col-span-7' : ''">
          <div class="rounded-2xl border border-slate-200 bg-slate-100 p-3">
            <div :class="['mx-auto transition-all duration-300 rounded-xl overflow-hidden shadow-xl bg-white', device === 'mobile' ? 'max-w-[390px]' : 'w-full']">
              <div class="ws-root" :style="themeStyle" style="min-height: auto">
                <WebsiteSectionRenderer :sections="sections" :selected-id="selectedId" editable @select="selectedId = $event" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
