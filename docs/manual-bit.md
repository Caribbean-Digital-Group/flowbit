# Manual, asistente Bit y documentación compartible

El manual de Flowbit es una **sección pública** en `/manual`: se lee sin iniciar
sesión y es el mismo destino para el equipo y para cualquier visitante.

```
Contenido (app/utils/manual/*)
      │  fuente única de verdad: 66 artículos
      ├──────────────────┬──────────────────┬──────────────────┐
      ▼                  ▼                  ▼                  ▼
Manual público     Guía individual     Asistente Bit       Compartir
/manual            /manual/:id         (flotante)          (enlace / redes / tarjeta)
```

Todo se alimenta del mismo catálogo: agregar un artículo lo publica a la vez en
el índice, en las guías, en el asistente contextual y en los botones de compartir.

## Rutas

| Ruta | Acceso | Contenido |
|---|---|---|
| `/manual` | Público | Índice: buscador, rutas de aprendizaje, guías paso a paso, novedades y módulos |
| `/manual/:id` | Público | Guía completa con menú lateral, navegación anterior/siguiente y compartir |
| `/admin/manual` | Redirección 301 | Histórico; conserva `?article=` y lo traduce a `/manual/:id` |
| `/help`, `/help/**` | Redirección 301 | Histórico; apunta a `/manual/**` (`routeRules` en `nuxt.config.ts`) |

El layout `manual.vue` se adapta a quien entra: con sesión ofrece «Volver al
panel», sin sesión ofrece crear cuenta. Nunca redirige ni bloquea.

### Qué cambia con sesión iniciada

La documentación es idéntica para todos; solo se ajustan las acciones que
requieren el panel:

| Elemento | Invitado | Con sesión |
|---|---|---|
| Guías, búsqueda, wizards, compartir | Sí | Sí |
| Favoritos, «leído» y progreso | Sí (en su navegador) | Sí (en su navegador) |
| Botones «Abrir en el panel» | Ocultos | Visibles |
| Acción de cada paso de un wizard | Oculta | Visible |
| Llamado a crear cuenta | Visible | Oculto |

---

## Capa de contenido

| Archivo | Contenido |
|---|---|
| `app/utils/manual/types.ts` | Interfaces: `DocArticle`, `DocWizard`, `WizardStep`, `DocFaq`, `DocShortcut`, `LearningPath`, `ModuleMeta` |
| `app/utils/manual/articles.ts` | Catálogo de artículos (datos puros, sin Vue) |
| `app/utils/manual/paths.ts` | `MODULE_META` (orden, etiqueta, color y descripción de cada módulo) y `LEARNING_PATHS` |
| `app/utils/manualShare.ts` | Texto plano/Markdown, URLs de redes, portapapeles y tarjeta PNG |

### Anatomía de un artículo

```ts
{
  id: 'storefront-settings',              // estable: forma parte de la URL pública
  routePatterns: ['/admin/storefront'],   // rutas que documenta ([] = solo manual)
  module: 'storefront',                   // debe existir en MODULE_META
  moduleLabel: 'Tienda en línea',
  moduleEmoji: '🛍️',
  title: 'Ajustes de la tienda',
  viewType: 'config',                     // list | create | detail | scan | dashboard
                                          // config | team | terminal | public | analytics
  level: 'basico',                        // basico | intermedio | avanzado
  isNew: true,                            // lo destaca en el manual y en Bit
  summary: '…',                           // frase que se comparte en redes y va al meta description
  description: '…',                       // qué es esta vista
  importance: '…',                        // por qué importa
  tips: ['…'],                            // consejos numerados, copiables uno a uno
  fields: [{ label, required, type, description, tip }],
  process: [{ step, title, description }], // diagrama horizontal
  wizard: { id, title, description, estimatedMinutes, steps: [...] },
  faqs: [{ question, answer }],
  shortcuts: [{ keys, action }],
  relatedModules: [{ label, route }],      // enlaces a vistas del panel
  relatedArticles: ['otro-id'],
  tags: ['…']
}
```

Todos los campos salvo `id`, `routePatterns`, `module*`, `title`, `viewType`,
`description`, `importance` y `tips` son opcionales; cada sección aparece solo
si tiene contenido.

### Wizards

Un `wizard` convierte el artículo en una guía interactiva: cada paso se marca
como completado, admite sub-tareas (`checklist`), un `tip`, un `warning` y una
`action` que navega a la vista donde se ejecuta el paso. El progreso se guarda
por persona y dispositivo en `localStorage` (`flowbit:manual-progress`) y se
comparte entre el manual y el asistente: si empiezas una guía desde Bit, la
continúas en el manual donde la dejaste.

### Rutas de aprendizaje

`LEARNING_PATHS` encadena artículos de varios módulos para resolver un objetivo
completo (arrancar la empresa, vender en línea, abrir el punto de venta). Su
progreso se calcula con los artículos marcados como leídos.

---

## Composables

| Composable | Responsabilidad |
|---|---|
| `useManual()` | Búsqueda ponderada, resolución de ruta → artículo, módulos ordenados, relacionados, vecinos, etiquetas de nivel y tipo de vista |
| `useManualProgress()` | Pasos completados, artículos leídos, favoritos, recientes y primer uso de Bit (persistidos en `localStorage`) |
| `useManualShare()` | Enlaces públicos, copiar, compartir nativo, redes sociales y tarjeta PNG |

### Resolución contextual de ruta

`getContextForRoute(path)` puntúa cada patrón por número de segmentos y por
cuántos son estáticos, de modo que `/admin/crm/leads/create` gana sobre
`/admin/crm/leads/:id`. Hoy las 63 rutas del panel tienen artículo asociado.

### Búsqueda

`searchArticles(query)` normaliza sin acentos y pondera: título exacto (120) >
prefijo (70) > contiene (50) > etiquetas (25) > módulo (15) > cuerpo (8),
buscando también dentro de campos, FAQs, atajos y pasos de los wizards.

---

## Componentes

| Componente | Uso |
|---|---|
| `Manual/ArticleView.vue` | Renderiza un artículo completo; oculta los enlaces al panel si no hay sesión |
| `Manual/Wizard.vue` | Guía paso a paso con progreso; `compact` para el panel de Bit |
| `Manual/ShareMenu.vue` | Menú de compartir: nativo, enlace, contenido, tarjeta PNG y seis redes |
| `Manual/CopyButton.vue` | Botón de copiar con confirmación, usado por sección, consejo, paso y respuesta |
| `Manual/FloatingAssistant.vue` | Bit: asistente conversacional del panel y del manual |
| `Manual/Nav.vue` | Menú lateral de módulos, compartido por el índice y las guías |
| `Manual/GuestCta.vue` | Llamado a crear cuenta, solo para visitantes sin sesión |

---

## Asistente Bit

Vive en el botón flotante del layout admin y del layout del manual (también
para visitantes sin cuenta). Es **conversacional pero determinista**: no consulta servicios externos, responde con la documentación
incluida en la plataforma.

- **Contexto**: reconoce la vista actual y saluda con el nombre del usuario.
  Dentro de `/manual/:id` el contexto es la guía que se está leyendo.
- **Intenciones**: `que-hago`, `guiame`, `campos`, `consejos`, `faq`, `atajos`,
  `compartir`, `inicio`, `guias`. Se activan por chips o por texto libre
  (coincidencia de palabras clave); sin coincidencia, cae a búsqueda.
- **Bloques de respuesta**: texto, nota destacada, lista de consejos, campos,
  FAQ desplegable, tabla de atajos, wizard embebido, resultados de búsqueda,
  accesos a vistas y acciones de compartir.
- **Proactividad**: ofrece ayuda una sola vez por ruta y por sesión, y solo
  donde hay algo concreto que aportar (una guía disponible o documentación nueva).
- **Teclado**: `?` abre, `Esc` cierra. El pulso del botón desaparece tras el
  primer uso.

Para agregar una intención nueva, extiende `resolveIntent()` y
`contextSuggestions()` en `FloatingAssistant.vue`.

---

## Compartir

Cada artículo y cada sección se comparten de forma independiente:

| Acción | Resultado |
|---|---|
| Copiar enlace | `{SITE_URL}/manual/{id}#{seccion}` |
| Copiar contenido | Markdown completo, o el texto de la sección con su enlace |
| Compartir con… | Diálogo nativo del sistema (móvil y navegadores compatibles) |
| Redes | WhatsApp, X, LinkedIn, Facebook, Telegram y correo con texto y hashtags |
| Tarjeta para redes | PNG 1200×630 generado en canvas con el degradado de marca, listo para publicar |

Los enlaces apuntan a `/manual/:id`, que se renderiza en servidor con
`og:title`, `og:description` y `canonical`, de modo que la vista previa se ve
correctamente al pegarlos en cualquier red.

### Qué se expone públicamente

Solo contenido genérico del producto: no hay datos de ninguna empresa, cliente
ni operación. El ancla del enlace (`#consejos`, `#guia-slug`, …) hace scroll a
la sección compartida.

---

## Agregar documentación de un módulo nuevo

1. Agrega el módulo a `MODULE_META` en `app/utils/manual/paths.ts` si aún no existe.
2. Agrega un artículo por vista en `app/utils/manual/articles.ts`, con
   `routePatterns` que coincidan con las rutas reales del módulo.
3. Si el módulo tiene un flujo completo, agrega un `wizard`; si tiene un objetivo
   de negocio que cruza módulos, agrégalo a `LEARNING_PATHS`.
4. Marca los artículos con `isNew: true` para destacarlos durante el lanzamiento.

No hay que tocar el manual, el asistente ni la documentación pública: los tres
leen del mismo catálogo.
