/**
 * Lectura completa de consultas de Supabase por bloques.
 *
 * PostgREST corta cada respuesta en `max_rows` filas (1000 en Supabase Cloud y en
 * `supabase/config.toml`). Una consulta sin `.range()` sobre una tabla grande
 * devuelve solo las primeras 1000 filas, sin error ni aviso. `fetchAllRows` pide
 * bloques consecutivos con `.range(from, to)` hasta recibir un bloque incompleto.
 *
 * Reglas para usarlo:
 * - `fetchPage` debe construir la consulta desde cero en cada llamada: los builders
 *   de supabase-js se modifican al encadenar métodos y no se pueden reutilizar.
 * - La consulta debe tener un orden estable (termina en una columna única, como `id`)
 *   para que los bloques no repitan ni salten filas.
 */

/** Tamaño de bloque: igual al `max_rows` de Supabase. */
export const SUPABASE_PAGE_SIZE = 1000

/** Tope de seguridad para no dejar la pestaña sin memoria con tablas enormes. */
export const FETCH_ALL_MAX_ROWS = 50000

export interface PageResult<T, E> {
  data: T[] | null
  error: E | null
}

export interface FetchAllOptions {
  pageSize?: number
  maxRows?: number
}

export interface FetchAllResult<T, E> {
  data: T[]
  error: E | null
  /** `true` si se alcanzó `maxRows` y pudo quedar información sin leer. */
  truncated: boolean
}

export const fetchAllRows = async <T, E = unknown>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T, E>>,
  options: FetchAllOptions = {}
): Promise<FetchAllResult<T, E>> => {
  const pageSize = Math.max(1, Math.floor(options.pageSize ?? SUPABASE_PAGE_SIZE))
  const maxRows = Math.max(pageSize, Math.floor(options.maxRows ?? FETCH_ALL_MAX_ROWS))
  const rows: T[] = []

  for (let from = 0; from < maxRows; from += pageSize) {
    const to = Math.min(from + pageSize, maxRows) - 1
    const { data, error } = await fetchPage(from, to)
    if (error) return { data: rows, error, truncated: false }

    const page = data ?? []
    rows.push(...page)
    if (page.length < to - from + 1) return { data: rows, error: null, truncated: false }
  }

  return { data: rows, error: null, truncated: true }
}

/**
 * Máximo de IDs por filtro `.in('id', …)`.
 *
 * PostgREST recibe el filtro en la URL de una petición GET: cada UUID suma ~37
 * caracteres. Con unos cientos de IDs la URL supera el límite del gateway y la
 * petición falla. 150 IDs dejan la URL por debajo de ~6 KB.
 */
export const IN_FILTER_CHUNK_SIZE = 150

/** Parte `items` en bloques consecutivos de `size` elementos como máximo. */
export const chunkArray = <T>(items: readonly T[], size: number): T[][] => {
  const step = Math.max(1, Math.floor(size))
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += step) chunks.push(items.slice(i, i + step))
  return chunks
}

/**
 * Lee filas por una lista de IDs arbitrariamente larga, en lotes de
 * `IN_FILTER_CHUNK_SIZE`, para no exceder el largo de URL de PostgREST.
 *
 * - Quita IDs duplicados antes de partir la lista.
 * - Los lotes se piden en secuencia; si uno falla se detiene y devuelve el error
 *   junto con las filas ya leídas.
 * - No garantiza orden entre lotes: ordena el resultado en el llamador.
 */
export const fetchByIdChunks = async <T, E = unknown>(
  ids: readonly string[],
  fetchChunk: (chunk: string[]) => PromiseLike<PageResult<T, E>>,
  chunkSize: number = IN_FILTER_CHUNK_SIZE
): Promise<{ data: T[]; error: E | null }> => {
  const rows: T[] = []
  for (const chunk of chunkArray([...new Set(ids)], chunkSize)) {
    const { data, error } = await fetchChunk(chunk)
    if (error) return { data: rows, error }
    rows.push(...(data ?? []))
  }
  return { data: rows, error: null }
}
