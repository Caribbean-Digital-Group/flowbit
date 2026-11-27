# Valle Bit (`/valle-bit`)

Vista de juego del ERP: un pueblo pixel art en 2D que se recorre con un avatar.
Cada lugar del mapa es un módulo de Flowbit y los marcadores muestran las cifras
reales del mes de la empresa en uso. Para el uso desde la aplicación, ver el
artículo «Valle Bit» del manual (`/manual/valle-bit`).

Se entrega en tres fases. Este documento describe la **Fase 1 (TRY-77)** y deja
anotado lo acordado para las siguientes.

## Principios

- **Es otra vista, no otro módulo.** No tiene datos de negocio propios ni RPC
  nuevos: lee con los mismos composables que el panel, así que aplica el mismo
  RLS. Nadie ve en el valle algo que no pueda ver en `/admin`.
- **No calcula cifras por su cuenta.** Los marcadores salen de `get_sales_kpis`,
  `get_dashboard_snapshot`, los gastos pagados y el stock bajo.
- **Sin dependencias ni assets.** Motor propio sobre Canvas 2D; todo el arte se
  dibuja con rectángulos en `app/utils/valle/render.ts`.
- **Empresa en uso.** Opera sobre `selectedCompanyId`; al cambiar de empresa se recarga.

## Mapa

Cuadrícula de 44 × 34 tiles de 16 px. Doce lugares en 4 columnas × 3 filas,
unidos por calles. El catálogo es `app/utils/valle/locations.ts`: fuente única
del mapa, del modo lista, de los paneles y de lo que dice Bit.

| Lugar | Módulo | Ruta del panel |
|---|---|---|
| Banco | Finanzas y gastos | `/admin/reports/profit-loss` |
| Ayuntamiento | Aprobaciones | `/admin/approval-requests` |
| Tesorería | Nómina | `/admin/payroll` |
| Gremio | Recursos Humanos (departamentos y su gente) | `/admin/employees` |
| Mercado | Ventas | `/admin/orders` |
| Plaza | Dashboard («Requiere atención») | `/admin` |
| Tablón de misiones | Agenda | `/admin/agenda` |
| Tienda | Tienda en línea y POS | `/admin/storefront` |
| Almacén | Inventario y compras | `/admin/inventory` |
| Taller | Proyectos | `/admin/projects` |
| Oficina comercial | CRM | `/admin/crm/kanban` |
| Tu casa | Perfil y editor de avatar | `/admin/profile` |

Para agregar un lugar: una entrada en `SEEDS` con su hueco (`col`, `row`). Las
pruebas verifican que no se encime con otro y que su entrada sea alcanzable.

## Marcadores

Mes en curso contra el mismo tramo del mes anterior (`presetRange('this_month')`
y `previousRange`, los mismos del dashboard). Armado puro en `buildScoreboard`
(`app/utils/valle/summary.ts`).

| Marcador | Cálculo |
|---|---|
| Cobrado | `totals.net_collected` |
| Gastos | `totals.purchases_paid` + gastos de operación en estado `paid` |
| Utilidad | Cobrado − Gastos (base de caja, igual que el estado de resultados) |
| Previsto | `receivables.total` + embudo de CRM ponderado en la moneda de la empresa |
| Por cobrar | `receivables.total` |
| Stock bajo | Sugerencias de `useRestock` |
| Pendientes | Tareas vencidas + aprobaciones en revisión + seguimientos de CRM vencidos |

«Gastos» no coincide con la tarjeta «Egresos» del dashboard: esa solo cuenta
compras pagadas. Aquí se suman los gastos de operación para que Utilidad
coincida con `/admin/reports/profit-loss`.

Un marcador sin dato (consulta fallida o sin acceso) muestra «—».

## Lugares

Cada lugar abre un panel de solo lectura (`Valle/LocationPanel.vue`) con cifras,
registros recientes y accesos al panel. Su contenido lo arma
`buildLocationSummary`. Gremio, Tesorería y Tablón piden sus datos al acercarse
(`useValleWorld().loadLocation`); el resto usa lo que ya cargaron los marcadores.

## Avatar

Editor por capas en «Tu casa»: tono de piel, peinado, color de cabello, ropa y
accesorio. El sprite de 16 × 16 se genera con `avatarPixels` (4 direcciones × 3
cuadros).

- Tabla `valle_avatar` (migración `20261128120000_valle_avatar.sql`): una fila
  por usuario, **sin `company_id`**, porque el avatar es el mismo en todas sus
  empresas. RLS: cada quien lee y escribe solo el suyo.
- `normalizeAvatar` acepta únicamente valores del catálogo: lo guardado llega
  al canvas como color.
- Se guarda también en `localStorage` (`flowbit:valle-avatar`). Si la migración
  no está aplicada, el avatar vive solo en ese navegador y el editor lo avisa.

## Bit

`Valle/BitCompanion.vue`. Sigue al avatar por el mapa.

- **Al llegar a un lugar** muestra un globo con qué es (`welcome` del catálogo)
  y qué pasa hoy ahí (`liveLine` del resumen). Una vez por lugar y por visita.
- **Su panel** (botón o tecla `B`) abre la ayuda del módulo: resumen, consejos y
  preguntas frecuentes del artículo del manual que corresponde a la ruta del
  lugar (`useManual().getContextForRoute`). No se duplica contenido.
- **En el camino** dice lo más urgente del día y ofrece llevarte a cualquier lugar.
- **Recorrido inicial** de cinco pasos en la primera visita; se puede repetir.
- **Modo discreto** apaga los globos. Preferencias en `localStorage`
  (`flowbit:valle-bit`).

No es IA generativa: todo sale del manual y de los datos del ERP.

## Controles y accesibilidad

| Entrada | Acción |
|---|---|
| Flechas / WASD | Caminar |
| Clic o toque en el mapa | Caminar hasta ese punto; sobre un edificio, ir y entrar |
| Joystick (pantallas táctiles) | Caminar |
| `E`, Enter o «Entrar a…» | Entrar al lugar cercano |
| `B` | Ayuda de Bit |
| `Esc` | Cerrar panel |

El **modo lista** muestra los mismos lugares como tarjetas, sin canvas. Es el
predeterminado con `prefers-reduced-motion` y la elección se recuerda
(`flowbit:valle-view`).

El bucle del juego se detiene con la pestaña oculta. El mapa se dibuja una vez
en un canvas fuera de pantalla y cada cuadro copia la parte visible, con escala
entera para que el pixel art se vea nítido.

## Archivos

| Archivo | Rol |
|---|---|
| `app/utils/valle/locations.ts` | Catálogo de lugares y cuadrícula |
| `app/utils/valle/map.ts` | Mapa, colisiones, rutas (BFS), cámara y escala |
| `app/utils/valle/avatar.ts` | Opciones del avatar y sprites |
| `app/utils/valle/summary.ts` | Marcadores y resumen por lugar |
| `app/utils/valle/render.ts` | Dibujo en canvas (solo navegador) |
| `app/composables/useValleWorld.ts` | Carga de datos con los composables del panel |
| `app/composables/useValleAvatar.ts` | Lectura y guardado del avatar |
| `app/components/Valle/` | Canvas, marcadores, panel, editor, Bit, joystick y modo lista |
| `app/layouts/valle.vue`, `app/pages/valle-bit/index.vue` | Layout a pantalla completa y página |
| `tests/utils/valle.test.ts` | Pruebas del motor, el avatar y los marcadores |

## Fases siguientes (acordadas, sin implementar)

**Fase 2 — Misiones.** Tablón con misiones propias (tabla `valle_mission`,
estado solo por RPC) que crean y asignan owner/admin, visibles también en
`/admin/agenda`. Acciones rápidas dentro de los lugares: completar tarea,
aprobar o rechazar, marcar actividad de CRM.

**Fase 3 — Progresión y mundo vivo.** XP otorgado solo por triggers de la base,
niveles, logros y ranking por empresa (ocultable por el owner). Alertas sobre
los edificios, aspecto del edificio según sus datos, día y noche, clima según la
utilidad, y avatares del equipo en el Gremio (requiere una política de lectura
adicional en `valle_avatar`).

Pendiente también: página de marketing en `app/utils/features.ts`.
