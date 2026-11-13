/**
 * Utilidades de búsqueda de texto compartidas por la paleta de comandos y los composables.
 * Puras y probadas en `tests/utils/search.test.ts`.
 */

/** Minúsculas, sin acentos y con espacios compactados: «Configuración » → «configuracion». */
export const normalizeSearch = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Prepara un término para un patrón `ilike` de PostgREST dentro de `.or(...)`:
 * escapa los comodines `\`, `%` y `_`, y quita los caracteres que rompen la
 * sintaxis del filtro (`,` `(` `)` `"`). Limita la longitud a 160 caracteres.
 */
export const escapeIlikeTerm = (raw: string): string =>
  raw
    .trim()
    .slice(0, 160)
    .replace(/[,()"]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')

/**
 * Puntúa qué tan bien coincide `query` con `target` (ambos se normalizan).
 * Todas las palabras de la búsqueda deben aparecer. Devuelve 0 si no coincide.
 * Mayor puntaje = mejor coincidencia (prefijo completo > inicio de palabra > subcadena).
 */
export const scoreMatch = (query: string, target: string): number => {
  const q = normalizeSearch(query)
  if (!q) return 1
  const t = normalizeSearch(target)
  if (!t) return 0

  let score = 0
  for (const token of q.split(' ')) {
    const index = t.indexOf(token)
    if (index === -1) return 0
    if (index === 0) score += 30
    else if (t[index - 1] === ' ' || t[index - 1] === '/' || t[index - 1] === '-') score += 20
    else score += 10
  }
  if (t === q) score += 50
  else if (t.startsWith(q)) score += 25
  // Ligera preferencia por textos cortos (más específicos)
  return score + Math.max(0, 10 - Math.floor(t.length / 8))
}

export interface SearchableItem {
  title: string
  /** Texto adicional que también se busca (grupo, sinónimos). */
  keywords?: string
}

/**
 * Filtra y ordena por relevancia. El título pesa más que las palabras clave.
 * Con búsqueda vacía devuelve los primeros `limit` en su orden original.
 */
export const filterByQuery = <T extends SearchableItem>(items: T[], query: string, limit = 50): T[] => {
  if (!normalizeSearch(query)) return items.slice(0, limit)
  return items
    .map((item, index) => {
      const byTitle = scoreMatch(query, item.title) * 2
      const byAll = scoreMatch(query, `${item.title} ${item.keywords ?? ''}`)
      return { item, index, score: Math.max(byTitle, byAll) }
    })
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(entry => entry.item)
}
