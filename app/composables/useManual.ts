import { ARTICLES } from '~/utils/manual/articles'
import { LEARNING_PATHS, MODULE_META } from '~/utils/manual/paths'
import type {
  DocArticle,
  DocLevel,
  DocModule,
  DocViewType,
  LearningPath,
  ModuleAccent
} from '~/utils/manual/types'

export type {
  DocArticle,
  DocField,
  DocFaq,
  DocLevel,
  DocModule,
  DocShortcut,
  DocViewType,
  DocWizard,
  LearningPath,
  ModuleAccent,
  ModuleMeta,
  ProcessStep,
  ShareableSection,
  WizardStep
} from '~/utils/manual/types'

/**
 * Puntúa qué tan específico es un patrón de ruta frente a una ruta real.
 * Un segmento estático vale más que uno dinámico, de modo que
 * `/admin/crm/leads/create` gana sobre `/admin/crm/leads/:id`.
 */
function matchRoutePattern(path: string, pattern: string): number {
  const regexStr = '^' + pattern.replace(/:[^/]+/g, '[^/]+') + '/?$'
  if (!new RegExp(regexStr).test(path)) return -1

  const segments = pattern.split('/').filter(Boolean)
  const staticSegments = segments.filter(s => !s.startsWith(':')).length
  return segments.length * 10 + staticSegments
}

/** Normaliza texto para buscar sin acentos ni mayúsculas. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const LEVEL_LABELS: Record<DocLevel, string> = {
  basico: 'Básico',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado'
}

const VIEW_TYPE_LABELS: Record<DocViewType, string> = {
  list: 'Listado',
  create: 'Formulario',
  detail: 'Detalle',
  scan: 'Escaneo',
  dashboard: 'Panel',
  config: 'Configuración',
  team: 'Equipo',
  terminal: 'Terminal',
  public: 'Vista pública',
  analytics: 'Analítica'
}

const VIEW_TYPE_CLASSES: Record<DocViewType, string> = {
  list: 'bg-blue-100 text-blue-700',
  create: 'bg-green-100 text-green-700',
  detail: 'bg-violet-100 text-violet-700',
  scan: 'bg-amber-100 text-amber-700',
  dashboard: 'bg-indigo-100 text-indigo-700',
  config: 'bg-slate-100 text-slate-700',
  team: 'bg-fuchsia-100 text-fuchsia-700',
  terminal: 'bg-rose-100 text-rose-700',
  public: 'bg-teal-100 text-teal-700',
  analytics: 'bg-cyan-100 text-cyan-700'
}

const LEVEL_CLASSES: Record<DocLevel, string> = {
  basico: 'bg-emerald-100 text-emerald-700',
  intermedio: 'bg-amber-100 text-amber-700',
  avanzado: 'bg-rose-100 text-rose-700'
}

/** Clases de acento por módulo, para mantener una identidad visual consistente. */
export const ACCENT_CLASSES: Record<ModuleAccent, { text: string; bg: string; border: string; gradient: string; ring: string }> = {
  indigo: { text: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', gradient: 'from-indigo-500 to-violet-600', ring: 'ring-indigo-200' },
  sky: { text: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200', gradient: 'from-sky-500 to-blue-600', ring: 'ring-sky-200' },
  emerald: { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', gradient: 'from-emerald-500 to-teal-600', ring: 'ring-emerald-200' },
  violet: { text: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200', gradient: 'from-violet-500 to-purple-600', ring: 'ring-violet-200' },
  fuchsia: { text: 'text-fuchsia-600', bg: 'bg-fuchsia-50', border: 'border-fuchsia-200', gradient: 'from-fuchsia-500 to-pink-600', ring: 'ring-fuchsia-200' },
  orange: { text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', gradient: 'from-orange-500 to-amber-600', ring: 'ring-orange-200' },
  amber: { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', gradient: 'from-amber-500 to-orange-600', ring: 'ring-amber-200' },
  slate: { text: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', gradient: 'from-slate-500 to-slate-700', ring: 'ring-slate-200' }
}

const MODULE_INDEX = new Map(MODULE_META.map((m, i) => [m.id, { meta: m, order: i }]))
const ARTICLE_INDEX = new Map(ARTICLES.map(a => [a.id, a]))

/** Minutos estimados de lectura a partir del volumen de contenido del artículo. */
function estimateReadMinutes(article: DocArticle): number {
  const words =
    `${article.description} ${article.importance} ${article.tips.join(' ')}`.split(/\s+/).length +
    (article.fields?.length ?? 0) * 25 +
    (article.faqs?.length ?? 0) * 40 +
    (article.wizard?.steps.length ?? 0) * 35
  return Math.max(1, Math.round(words / 180))
}

export const useManual = () => {
  /** Artículo que documenta la ruta indicada, eligiendo siempre el patrón más específico. */
  const getContextForRoute = (path: string): DocArticle | undefined => {
    let bestMatch: DocArticle | undefined
    let bestScore = 0

    for (const article of ARTICLES) {
      for (const pattern of article.routePatterns) {
        const score = matchRoutePattern(path, pattern)
        if (score > bestScore) {
          bestScore = score
          bestMatch = article
        }
      }
    }
    return bestMatch
  }

  /** Búsqueda ponderada: el título pesa más que las etiquetas y estas más que el cuerpo. */
  const searchArticles = (query: string): DocArticle[] => {
    const q = normalize(query.trim())
    if (!q) return ARTICLES

    const terms = q.split(/\s+/).filter(Boolean)

    const scored = ARTICLES.map(article => {
      const title = normalize(article.title)
      const tags = normalize((article.tags ?? []).join(' '))
      const moduleLabel = normalize(article.moduleLabel)
      const body = normalize(
        [
          article.description,
          article.importance,
          article.summary ?? '',
          article.tips.join(' '),
          (article.fields ?? []).map(f => `${f.label} ${f.description}`).join(' '),
          (article.faqs ?? []).map(f => `${f.question} ${f.answer}`).join(' '),
          (article.shortcuts ?? []).map(s => `${s.keys} ${s.action}`).join(' '),
          article.wizard ? `${article.wizard.title} ${article.wizard.steps.map(s => `${s.title} ${s.description}`).join(' ')}` : ''
        ].join(' ')
      )

      let score = 0
      for (const term of terms) {
        if (title === term) score += 120
        else if (title.startsWith(term)) score += 70
        else if (title.includes(term)) score += 50
        if (tags.includes(term)) score += 25
        if (moduleLabel.includes(term)) score += 15
        if (body.includes(term)) score += 8
      }
      return { article, score }
    })

    return scored
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(entry => entry.article)
  }

  /** Módulos ordenados según MODULE_META, con sus artículos en el orden del catálogo. */
  const modules = computed((): DocModule[] => {
    const grouped = new Map<string, DocArticle[]>()
    for (const article of ARTICLES) {
      const list = grouped.get(article.module) ?? []
      list.push(article)
      grouped.set(article.module, list)
    }

    return [...grouped.entries()]
      .map(([id, articles]) => {
        const entry = MODULE_INDEX.get(id)
        const first = articles[0]
        return {
          module: {
            id,
            label: entry?.meta.label ?? first?.moduleLabel ?? id,
            emoji: entry?.meta.emoji ?? first?.moduleEmoji ?? '📄',
            description: entry?.meta.description ?? '',
            accent: entry?.meta.accent ?? 'slate',
            articles
          } satisfies DocModule,
          order: entry?.order ?? 999
        }
      })
      .sort((a, b) => a.order - b.order)
      .map(entry => entry.module)
  })

  const getArticleById = (id: string): DocArticle | undefined => ARTICLE_INDEX.get(id)

  const getModuleAccent = (moduleId: string): ModuleAccent =>
    MODULE_INDEX.get(moduleId)?.meta.accent ?? 'slate'

  /** Artículos relacionados: los declarados explícitamente y, si faltan, los del mismo módulo. */
  const getRelatedArticles = (article: DocArticle, limit = 4): DocArticle[] => {
    const explicit = (article.relatedArticles ?? [])
      .map(id => ARTICLE_INDEX.get(id))
      .filter((a): a is DocArticle => Boolean(a) && a!.id !== article.id)

    if (explicit.length >= limit) return explicit.slice(0, limit)

    const sameModule = ARTICLES.filter(
      a => a.module === article.module && a.id !== article.id && !explicit.some(e => e.id === a.id)
    )
    return [...explicit, ...sameModule].slice(0, limit)
  }

  /** Artículo anterior y siguiente dentro del mismo módulo, para navegación secuencial. */
  const getArticleNeighbors = (articleId: string): { prev?: DocArticle; next?: DocArticle } => {
    const flat = modules.value.flatMap(m => m.articles)
    const index = flat.findIndex(a => a.id === articleId)
    if (index === -1) return {}
    return { prev: flat[index - 1], next: flat[index + 1] }
  }

  /** Todos los artículos que incluyen una guía interactiva. */
  const wizardArticles = computed((): DocArticle[] => ARTICLES.filter(a => Boolean(a.wizard)))

  /** Artículos marcados como novedad, para destacar lo recién documentado. */
  const newArticles = computed((): DocArticle[] => ARTICLES.filter(a => a.isNew))

  const learningPaths = computed((): LearningPath[] => LEARNING_PATHS)

  const getPathArticles = (path: LearningPath): DocArticle[] =>
    path.articleIds.map(id => ARTICLE_INDEX.get(id)).filter((a): a is DocArticle => Boolean(a))

  const levelLabel = (level?: DocLevel): string => LEVEL_LABELS[level ?? 'basico']
  const levelClass = (level?: DocLevel): string => LEVEL_CLASSES[level ?? 'basico']
  const viewTypeLabel = (type: DocViewType): string => VIEW_TYPE_LABELS[type] ?? type
  const viewTypeClass = (type: DocViewType): string => VIEW_TYPE_CLASSES[type] ?? 'bg-slate-100 text-slate-700'
  const readMinutes = (article: DocArticle): number => estimateReadMinutes(article)

  return {
    articles: ARTICLES,
    modules,
    learningPaths,
    wizardArticles,
    newArticles,
    getContextForRoute,
    searchArticles,
    getArticleById,
    getRelatedArticles,
    getArticleNeighbors,
    getModuleAccent,
    getPathArticles,
    levelLabel,
    levelClass,
    viewTypeLabel,
    viewTypeClass,
    readMinutes
  }
}
