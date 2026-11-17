/**
 * Exportación completa de los datos de una empresa (ZIP con un CSV por entidad).
 *
 * Aquí vive solo la parte pura: el catálogo de entidades, la conversión de
 * filas a CSV y el README que acompaña al ZIP. La lectura de Supabase está en
 * `useCompanyDataExport` y el ZIP se arma con `app/utils/zip.ts`.
 *
 * Al agregar un módulo con tablas propias, súmalo a `DATA_EXPORT_ENTITIES`.
 */

import { buildCsv, CSV_BOM, type CsvCell } from './csv'

export type DataExportGroup =
  | 'general'
  | 'crm'
  | 'sales'
  | 'inventory'
  | 'projects'
  | 'pos'
  | 'approvals'
  | 'web'
  | 'hr'
  | 'payroll'

export interface DataExportEntity {
  /** Tabla o vista de Supabase. Debe tener `company_id` e `id`. */
  source: string
  /** Ruta del CSV dentro del ZIP. */
  file: string
  label: string
  group: DataExportGroup
  /** Datos personales sensibles: solo se exportan con confirmación explícita. */
  sensitive?: boolean
  /**
   * Cómo se lee: `company` (filtro por `company_id`, por omisión),
   * `partners` (contactos vía `rel_partner_company`) o `self` (la propia empresa).
   */
  strategy?: 'company' | 'partners' | 'self'
}

export const DATA_EXPORT_GROUP_LABELS: Record<DataExportGroup, string> = {
  general: 'General',
  crm: 'CRM',
  sales: 'Ventas, compras y gastos',
  inventory: 'Inventario',
  projects: 'Proyectos',
  pos: 'Punto de venta',
  approvals: 'Aprobaciones',
  web: 'Tienda en línea y sitio web',
  hr: 'Recursos Humanos',
  payroll: 'Nómina y datos privados'
}

export const DATA_EXPORT_ENTITIES: DataExportEntity[] = [
  { source: 'company', file: 'general/empresa.csv', label: 'Empresa', group: 'general', strategy: 'self' },
  { source: 'partner', file: 'general/contactos.csv', label: 'Contactos', group: 'general', strategy: 'partners' },
  { source: 'rel_partner_company', file: 'general/relaciones_contacto_empresa.csv', label: 'Relaciones contacto–empresa', group: 'general' },

  { source: 'crm_lead', file: 'crm/leads.csv', label: 'Leads', group: 'crm' },
  { source: 'crm_lead_stage', file: 'crm/etapas.csv', label: 'Etapas del pipeline', group: 'crm' },
  { source: 'crm_activity', file: 'crm/actividades.csv', label: 'Actividades', group: 'crm' },
  { source: 'crm_lost_reason', file: 'crm/motivos_perdida.csv', label: 'Motivos de pérdida', group: 'crm' },

  { source: 'order', file: 'ventas/ordenes.csv', label: 'Órdenes de venta y compra', group: 'sales' },
  { source: 'v_order_lines', file: 'ventas/lineas_orden.csv', label: 'Líneas de orden', group: 'sales' },
  { source: 'order_payment', file: 'ventas/pagos.csv', label: 'Pagos y cobros', group: 'sales' },
  { source: 'order_refund', file: 'ventas/devoluciones.csv', label: 'Devoluciones', group: 'sales' },
  { source: 'order_refund_line', file: 'ventas/lineas_devolucion.csv', label: 'Líneas de devolución', group: 'sales' },
  { source: 'payment_method', file: 'ventas/metodos_pago.csv', label: 'Métodos de pago', group: 'sales' },
  { source: 'expense', file: 'ventas/gastos.csv', label: 'Gastos', group: 'sales' },
  { source: 'expense_category', file: 'ventas/categorias_gasto.csv', label: 'Categorías de gasto', group: 'sales' },

  { source: 'product', file: 'inventario/productos.csv', label: 'Productos', group: 'inventory' },
  { source: 'product_category', file: 'inventario/categorias_producto.csv', label: 'Categorías de producto', group: 'inventory' },
  { source: 'product_uom', file: 'inventario/unidades_medida.csv', label: 'Unidades de medida', group: 'inventory' },
  { source: 'product_pricelist', file: 'inventario/listas_precio.csv', label: 'Listas de precio', group: 'inventory' },
  { source: 'warehouse', file: 'inventario/almacenes.csv', label: 'Almacenes', group: 'inventory' },
  { source: 'picking', file: 'inventario/movimientos.csv', label: 'Movimientos (pickings)', group: 'inventory' },
  { source: 'picking_line', file: 'inventario/lineas_movimiento.csv', label: 'Líneas de movimiento', group: 'inventory' },
  { source: 'stock_move', file: 'inventario/kardex.csv', label: 'Kardex (movimientos de stock)', group: 'inventory' },
  { source: 'v_product_stock', file: 'inventario/existencias.csv', label: 'Existencias por producto', group: 'inventory' },

  { source: 'project', file: 'proyectos/proyectos.csv', label: 'Proyectos', group: 'projects' },
  { source: 'project_task', file: 'proyectos/tareas.csv', label: 'Tareas', group: 'projects' },
  { source: 'project_type', file: 'proyectos/tipos_proyecto.csv', label: 'Tipos de proyecto', group: 'projects' },

  { source: 'pos_register', file: 'pos/cajas.csv', label: 'Cajas', group: 'pos' },
  { source: 'pos_session', file: 'pos/sesiones.csv', label: 'Sesiones de caja', group: 'pos' },
  { source: 'pos_payment', file: 'pos/pagos.csv', label: 'Pagos del POS', group: 'pos' },
  { source: 'pos_cash_movement', file: 'pos/movimientos_efectivo.csv', label: 'Movimientos de efectivo', group: 'pos' },

  { source: 'approval_request', file: 'aprobaciones/solicitudes.csv', label: 'Solicitudes de aprobación', group: 'approvals' },
  { source: 'approval_request_line', file: 'aprobaciones/lineas_solicitud.csv', label: 'Líneas de solicitud', group: 'approvals' },
  { source: 'approval_request_step', file: 'aprobaciones/niveles_solicitud.csv', label: 'Niveles de cada solicitud', group: 'approvals' },
  { source: 'approval_request_event', file: 'aprobaciones/bitacora.csv', label: 'Bitácora de aprobaciones', group: 'approvals' },
  { source: 'approval_category', file: 'aprobaciones/categorias.csv', label: 'Categorías', group: 'approvals' },
  { source: 'approval_flow', file: 'aprobaciones/flujos.csv', label: 'Flujos', group: 'approvals' },
  { source: 'approval_flow_step', file: 'aprobaciones/niveles_flujo.csv', label: 'Niveles de flujo', group: 'approvals' },
  { source: 'approval_manager', file: 'aprobaciones/aprobadores.csv', label: 'Aprobadores', group: 'approvals' },

  { source: 'storefront_settings', file: 'web/tienda_ajustes.csv', label: 'Ajustes de la tienda', group: 'web' },
  { source: 'storefront_coupon', file: 'web/cupones.csv', label: 'Cupones', group: 'web' },
  { source: 'storefront_shipping_method', file: 'web/metodos_envio.csv', label: 'Métodos de envío', group: 'web' },
  { source: 'website_settings', file: 'web/sitio_ajustes.csv', label: 'Ajustes del sitio', group: 'web' },
  { source: 'website_page', file: 'web/paginas.csv', label: 'Páginas', group: 'web' },
  { source: 'website_menu', file: 'web/menus.csv', label: 'Menús', group: 'web' },
  { source: 'website_menu_item', file: 'web/elementos_menu.csv', label: 'Elementos de menú', group: 'web' },
  { source: 'website_post', file: 'web/posts.csv', label: 'Posts del blog', group: 'web' },
  { source: 'website_category', file: 'web/categorias_blog.csv', label: 'Categorías del blog', group: 'web' },
  { source: 'website_tag', file: 'web/etiquetas_blog.csv', label: 'Etiquetas del blog', group: 'web' },
  { source: 'website_author', file: 'web/autores.csv', label: 'Autores', group: 'web' },
  { source: 'website_comment', file: 'web/comentarios.csv', label: 'Comentarios', group: 'web' },
  { source: 'website_media', file: 'web/medios.csv', label: 'Medios (registros, sin archivos)', group: 'web' },
  { source: 'website_contact_submission', file: 'web/mensajes_contacto.csv', label: 'Mensajes de contacto', group: 'web' },
  { source: 'website_redirect', file: 'web/redirecciones.csv', label: 'Redirecciones', group: 'web' },

  { source: 'employee', file: 'rrhh/empleados.csv', label: 'Empleados (datos laborales)', group: 'hr' },
  { source: 'employee_department', file: 'rrhh/departamentos.csv', label: 'Departamentos', group: 'hr' },
  { source: 'hr_work_schedule', file: 'rrhh/horarios.csv', label: 'Horarios de trabajo', group: 'hr' },
  { source: 'hr_attendance', file: 'rrhh/asistencias.csv', label: 'Asistencias', group: 'hr' },
  { source: 'hr_absence', file: 'rrhh/inasistencias.csv', label: 'Inasistencias', group: 'hr' },
  { source: 'hr_leave_type', file: 'rrhh/tipos_ausencia.csv', label: 'Tipos de ausencia', group: 'hr' },
  { source: 'hr_leave_request', file: 'rrhh/solicitudes_ausencia.csv', label: 'Vacaciones y permisos', group: 'hr' },
  { source: 'hr_leave_allocation', file: 'rrhh/saldos_vacaciones.csv', label: 'Saldos de vacaciones', group: 'hr' },
  { source: 'hr_holiday', file: 'rrhh/dias_festivos.csv', label: 'Días festivos', group: 'hr' },

  { source: 'employee_private', file: 'privado/empleados_privado.csv', label: 'Datos privados de empleados (CURP, NSS, banco)', group: 'payroll', sensitive: true },
  { source: 'hr_salary', file: 'privado/salarios.csv', label: 'Salarios', group: 'payroll', sensitive: true },
  { source: 'payroll_period', file: 'privado/periodos_nomina.csv', label: 'Periodos de nómina', group: 'payroll', sensitive: true },
  { source: 'payroll_slip', file: 'privado/recibos_nomina.csv', label: 'Recibos de nómina', group: 'payroll', sensitive: true }
]

/** Entidades que se exportan según la confirmación de datos sensibles. */
export const selectExportEntities = (includeSensitive: boolean): DataExportEntity[] =>
  DATA_EXPORT_ENTITIES.filter(entity => includeSensitive || !entity.sensitive)

/**
 * Columnas del CSV: la unión de las llaves de todas las filas, en el orden en
 * que aparecen por primera vez (así una columna que solo traen algunas filas no
 * se pierde).
 */
export const collectColumns = (rows: Record<string, unknown>[]): string[] => {
  const seen = new Set<string>()
  const columns: string[] = []
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key)
        columns.push(key)
      }
    }
  }
  return columns
}

/** Filas de Supabase → CSV con BOM (escape seguro de `buildCsv`). */
export const rowsToCsv = (rows: Record<string, unknown>[]): string => {
  const columns = collectColumns(rows)
  const body = rows.map(row => columns.map(column => row[column] as CsvCell))
  return CSV_BOM + buildCsv(columns, body)
}

export interface DataExportResult {
  entity: DataExportEntity
  rows: number
  /** `true` si se alcanzó el tope de filas y pudo quedar información fuera. */
  truncated: boolean
  /** Mensaje si la entidad no se pudo leer (por ejemplo, migración pendiente). */
  error: string | null
}

/** Nombre del ZIP: `flowbit-{empresa}-{AAAA-MM-DD}.zip`. */
export const buildExportFilename = (companyName: string, date: Date = new Date()): string => {
  const slug = companyName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'empresa'
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `flowbit-${slug}-${y}-${m}-${d}.zip`
}

/** `LEEME.txt` del ZIP: qué contiene cada archivo y cómo leerlo. */
export const buildExportReadme = (input: {
  companyName: string
  generatedAt: Date
  results: DataExportResult[]
  includeSensitive: boolean
}): string => {
  const lines: string[] = [
    'EXPORTACIÓN DE DATOS — FLOWBIT',
    '==============================',
    '',
    `Empresa: ${input.companyName}`,
    `Generado: ${input.generatedAt.toISOString()} (UTC)`,
    `Datos privados de empleados y nómina: ${input.includeSensitive ? 'incluidos' : 'no incluidos'}`,
    '',
    'Cómo leer estos archivos',
    '------------------------',
    '- Cada CSV es una tabla de Flowbit. La primera fila trae los nombres de columna tal',
    '  como están en la base de datos, para que puedas reimportarlos o cruzarlos.',
    '- Codificación UTF-8 con BOM, separador coma y saltos de línea CRLF (RFC 4180).',
    '  Excel, Google Sheets, LibreOffice y cualquier lenguaje los abren directo.',
    '- Las columnas `id` y `*_id` son UUID: sirven para relacionar archivos',
    '  (por ejemplo, `ventas/lineas_orden.csv` → `order_id` → `ventas/ordenes.csv`).',
    '- Fechas en ISO 8601. Importes en la moneda de cada registro (`currency`).',
    '- Booleanos como «Sí» / «No». Columnas JSON como texto JSON.',
    '- Un texto que empezaba con = + - @ lleva un apóstrofo al inicio para que las',
    '  hojas de cálculo no lo ejecuten como fórmula.',
    '- Solo se exporta lo que tu usuario puede leer (las reglas de acceso de la base',
    '  se aplican también aquí).',
    '',
    'Archivos',
    '--------'
  ]

  const width = Math.max(...input.results.map(r => r.entity.file.length), 10)
  for (const result of input.results) {
    const status = result.error
      ? `NO EXPORTADO: ${result.error}`
      : `${result.rows} fila${result.rows === 1 ? '' : 's'}${result.truncated ? ' (INCOMPLETO: se alcanzó el tope de filas)' : ''}`
    lines.push(`${result.entity.file.padEnd(width)}  ${result.entity.label} — ${status}  [origen: ${result.entity.source}]`)
  }

  lines.push(
    '',
    'Flowbit es software libre (licencia MIT). Tus datos son tuyos: puedes llevarlos',
    'a otra herramienta cuando quieras.',
    ''
  )
  return lines.join('\r\n')
}
