# Exportar todos los datos de la empresa

Flowbit es software libre y su promesa es «sin candados»: una empresa puede llevarse
toda su información cuando quiera. La página **Configuración → Exportar datos**
(`/admin/data-export`) genera un ZIP con un CSV por tabla y un `LEEME.txt`.

## Quién puede usarla

- Solo **owner** y **admin** de la empresa seleccionada (`isSelectedCompanyAdmin`).
  Para el resto, la página muestra un aviso y no ofrece el botón.
- Todas las consultas pasan por RLS: aunque alguien forzara la descarga, solo
  obtendría lo que ya puede leer en el panel.
- Los datos privados de empleados y nómina (`employee_private`, `hr_salary`,
  `payroll_period`, `payroll_slip`) se incluyen **solo** si se marca la casilla.

## Qué contiene el ZIP

| Carpeta | Archivos |
|---|---|
| `general/` | empresa, contactos (solo contactos de negocio, no miembros del equipo), relaciones contacto–empresa |
| `crm/` | leads, etapas, actividades, motivos de pérdida |
| `ventas/` | órdenes, líneas de orden, pagos, devoluciones, métodos de pago, gastos y categorías |
| `inventario/` | productos, categorías, unidades, listas de precio, almacenes, pickings, kardex, existencias |
| `proyectos/` | proyectos, tareas, tipos |
| `pos/` | cajas, sesiones, pagos y movimientos de efectivo |
| `aprobaciones/` | solicitudes, líneas, niveles, bitácora, categorías, flujos y aprobadores |
| `web/` | ajustes de tienda, cupones, envíos; páginas, menús, posts, categorías, etiquetas, autores, comentarios, medios (registros), mensajes, redirecciones |
| `rrhh/` | empleados (datos laborales), departamentos, horarios, asistencias, inasistencias, ausencias, saldos, festivos |
| `privado/` | (opcional) datos privados de empleados, salarios, periodos y recibos de nómina |

`LEEME.txt` lista cada archivo con su tabla de origen y el número de filas, y
anota las tablas que no se pudieron leer (por ejemplo, una migración pendiente)
o que llegaron al tope de filas.

## Formato

- CSV UTF-8 con BOM, coma y CRLF, escapado con `buildCsv` (`app/utils/csv.ts`),
  que neutraliza la inyección de fórmulas.
- Los encabezados son los nombres reales de las columnas: sirven para reimportar o
  cruzar archivos por `id` / `*_id`.
- El ZIP usa el método *store* (sin compresión) y nombres UTF-8. Lo arma
  `createZip` en `app/utils/zip.ts`, sin dependencias, con pruebas en
  `tests/utils/zip.test.ts`.

## Cómo funciona

1. `useCompanyDataExport` recorre `DATA_EXPORT_ENTITIES` (`app/utils/dataExport.ts`).
2. Cada tabla se lee completa con `fetchAllRows` (bloques de 1000, orden por `id`,
   tope de 50 000 filas por tabla). Los contactos se leen vía `rel_partner_company`
   en bloques de 200 ids.
3. Una tabla que falla no detiene la exportación: se omite y se anota en `LEEME.txt`.
4. El ZIP se arma en memoria en el navegador y se descarga como
   `flowbit-{empresa}-{AAAA-MM-DD}.zip`.

## Al agregar un módulo

Agrega sus tablas a `DATA_EXPORT_ENTITIES`. Cada entrada necesita `company_id` e
`id` (o una estrategia especial). Marca `sensitive: true` si guarda datos
personales que no todos deberían descargar.

## Límites conocidos

- Todo ocurre en el navegador: empresas con cientos de miles de filas pueden
  tardar o consumir mucha memoria. Si se vuelve un problema, el siguiente paso es
  una ruta de servidor que genere el ZIP por streaming.
- No se exportan archivos binarios (medios del sitio web, adjuntos de
  aprobaciones); solo sus registros.
