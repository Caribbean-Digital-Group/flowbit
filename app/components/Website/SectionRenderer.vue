<script setup lang="ts">
import type { WebsiteSection } from '~/utils/website/sections'
import SectionHero from '~/components/Website/Section/Hero.vue'
import SectionText from '~/components/Website/Section/Text.vue'
import SectionImageText from '~/components/Website/Section/ImageText.vue'
import SectionFeatures from '~/components/Website/Section/Features.vue'
import SectionStats from '~/components/Website/Section/Stats.vue'
import SectionGallery from '~/components/Website/Section/Gallery.vue'
import SectionTestimonials from '~/components/Website/Section/Testimonials.vue'
import SectionPricing from '~/components/Website/Section/Pricing.vue'
import SectionFaq from '~/components/Website/Section/Faq.vue'
import SectionTeam from '~/components/Website/Section/Team.vue'
import SectionCta from '~/components/Website/Section/Cta.vue'
import SectionLogos from '~/components/Website/Section/Logos.vue'
import SectionVideo from '~/components/Website/Section/Video.vue'
import SectionMap from '~/components/Website/Section/Map.vue'
import SectionContactForm from '~/components/Website/Section/ContactForm.vue'
import SectionBlogLatest from '~/components/Website/Section/BlogLatest.vue'
import SectionStorefrontProducts from '~/components/Website/Section/StorefrontProducts.vue'
import SectionHtml from '~/components/Website/Section/Html.vue'
import SectionDivider from '~/components/Website/Section/Divider.vue'

/**
 * Renderiza el arreglo de secciones de una página. Es el mismo componente
 * que usa la vista previa del editor, así que lo que se ve al editar es
 * exactamente lo que se publica.
 */
interface Props {
  sections: WebsiteSection[]
  pageId?: string | null
  /** En el editor: resalta la sección seleccionada y permite elegirla con clic. */
  editable?: boolean
  selectedId?: string | null
}

const props = withDefaults(defineProps<Props>(), { pageId: null, editable: false, selectedId: null })

const emit = defineEmits<{ select: [id: string] }>()

const COMPONENTS = {
  hero: SectionHero,
  text: SectionText,
  image_text: SectionImageText,
  features: SectionFeatures,
  stats: SectionStats,
  gallery: SectionGallery,
  testimonials: SectionTestimonials,
  pricing: SectionPricing,
  faq: SectionFaq,
  team: SectionTeam,
  cta: SectionCta,
  logos: SectionLogos,
  video: SectionVideo,
  map: SectionMap,
  contact_form: SectionContactForm,
  blog_latest: SectionBlogLatest,
  storefront_products: SectionStorefrontProducts,
  html: SectionHtml,
  divider: SectionDivider
} as const

const visibleSections = computed(() => props.sections.filter(s => props.editable || !s.hidden))

const wrapperClasses = (section: WebsiteSection): string[] => [
  `ws-bg-${section.style.background}`,
  section.type === 'divider' ? '' : `ws-pad-${section.style.padding}`,
  section.style.align === 'center' ? 'text-center' : '',
  props.editable ? 'relative cursor-pointer transition-shadow' : '',
  props.editable && props.selectedId === section.id ? 'ring-2 ring-inset ring-indigo-500' : '',
  props.editable && section.hidden ? 'opacity-40' : ''
]
</script>

<template>
  <div>
    <section
      v-for="section in visibleSections"
      :id="`section-${section.id}`"
      :key="section.id"
      :class="wrapperClasses(section)"
      @click="editable && emit('select', section.id)"
    >
      <span
        v-if="editable && section.hidden"
        class="absolute top-2 left-2 z-10 text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-white px-2 py-0.5 rounded"
      >
        Oculta
      </span>
      <component :is="COMPONENTS[section.type]" :section="section" :page-id="pageId" />
    </section>
    <div v-if="!visibleSections.length && editable" class="py-24 text-center sf-muted text-sm">
      Esta página no tiene secciones. Agrega la primera desde el panel izquierdo.
    </div>
  </div>
</template>
