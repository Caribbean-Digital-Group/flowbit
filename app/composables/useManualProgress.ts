/**
 * Progreso local del manual: pasos completados de cada guía, artículos leídos,
 * favoritos y recientes. Vive en localStorage porque es una preferencia de
 * lectura por persona y dispositivo, no información de negocio.
 */

const STORAGE_KEY = 'flowbit:manual-progress'
const MAX_RECENT = 8

interface ManualProgressState {
  /** Ids de pasos completados por guía: { 'wz-onboarding': ['company', 'contacts'] } */
  wizardSteps: Record<string, string[]>
  readArticles: string[]
  favorites: string[]
  recent: string[]
  /** El asistente Bit ya fue abierto al menos una vez. */
  assistantSeen: boolean
}

function emptyState(): ManualProgressState {
  return { wizardSteps: {}, readArticles: [], favorites: [], recent: [], assistantSeen: false }
}

function loadState(): ManualProgressState {
  if (import.meta.server) return emptyState()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as Partial<ManualProgressState>
    return {
      wizardSteps: parsed.wizardSteps ?? {},
      readArticles: parsed.readArticles ?? [],
      favorites: parsed.favorites ?? [],
      recent: parsed.recent ?? [],
      assistantSeen: parsed.assistantSeen ?? false
    }
  } catch (error) {
    console.error('Error leyendo el progreso del manual:', error)
    return emptyState()
  }
}

export const useManualProgress = () => {
  // useState comparte el mismo estado entre el manual, el asistente y las páginas públicas.
  const state = useState<ManualProgressState>('manual-progress', emptyState)
  const hydrated = useState<boolean>('manual-progress-hydrated', () => false)

  const persist = () => {
    if (import.meta.server) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.value))
    } catch (error) {
      console.error('Error guardando el progreso del manual:', error)
    }
  }

  /** Carga el progreso una sola vez en el cliente (evita desajustes de hidratación). */
  const hydrate = () => {
    if (import.meta.server || hydrated.value) return
    state.value = loadState()
    hydrated.value = true
  }

  // ── Guías paso a paso ──────────────────────────────────────────────────────

  const completedSteps = (wizardId: string): string[] => state.value.wizardSteps[wizardId] ?? []

  const isStepDone = (wizardId: string, stepId: string): boolean =>
    completedSteps(wizardId).includes(stepId)

  const toggleStep = (wizardId: string, stepId: string) => {
    const current = completedSteps(wizardId)
    state.value.wizardSteps = {
      ...state.value.wizardSteps,
      [wizardId]: current.includes(stepId)
        ? current.filter(id => id !== stepId)
        : [...current, stepId]
    }
    persist()
  }

  const markStepDone = (wizardId: string, stepId: string) => {
    if (isStepDone(wizardId, stepId)) return
    toggleStep(wizardId, stepId)
  }

  const resetWizard = (wizardId: string) => {
    const { [wizardId]: _removed, ...rest } = state.value.wizardSteps
    state.value.wizardSteps = rest
    persist()
  }

  /** Porcentaje completado de una guía, de 0 a 100. */
  const wizardProgress = (wizardId: string, totalSteps: number): number => {
    if (totalSteps === 0) return 0
    const done = completedSteps(wizardId).length
    return Math.min(100, Math.round((done / totalSteps) * 100))
  }

  // ── Lectura, favoritos y recientes ─────────────────────────────────────────

  const isRead = (articleId: string): boolean => state.value.readArticles.includes(articleId)

  const toggleRead = (articleId: string) => {
    state.value.readArticles = isRead(articleId)
      ? state.value.readArticles.filter(id => id !== articleId)
      : [...state.value.readArticles, articleId]
    persist()
  }

  const isFavorite = (articleId: string): boolean => state.value.favorites.includes(articleId)

  const toggleFavorite = (articleId: string) => {
    state.value.favorites = isFavorite(articleId)
      ? state.value.favorites.filter(id => id !== articleId)
      : [...state.value.favorites, articleId]
    persist()
  }

  const trackVisit = (articleId: string) => {
    state.value.recent = [articleId, ...state.value.recent.filter(id => id !== articleId)].slice(0, MAX_RECENT)
    persist()
  }

  const markAssistantSeen = () => {
    if (state.value.assistantSeen) return
    state.value.assistantSeen = true
    persist()
  }

  const clearProgress = () => {
    state.value = emptyState()
    persist()
  }

  return {
    state: readonly(state),
    hydrate,
    completedSteps,
    isStepDone,
    toggleStep,
    markStepDone,
    resetWizard,
    wizardProgress,
    isRead,
    toggleRead,
    isFavorite,
    toggleFavorite,
    trackVisit,
    markAssistantSeen,
    clearProgress,
    favorites: computed(() => state.value.favorites),
    recent: computed(() => state.value.recent),
    readArticles: computed(() => state.value.readArticles),
    assistantSeen: computed(() => state.value.assistantSeen)
  }
}
