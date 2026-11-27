/**
 * Fechas de calendario en la hora local del navegador.
 *
 * `new Date().toISOString().slice(0, 10)` devuelve la fecha en UTC: en México
 * (UTC−6) cambia a las 18:00, así que por la tarde «hoy» sale como mañana.
 * Para cualquier fecha de calendario que ve o captura el usuario (fecha de una
 * orden, de un cobro, el «hoy» de la agenda) usa estos helpers.
 */

/** `YYYY-MM-DD` de un `Date` en la hora local. Por defecto, hoy. */
export const localDateKey = (date: Date = new Date()): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

/** `YYYY-MM-DD` del primer día del mes `monthOffset` meses antes o después del de `date`. */
export const localMonthStartKey = (monthOffset = 0, date: Date = new Date()): string =>
  localDateKey(new Date(date.getFullYear(), date.getMonth() + monthOffset, 1))
