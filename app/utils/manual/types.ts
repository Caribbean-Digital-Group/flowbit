// Modelo de contenido del sistema Manual → Documentación → Asistente Bit → Compartir.
// Los artículos son datos puros (sin dependencias de Vue) para poder consumirse
// tanto desde el panel admin como desde la documentación pública (/help).

export interface DocField {
  label: string
  required: boolean
  type: 'text' | 'select' | 'date' | 'number' | 'textarea' | 'boolean' | 'relation'
  description: string
  tip?: string
}

export interface ProcessStep {
  step: number
  title: string
  description: string
}

/** Paso de un wizard interactivo: el usuario lo marca conforme avanza. */
export interface WizardStep {
  id: string
  title: string
  description: string
  /** Acción sugerida que lleva al usuario a la vista donde se ejecuta el paso. */
  action?: { label: string; route: string }
  /** Sub-tareas verificables dentro del paso. */
  checklist?: string[]
  tip?: string
  warning?: string
}

export interface DocWizard {
  id: string
  title: string
  description: string
  estimatedMinutes: number
  steps: WizardStep[]
}

export interface DocFaq {
  question: string
  answer: string
}

export interface DocShortcut {
  keys: string
  action: string
}

export type DocLevel = 'basico' | 'intermedio' | 'avanzado'

export type DocViewType =
  | 'list'
  | 'create'
  | 'detail'
  | 'scan'
  | 'dashboard'
  | 'config'
  | 'team'
  | 'terminal'
  | 'public'
  | 'analytics'

export interface DocArticle {
  id: string
  routePatterns: string[]
  module: string
  moduleLabel: string
  moduleEmoji: string
  title: string
  description: string
  importance: string
  viewType: DocViewType
  tips: string[]
  fields?: DocField[]
  process?: ProcessStep[]
  relatedModules?: { label: string; route: string }[]
  tags?: string[]
  /** Frase corta y autoconclusiva: es lo que se comparte en redes y el meta description. */
  summary?: string
  level?: DocLevel
  /** Guía paso a paso interactiva para completar el flujo de esta vista. */
  wizard?: DocWizard
  faqs?: DocFaq[]
  shortcuts?: DocShortcut[]
  /** Ids de otros artículos con contenido complementario. */
  relatedArticles?: string[]
  /** Marca el artículo como novedad reciente en el manual y el asistente. */
  isNew?: boolean
}

export interface DocModule {
  id: string
  label: string
  emoji: string
  description: string
  accent: ModuleAccent
  articles: DocArticle[]
}

export type ModuleAccent = 'indigo' | 'sky' | 'emerald' | 'violet' | 'fuchsia' | 'orange' | 'amber' | 'slate'

export interface ModuleMeta {
  id: string
  label: string
  emoji: string
  description: string
  accent: ModuleAccent
}

/** Recorrido curado que encadena artículos de varios módulos. */
export interface LearningPath {
  id: string
  title: string
  emoji: string
  description: string
  estimatedMinutes: number
  level: DocLevel
  accent: ModuleAccent
  /** Ids de artículos en el orden en que conviene leerlos. */
  articleIds: string[]
}

/** Sección compartible de un artículo (usada por los botones copiar/compartir). */
export interface ShareableSection {
  id: string
  label: string
  /** Texto plano listo para pegarse en WhatsApp, X o LinkedIn. */
  text: string
}
