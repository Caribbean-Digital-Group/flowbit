/**
 * Escape de HTML para documentos que se arman como texto.
 *
 * Los documentos imprimibles (ticket del POS, cortes de caja, valuación de
 * almacén, estado de cuenta) se escriben con `document.write` o en una URL
 * `blob:`. Ambas heredan el origen del panel, así que cualquier dato capturado
 * por usuarios —nombre de producto, cliente, empresa, motivo— debe pasar por
 * `escapeHtml` antes de interpolarse. Sin eso, un nombre como
 * `<img src=x onerror=...>` se ejecuta con la sesión de quien imprime.
 */

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  '\'': '&#39;'
}

/** Convierte cualquier valor en texto seguro para contenido o atributos HTML. */
export const escapeHtml = (value: string | number | null | undefined): string =>
  String(value ?? '').replace(/[&<>"']/g, ch => HTML_ESCAPES[ch] ?? ch)

/**
 * Devuelve la URL solo si es `http(s)` o `data:image/...`, ya escapada para un
 * atributo. Cualquier otro esquema (`javascript:`, `vbscript:`…) devuelve `''`.
 */
export const safeImageUrl = (value: string | null | undefined): string => {
  const url = String(value ?? '').trim()
  if (!url) return ''
  if (/^https?:\/\//i.test(url) || /^data:image\/(png|jpe?g|gif|webp|svg\+xml);/i.test(url)) {
    return escapeHtml(url)
  }
  return ''
}
