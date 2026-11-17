/**
 * Escritor ZIP mínimo, sin dependencias, para exportaciones del navegador.
 *
 * - Método «store» (sin compresión): los CSV de una empresa pesan poco y así
 *   no hace falta una librería de deflate. Cualquier descompresor lo abre
 *   (Windows, macOS, Linux, `unzip`).
 * - Nombres en UTF-8 (bit 11 de los flags), para que los acentos se vean bien.
 * - Sin ZIP64: cada archivo y el ZIP completo deben pesar menos de 4 GiB.
 */

export interface ZipEntry {
  /** Ruta dentro del ZIP, con `/` como separador (ej. `ventas/ordenes.csv`). */
  name: string
  content: string | Uint8Array
  /** Fecha de modificación que se guarda en el ZIP. Por omisión, ahora. */
  date?: Date
}

const ZIP_MAX_SIZE = 0xffffffff
const ZIP_MAX_ENTRIES = 0xffff

let crcTable: Uint32Array | null = null

const getCrcTable = (): Uint32Array => {
  if (crcTable) return crcTable
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  crcTable = table
  return table
}

/** CRC-32 (IEEE 802.3), el que exige el formato ZIP. */
export const crc32 = (data: Uint8Array): number => {
  const table = getCrcTable()
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** Fecha y hora en formato MS-DOS (resolución de 2 segundos, desde 1980). */
export const toDosDateTime = (date: Date): { time: number; date: number } => {
  const year = Math.min(Math.max(date.getFullYear(), 1980), 2107)
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  }
}

/** Normaliza la ruta: separador `/`, sin `/` inicial ni segmentos `..`. */
export const normalizeZipPath = (name: string): string => {
  const parts = name
    .replace(/\\/g, '/')
    .split('/')
    .filter(part => part !== '' && part !== '.' && part !== '..')
  return parts.join('/')
}

/** Arma un archivo ZIP en memoria. */
export const createZip = (entries: ZipEntry[]): Uint8Array => {
  if (entries.length > ZIP_MAX_ENTRIES) {
    throw new Error(`Un ZIP sin ZIP64 admite hasta ${ZIP_MAX_ENTRIES} archivos.`)
  }

  const encoder = new TextEncoder()
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  const usedNames = new Set<string>()
  let offset = 0

  for (const entry of entries) {
    const name = normalizeZipPath(entry.name)
    if (!name) throw new Error('Cada archivo del ZIP necesita un nombre.')
    if (usedNames.has(name)) throw new Error(`Nombre repetido en el ZIP: ${name}`)
    usedNames.add(name)

    const nameBytes = encoder.encode(name)
    const data = typeof entry.content === 'string' ? encoder.encode(entry.content) : entry.content
    if (data.length > ZIP_MAX_SIZE) throw new Error(`El archivo ${name} es demasiado grande para un ZIP.`)

    const crc = crc32(data)
    const dos = toDosDateTime(entry.date ?? new Date())

    const local = new Uint8Array(30 + nameBytes.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true) // firma de encabezado local
    lv.setUint16(4, 20, true) // versión necesaria (2.0)
    lv.setUint16(6, 0x0800, true) // flags: nombres en UTF-8
    lv.setUint16(8, 0, true) // método: store
    lv.setUint16(10, dos.time, true)
    lv.setUint16(12, dos.date, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, data.length, true) // tamaño comprimido
    lv.setUint32(22, data.length, true) // tamaño original
    lv.setUint16(26, nameBytes.length, true)
    lv.setUint16(28, 0, true) // campo extra
    local.set(nameBytes, 30)

    const central = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true) // firma del directorio central
    cv.setUint16(4, 20, true) // versión con que se creó
    cv.setUint16(6, 20, true) // versión necesaria
    cv.setUint16(8, 0x0800, true)
    cv.setUint16(10, 0, true)
    cv.setUint16(12, dos.time, true)
    cv.setUint16(14, dos.date, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, data.length, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint16(30, 0, true) // extra
    cv.setUint16(32, 0, true) // comentario
    cv.setUint16(34, 0, true) // disco
    cv.setUint16(36, 0, true) // atributos internos
    cv.setUint32(38, 0, true) // atributos externos
    cv.setUint32(42, offset, true) // posición del encabezado local
    central.set(nameBytes, 46)

    localParts.push(local, data)
    centralParts.push(central)
    offset += local.length + data.length
    if (offset > ZIP_MAX_SIZE) throw new Error('La exportación supera el tamaño máximo de un ZIP (4 GiB).')
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true) // firma de fin de directorio central
  ev.setUint16(4, 0, true)
  ev.setUint16(6, 0, true)
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)
  ev.setUint16(20, 0, true)

  const output = new Uint8Array(offset + centralSize + end.length)
  let position = 0
  for (const part of [...localParts, ...centralParts, end]) {
    output.set(part, position)
    position += part.length
  }
  return output
}
