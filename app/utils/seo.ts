// Constructores de datos estructurados (schema.org / JSON-LD) para las páginas
// públicas. Funciones puras: reciben la URL base para no depender de Nuxt.

export interface BreadcrumbItem {
  name: string
  /** Ruta relativa al sitio, p. ej. '/funcionalidades'. */
  path: string
}

export interface FaqItem {
  question: string
  answer: string
}

type JsonLdNode = Record<string, unknown>

export function breadcrumbJsonLd(siteUrl: string, items: BreadcrumbItem[]): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.path === '/' ? siteUrl : `${siteUrl}${item.path}`
    }))
  }
}

export function faqJsonLd(faqs: FaqItem[]): JsonLdNode {
  return {
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer }
    }))
  }
}

/** Nodo de la organización; las demás piezas la referencian por @id. */
export function organizationJsonLd(siteUrl: string): JsonLdNode {
  return {
    '@type': 'Organization',
    '@id': `${siteUrl}/#organization`,
    name: 'Flowbit',
    alternateName: 'Flowbit ERP',
    url: siteUrl,
    logo: `${siteUrl}/icon-512.png`,
    description: 'ERP open source en español hecho para México.',
    areaServed: { '@type': 'Country', name: 'México' },
    sameAs: ['https://github.com/Caribbean-Digital-Group/flowbit']
  }
}

/** Serializa un grafo JSON-LD escapando `<` para que no cierre la etiqueta <script>. */
export function serializeJsonLd(nodes: JsonLdNode[]): string {
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }).replace(/</g, '\\u003c')
}
