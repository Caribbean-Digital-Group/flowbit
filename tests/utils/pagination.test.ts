import { describe, expect, it } from 'vitest'
import { fetchAllRows, SUPABASE_PAGE_SIZE } from '../../app/utils/pagination'

/** Simula una tabla de `total` filas servida por bloques con `.range(from, to)`. */
const fakeTable = (total: number, cap = SUPABASE_PAGE_SIZE) => {
  const calls: Array<[number, number]> = []
  const fetchPage = async (from: number, to: number) => {
    calls.push([from, to])
    const end = Math.min(to + 1, total, from + cap)
    const data = Array.from({ length: Math.max(0, end - from) }, (_, i) => ({ id: from + i }))
    return { data, error: null }
  }
  return { calls, fetchPage }
}

describe('fetchAllRows', () => {
  it('lee una tabla pequeña en un solo bloque', async () => {
    const { calls, fetchPage } = fakeTable(10)
    const r = await fetchAllRows(fetchPage)
    expect(r.data).toHaveLength(10)
    expect(r.truncated).toBe(false)
    expect(calls).toEqual([[0, 999]])
  })

  it('une varios bloques sin repetir ni saltar filas', async () => {
    const { calls, fetchPage } = fakeTable(2500)
    const r = await fetchAllRows(fetchPage)
    expect(r.data).toHaveLength(2500)
    expect(r.data.map(row => row.id)).toEqual(Array.from({ length: 2500 }, (_, i) => i))
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })

  it('pide un bloque extra vacío cuando el total es múltiplo exacto del bloque', async () => {
    const { calls, fetchPage } = fakeTable(2000)
    const r = await fetchAllRows(fetchPage)
    expect(r.data).toHaveLength(2000)
    expect(r.truncated).toBe(false)
    expect(calls).toHaveLength(3)
  })

  it('devuelve lo leído y el error si un bloque falla', async () => {
    let call = 0
    const r = await fetchAllRows(async () => {
      call += 1
      if (call === 2) return { data: null, error: { message: 'timeout' } }
      return { data: Array.from({ length: 3 }, (_, i) => i), error: null }
    }, { pageSize: 3 })
    expect(r.error).toEqual({ message: 'timeout' })
    expect(r.data).toHaveLength(3)
  })

  it('se detiene en el tope y lo marca como truncado', async () => {
    const { calls, fetchPage } = fakeTable(10000)
    const r = await fetchAllRows(fetchPage, { maxRows: 2500 })
    expect(r.data).toHaveLength(2500)
    expect(r.truncated).toBe(true)
    expect(calls.at(-1)).toEqual([2000, 2499])
  })

  it('trata data null como bloque vacío', async () => {
    const r = await fetchAllRows(async () => ({ data: null, error: null }))
    expect(r).toEqual({ data: [], error: null, truncated: false })
  })
})
