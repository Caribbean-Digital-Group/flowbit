# SEO y posicionamiento de marca

Plan para que Flowbit aparezca en los buscadores, tanto cuando alguien busca la marca como cuando busca lo que el producto resuelve («CRM gratis», «software de nómina México»).

## Posicionamiento

> **Flowbit ERP: el ERP open source en español hecho para México.**

- **Marca compuesta «Flowbit ERP».** «Flowbit» a secas ya lo ocupan flowbit.com y flowbit.mx, con el dominio exacto y más antigüedad. Por eso se compite por «Flowbit ERP», que nadie más usa.
- **Nicho «open source + español + México».** Pelear «ERP» contra Odoo o SAP no es realista. En cambio, un ERP open source en español que ya incluye la nómina mexicana, la LFT, el IVA y los datos del SAT casi no tiene competencia.
- **Las constantes viven en el código.** `BRAND_NAME`, `BRAND_POSITIONING` y `MEXICO_HIGHLIGHTS` están en `app/utils/features.ts`. Usa las mismas palabras en redes, en GitHub y en directorios.

Dónde aparece:

| Lugar | Cómo |
|---|---|
| Landing | Title `Flowbit ERP: ERP open source en español hecho para México`, la frase encima del H1 y la sección «Hecho para México» (`#hecho-para-mexico`) |
| Páginas de módulo | Titles con `| Flowbit ERP` y un bloque «Hecho para México» distinto en cada módulo (campo `mexico`) |
| Hub | `Módulos del ERP open source para México | Flowbit ERP` |
| Datos estructurados | `alternateName: Flowbit ERP`, `areaServed: México`, `availableLanguage: es` |
| Global | `og:site_name` y el manifiesto como «Flowbit ERP»; los títulos del manual terminan en «Flowbit ERP» |

Lo que no existe no se afirma. Por ejemplo, Flowbit todavía no timbra CFDI, y la landing y las preguntas frecuentes lo dicen.

## Diagnóstico (noviembre 2026)

| Problema | Efecto |
|---|---|
| Solo había tres tipos de páginas indexables: la landing, `/manual` y las guías | Las guías responden a «cómo hago X» dentro de Flowbit. Ninguna página competía por búsquedas comerciales. |
| La landing presentaba 8 módulos; faltaban CRM, punto de venta, tienda, sitio web, RR. HH., nómina y aprobaciones | Google no asociaba Flowbit con esas búsquedas. |
| El H1 era «Operación en flujo continuo» | Ninguna palabra clave en la señal más fuerte de la página. |
| `og:locale` y `inLanguage` en `es_ES`, precio en USD | El producto está pensado para México (RFC, ISR, IMSS) y se presentaba como español de España. |
| Dominio `tryflowbit.netlify.app` | Un subdominio de Netlify acumula poca autoridad y transmite menos confianza. Ver «Acciones fuera del código». |
| La landing usaba el layout `default` | Se pintaban dos footers. |

## Lo implementado

### Sección pública `/funcionalidades`

- **Hub** `/funcionalidades`: todos los módulos agrupados por categoría y preguntas frecuentes generales.
- **Una página por módulo** en `/funcionalidades/{slug}`: `crm`, `ventas`, `punto-de-venta`, `inventario`, `tienda-en-linea`, `sitio-web`, `recursos-humanos`, `nomina`, `proyectos`, `aprobaciones`, `contactos`.
- Cada página tiene title y description propios, un H1 con la búsqueda principal, beneficios, funcionalidades, casos de uso, guías del manual, preguntas frecuentes, módulos relacionados y llamada a crear cuenta.
- Datos estructurados: `SoftwareApplication` (gratis, MIT, `featureList`), `BreadcrumbList` y `FAQPage`.

**Fuente única:** `app/utils/features.ts`. De ahí salen el hub, las páginas, la grilla de la landing, el footer y el sitemap. Para agregar un módulo, agrega su entrada ahí y no toques las vistas.

Reglas de redacción, también anotadas en el archivo:

- Todo lo que se afirma debe existir en el producto. Verifícalo contra `docs/`. Lo que no existe se dice claramente, por ejemplo «no timbra CFDI».
- `seoTitle` de 60 caracteres como máximo y `seoDescription` de 160, para que Google no los corte.
- El texto de las páginas es distinto entre módulos. El contenido duplicado se posiciona peor.

### Landing

- Layout nuevo `marketing` (`app/layouts/marketing.vue`), compartido con `/funcionalidades`. Tiene un header con navegación y un footer que enlaza los 11 módulos.
- H1 con «ERP gratis y open source para pymes» sin perder el lema de marca.
- Title con la marca primero: `Flowbit: ERP gratis y open source para pymes`.
- Una sección nueva enlaza los 11 módulos.
- Preguntas frecuentes (`#preguntas-frecuentes`) con `FAQPage`.
- `/?registro=1` abre el formulario de registro. Lo usan todos los CTA de las páginas públicas.

### Global

- `lang="es-MX"`, `og:locale=es_MX`, precio en MXN.
- Etiquetas de verificación de Search Console y Bing, que se activan con variables de entorno (ver abajo).
- Sitemap con las 12 URLs nuevas en prioridad 0.9.
- Las guías del manual ahora emiten `BreadcrumbList` y `TechArticle`.
- El layout del manual enlaza a `/funcionalidades`.

## Variables de entorno nuevas (opcionales)

```
NUXT_PUBLIC_GOOGLE_SITE_VERIFICATION=   # código de la etiqueta HTML de Search Console
NUXT_PUBLIC_BING_SITE_VERIFICATION=     # código de msvalidate.01 de Bing Webmaster Tools
```

Se leen **al compilar**: configúralas en Netlify y vuelve a desplegar.

## Acciones fuera del código

Ordenadas por impacto. Ningún cambio de código sustituye las dos primeras.

1. **Dominio propio**, por ejemplo `flowbit.mx` o `tryflowbit.com`. Configúralo en Netlify como dominio principal con redirección 301 desde `tryflowbit.netlify.app` y actualiza `NUXT_PUBLIC_SITE_URL`. Todos los canonical, el sitemap y los datos estructurados lo toman de esa variable.
2. **Google Search Console**: verifica la propiedad con la variable de arriba, envía `https://{dominio}/sitemap.xml` y solicita la indexación de `/`, `/funcionalidades` y las páginas de módulo. Haz lo mismo en **Bing Webmaster Tools**, que también alimenta a ChatGPT Search y DuckDuckGo.
3. **Enlaces entrantes (backlinks)**, la señal de autoridad que hoy falta. Usa siempre «Flowbit ERP» y la frase de posicionamiento:
   - `README` del repositorio en GitHub con enlace al sitio y a `/funcionalidades`. Agrega *topics* al repo (`erp`, `crm`, `pos`, `nuxt`, `supabase`, `open-source`, `mexico`).
   - Directorios de software: AlternativeTo (como alternativa a Odoo, Zoho y Bind ERP), Product Hunt, Capterra, G2, SaaSHub y la lista `awesome-selfhosted`.
   - Publicaciones en comunidades: dev.to, Reddit (r/selfhosted, r/mexico_emprendedores), grupos de pymes y foros de Nuxt y Supabase.
4. **Perfil de empresa de Google** para Flowbit, enlazado al sitio. Refuerza el reconocimiento de marca.
5. **Contenido de blog** mensual sobre búsquedas informativas que llevan a un módulo. Ejemplos: «cómo calcular la nómina en México 2026», «cómo hacer un corte de caja», «plantilla de control de inventario vs. software». Cada artículo enlaza a su página de `/funcionalidades`. Se puede publicar con el propio módulo Sitio web de Flowbit.
6. **Páginas de comparación** (siguiente iteración de código): «Flowbit vs. Odoo» y «Alternativa gratis a Bind ERP». Captan búsquedas con intención de cambio.

## Cómo medir

| Indicador | Dónde | Objetivo a 90 días |
|---|---|---|
| Páginas indexadas | Search Console → Indexación | Landing, hub, 11 módulos y guías del manual |
| Impresiones y clics por consulta | Search Console → Rendimiento | Crecimiento mes a mes en las consultas de cada módulo |
| Posición para «Flowbit» y «Flowbit ERP» | Search Console | Primer resultado |
| Resultados enriquecidos (FAQ, breadcrumbs) | Search Console → Mejoras | Sin errores |
| Registros desde páginas de módulo | Analítica del sitio | Medir la conversión de `/?registro=1` |

Valida los datos estructurados con la [prueba de resultados enriquecidos](https://search.google.com/test/rich-results) después de cada cambio en `app/utils/seo.ts`.
