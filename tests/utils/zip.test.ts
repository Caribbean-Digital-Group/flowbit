import { describe, expect, it } from 'vitest'
import { crc32, createZip, normalizeZipPath, toDosDateTime } from '../../app/utils/zip'

const readU32 = (bytes: Uint8Array, offset: number) =>
  new DataView(bytes.buffer, bytes.byteOffset).getUint32(offset, true)
const readU16 = (bytes: Uint8Array, offset: number) =>
  new DataView(bytes.buffer, bytes.byteOffset).getUint16(offset, true)

describe('crc32', () => {
  it('coincide con los valores de referencia', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
    expect(crc32(new Uint8Array())).toBe(0)
  })
})

describe('toDosDateTime', () => {
  it('codifica fecha y hora con resolución de 2 segundos', () => {
    const dos = toDosDateTime(new Date(2026, 10, 17, 9, 30, 15))
    expect(dos.date).toBe(((2026 - 1980) << 9) | (11 << 5) | 17)
    expect(dos.time).toBe((9 << 11) | (30 << 5) | 7)
  })

  it('no baja de 1980', () => {
    expect(toDosDateTime(new Date(1970, 0, 1)).date >> 9).toBe(0)
  })
})

describe('normalizeZipPath', () => {
  it('quita separadores de Windows, barras iniciales y segmentos ..', () => {
    expect(normalizeZipPath('\\ventas\\ordenes.csv')).toBe('ventas/ordenes.csv')
    expect(normalizeZipPath('../../etc/passwd')).toBe('etc/passwd')
    expect(normalizeZipPath('/a/./b.csv')).toBe('a/b.csv')
  })
})

describe('createZip', () => {
  const date = new Date(2026, 10, 17, 10, 0, 0)

  it('arma un ZIP válido con encabezados locales, directorio central y fin', () => {
    const zip = createZip([
      { name: 'LEEME.txt', content: 'hola', date },
      { name: 'ventas/órdenes.csv', content: 'id\r\n1', date }
    ])

    expect(readU32(zip, 0)).toBe(0x04034b50)
    const end = zip.length - 22
    expect(readU32(zip, end)).toBe(0x06054b50)
    expect(readU16(zip, end + 8)).toBe(2)
    const centralSize = readU32(zip, end + 12)
    const centralOffset = readU32(zip, end + 16)
    expect(centralOffset + centralSize).toBe(end)
    expect(readU32(zip, centralOffset)).toBe(0x02014b50)
  })

  it('guarda el contenido sin comprimir, con CRC y nombre UTF-8', () => {
    const zip = createZip([{ name: 'ventas/órdenes.csv', content: 'id\r\n1', date }])
    const nameLength = readU16(zip, 26)
    const name = new TextDecoder().decode(zip.slice(30, 30 + nameLength))
    expect(name).toBe('ventas/órdenes.csv')
    expect(readU16(zip, 6) & 0x0800).toBe(0x0800)
    expect(readU16(zip, 8)).toBe(0)
    const size = readU32(zip, 18)
    const data = zip.slice(30 + nameLength, 30 + nameLength + size)
    expect(new TextDecoder().decode(data)).toBe('id\r\n1')
    expect(readU32(zip, 14)).toBe(crc32(data))
  })

  it('rechaza nombres vacíos o repetidos', () => {
    expect(() => createZip([{ name: '../', content: 'x' }])).toThrow()
    expect(() => createZip([
      { name: 'a.csv', content: 'x' },
      { name: '/a.csv', content: 'y' }
    ])).toThrow(/repetido/)
  })

  it('acepta un ZIP vacío', () => {
    const zip = createZip([])
    expect(zip.length).toBe(22)
    expect(readU32(zip, 0)).toBe(0x06054b50)
  })
})
