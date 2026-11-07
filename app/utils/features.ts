// Contenido de marketing de la sección pública /funcionalidades.
//
// Es la fuente única del hub, de cada página de módulo, de la grilla de la
// landing y del sitemap. Son datos puros (sin Vue) para que el servidor
// (server/routes/sitemap.xml.ts) también pueda importarlos.
//
// Reglas de redacción:
// - Cada afirmación debe existir en el producto (verificar contra docs/).
// - seoTitle ≤ 60 caracteres y seoDescription ≤ 160 para que Google no los corte.
// - El H1 (headline) incluye la búsqueda principal del módulo.
// - manualArticles usa ids reales de app/utils/manual/articles.ts.

export type FeatureIcon =
  | 'crm'
  | 'sales'
  | 'pos'
  | 'inventory'
  | 'storefront'
  | 'website'
  | 'hr'
  | 'payroll'
  | 'projects'
  | 'approvals'
  | 'contacts'

export type FeatureCategory = 'Ventas' | 'Operación' | 'Canales digitales' | 'Personas' | 'Colaboración'

export interface FeaturePoint {
  title: string
  description: string
}

export interface FeatureFaq {
  question: string
  answer: string
}

export interface FeatureModule {
  slug: string
  /** Nombre corto del módulo, tal como aparece en el panel. */
  name: string
  category: FeatureCategory
  icon: FeatureIcon
  /** Clases literales del gradiente para que Tailwind v4 las detecte. */
  gradient: string
  /** Frase de una línea para tarjetas y enlaces. */
  tagline: string
  /** Cómo se adapta el módulo a México: contenido único del bloque «Hecho para México». */
  mexico: string
  seoTitle: string
  seoDescription: string
  keywords: string[]
  headline: string
  intro: string
  benefits: FeaturePoint[]
  features: FeaturePoint[]
  useCases: string[]
  faqs: FeatureFaq[]
  manualArticles: string[]
  related: string[]
}

export const FEATURE_CATEGORIES: FeatureCategory[] = [
  'Ventas',
  'Operación',
  'Canales digitales',
  'Personas',
  'Colaboración'
]

export const FEATURE_MODULES: FeatureModule[] = [
  {
    slug: 'crm',
    name: 'CRM',
    category: 'Ventas',
    icon: 'crm',
    gradient: 'from-indigo-500 to-violet-600',
    tagline: 'Pipeline de ventas con tablero Kanban, leads y actividades.',
    mexico: 'Interfaz en español, montos en pesos mexicanos y el RFC de cada prospecto en su ficha de contacto, listo para cuando se convierta en cliente.',
    seoTitle: 'CRM gratis en español con tablero Kanban | Flowbit ERP',
    seoDescription: 'CRM gratis en español para pymes de México: leads, oportunidades y actividades en un tablero Kanban, con montos en pesos y pipeline medible.',
    keywords: ['CRM gratis', 'CRM open source', 'CRM para pymes', 'pipeline de ventas', 'tablero Kanban de ventas', 'gestión de leads'],
    headline: 'CRM gratis para dar seguimiento a cada oportunidad de venta',
    intro: 'Organiza a tus prospectos en un pipeline visual, programa actividades y entiende por qué ganas o pierdes cada oportunidad. Todo conectado con contactos, órdenes y el sitio web de tu empresa.',
    benefits: [
      { title: 'Ninguna oportunidad se queda olvidada', description: 'Cada lead tiene responsable, próxima actividad y fecha. Las notificaciones del panel te avisan de lo pendiente.' },
      { title: 'Pronósticos que sí reflejan la realidad', description: 'Cada columna muestra el total y el valor ponderado por probabilidad, así sabes cuánto puedes esperar cerrar.' },
      { title: 'Aprende de cada venta perdida', description: 'Los motivos de pérdida se registran al cerrar un lead, para que detectes patrones y ajustes tu oferta.' }
    ],
    features: [
      { title: 'Tablero Kanban', description: 'Arrastra los leads entre etapas, pliega columnas y usa la vista compacta. También funciona con teclado y en pantallas táctiles.' },
      { title: 'Pipeline configurable', description: 'Define tus propias etapas, su orden, probabilidad y color según tu proceso comercial.' },
      { title: 'Actividades y agenda', description: 'Programa llamadas, reuniones y tareas sobre cada lead y consúltalas en la agenda del equipo.' },
      { title: 'Ganar, perder y reabrir', description: 'Marca el resultado de cada oportunidad con su motivo y reabre las que vuelvan a tomar interés.' },
      { title: 'Captura desde tu sitio web', description: 'Los mensajes del formulario de contacto de tu sitio pueden convertirse en leads del CRM.' },
      { title: 'Conexión con ventas', description: 'Del lead ganado pasas a la orden de venta con el mismo contacto, sin volver a capturar datos.' }
    ],
    useCases: [
      'Equipos comerciales que hoy llevan su seguimiento en hojas de cálculo.',
      'Agencias y despachos que cotizan proyectos y necesitan saber qué está por cerrarse.',
      'Distribuidores que quieren medir la conversión de prospectos a clientes.'
    ],
    faqs: [
      { question: '¿El CRM de Flowbit es realmente gratis?', answer: 'Sí. El CRM viene incluido sin costo y sin límite de usuarios ni de leads. Flowbit es software libre con licencia MIT.' },
      { question: '¿Puedo adaptar las etapas del pipeline a mi proceso?', answer: 'Sí. Puedes crear, renombrar y reordenar etapas, y asignarles probabilidad y color desde la sección Pipeline.' },
      { question: '¿El CRM se conecta con las ventas y el inventario?', answer: 'Sí. Un lead ganado se convierte en una orden de venta del mismo contacto, y esa orden mueve inventario y pagos dentro de Flowbit.' }
    ],
    manualArticles: ['crm-kanban', 'crm-leads-create', 'crm-stages-list', 'crm-lost-reasons'],
    related: ['ventas', 'contactos', 'sitio-web']
  },
  {
    slug: 'ventas',
    name: 'Ventas y compras',
    category: 'Ventas',
    icon: 'sales',
    gradient: 'from-fuchsia-500 to-pink-600',
    tagline: 'Cotizaciones, órdenes, cobros y devoluciones en un solo flujo.',
    mexico: 'Cada línea calcula el IVA con su propia tasa, con precios con o sin impuesto incluido. Los montos van en pesos y las compras en otra moneda se convierten con su tipo de cambio.',
    seoTitle: 'Software de ventas y compras para pymes | Flowbit ERP',
    seoDescription: 'Software de ventas y compras en español: órdenes con IVA por línea, cobros con abonos, devoluciones y reporte de ventas en pesos. Gratis y open source.',
    keywords: ['software de ventas gratis', 'sistema de órdenes de compra', 'control de ventas', 'cotizaciones', 'cuentas por cobrar', 'reporte de ventas'],
    headline: 'Software de ventas y compras para controlar cada orden de principio a fin',
    intro: 'Crea cotizaciones, confírmalas como órdenes y deja que Flowbit lleve el estado de entrega y de pago. El inventario y el reporte de ventas se actualizan solos.',
    benefits: [
      { title: 'Estados que no se capturan a mano', description: 'La entrega y el pago de cada orden se calculan a partir de los movimientos de almacén y de los cobros registrados, así que siempre están al día.' },
      { title: 'Cobranza clara', description: 'Registra abonos parciales y consulta qué falta por cobrar en cada orden.' },
      { title: 'Ingresos reales en tus reportes', description: 'El reporte de ventas reconoce el ingreso cuando cobras, no cuando capturas la orden.' }
    ],
    features: [
      { title: 'Órdenes de venta y de compra', description: 'Un mismo modelo para vender y para comprar, con folios, líneas, impuestos y descuentos.' },
      { title: 'Cobros con abonos', description: 'Libro de pagos por orden con varios métodos de pago: efectivo, transferencia, tarjeta y los que definas.' },
      { title: 'Devoluciones y reembolsos', description: 'Registra devoluciones parciales que reintegran inventario y ajustan lo cobrado.' },
      { title: 'Órdenes por surtir', description: 'Una vista dedicada muestra qué órdenes siguen pendientes de entrega.' },
      { title: 'Reservas por almacén', description: 'Al preparar una entrega, el producto queda reservado en el almacén que la surte.' },
      { title: 'Reporte de ventas', description: 'Ventas por periodo, producto y cliente, con gráficas mensuales.' }
    ],
    useCases: [
      'Comercios y distribuidores que venden en mostrador, en línea y por pedido.',
      'Empresas de servicios que cotizan y cobran en parcialidades.',
      'Negocios que compran a proveedores y quieren ligar sus compras al inventario.'
    ],
    faqs: [
      { question: '¿Flowbit emite facturas electrónicas (CFDI)?', answer: 'Todavía no. Flowbit guarda los datos fiscales de clientes y empleados, pero no timbra CFDI. Puedes usar tu servicio de facturación actual junto con Flowbit.' },
      { question: '¿Puedo registrar pagos parciales?', answer: 'Sí. Cada orden tiene su libro de pagos y admite abonos con distintos métodos de pago hasta liquidarse.' },
      { question: '¿Las ventas descuentan inventario automáticamente?', answer: 'Sí. Al confirmar la entrega se genera el movimiento de salida del almacén y la existencia se actualiza.' }
    ],
    manualArticles: ['orders-create', 'orders-detail', 'payment-methods-list', 'sales-report'],
    related: ['inventario', 'punto-de-venta', 'crm']
  },
  {
    slug: 'punto-de-venta',
    name: 'Punto de venta',
    category: 'Ventas',
    icon: 'pos',
    gradient: 'from-violet-500 to-fuchsia-600',
    tagline: 'Caja rápida con lector de códigos, cortes y devoluciones.',
    mexico: 'Precios en pesos con IVA incluido o desglosado, cobro en efectivo con botones de denominaciones y pagos mixtos con tarjeta o transferencia.',
    seoTitle: 'Punto de venta gratis en la nube para México | Flowbit ERP',
    seoDescription: 'Punto de venta gratis para negocios en México: lector de código de barras, precios en pesos con IVA, pagos mixtos, cortes de caja y devoluciones.',
    keywords: ['punto de venta gratis', 'POS gratis', 'sistema de caja', 'punto de venta en la nube', 'corte de caja', 'software para tienda'],
    headline: 'Punto de venta gratis en la nube, listo para cobrar desde el navegador',
    intro: 'Abre caja, escanea productos y cobra en segundos. Cada ticket es una orden de venta que descuenta inventario al momento, y el corte de caja cuadra solo.',
    benefits: [
      { title: 'Cobra más rápido', description: 'El cursor siempre está en la búsqueda: escanea o teclea el SKU y pulsa Enter. Todo el flujo tiene atajos de teclado.' },
      { title: 'Cortes de caja sin sorpresas', description: 'Fondo inicial, entradas, salidas, ventas y devoluciones se suman para mostrar el efectivo esperado contra el contado.' },
      { title: 'Inventario siempre al día', description: 'Cada venta descuenta existencias en tiempo real, en el mismo sistema que usa tu almacén.' }
    ],
    features: [
      { title: 'Lector de código de barras', description: 'Escanea productos o búscalos por nombre o SKU. Con el prefijo 3* agregas varias unidades de golpe.' },
      { title: 'Pagos mixtos', description: 'Combina efectivo, tarjeta y otros métodos en un mismo ticket, con cálculo del cambio.' },
      { title: 'Tickets en espera', description: 'Pausa una venta para atender a otro cliente y recupérala después.' },
      { title: 'Descuentos con supervisión', description: 'Descuentos por línea o por ticket, con límite por cajero y autorización de supervisor.' },
      { title: 'Varias cajas y sesiones', description: 'Configura cajas por sucursal y lleva el historial de aperturas y cierres de cada una.' },
      { title: 'Devoluciones', description: 'Busca la venta por folio, devuelve las cantidades necesarias y el inventario se reintegra.' }
    ],
    useCases: [
      'Tiendas de abarrotes, papelerías, ferreterías y boutiques.',
      'Negocios con varias cajas o sucursales que necesitan cortes por turno.',
      'Comercios que venden en mostrador y también en su tienda en línea.'
    ],
    faqs: [
      { question: '¿Necesito instalar algo para usar el punto de venta?', answer: 'No. El punto de venta funciona en el navegador de cualquier computadora o tableta. Un lector de código de barras USB funciona como teclado y no requiere configuración.' },
      { question: '¿Qué pasa si se recarga la página a mitad de una venta?', answer: 'La venta en curso se guarda en el dispositivo, así que el ticket no se pierde al recargar.' },
      { question: '¿El punto de venta comparte inventario con la tienda en línea?', answer: 'Sí. Punto de venta, órdenes y tienda en línea usan el mismo inventario de Flowbit.' }
    ],
    manualArticles: ['pos-terminal', 'pos-close', 'pos-returns', 'pos-registers-create'],
    related: ['inventario', 'ventas', 'tienda-en-linea']
  },
  {
    slug: 'inventario',
    name: 'Inventario',
    category: 'Operación',
    icon: 'inventory',
    gradient: 'from-indigo-500 to-indigo-700',
    tagline: 'Productos, almacenes, movimientos con QR y trazabilidad.',
    mexico: 'Valuación a costo promedio ponderado en pesos, y compras en dólares u otra moneda convertidas con su tipo de cambio al entrar al almacén.',
    seoTitle: 'Control de inventario gratis multialmacén | Flowbit ERP',
    seoDescription: 'Control de inventario gratis en español: varios almacenes, movimientos con código QR, traspasos, costo promedio en pesos y alertas de reabastecimiento.',
    keywords: ['control de inventario gratis', 'software de inventario', 'sistema de almacén', 'kardex', 'trazabilidad de inventario', 'multialmacén'],
    headline: 'Control de inventario gratis para uno o varios almacenes',
    intro: 'Sabe qué tienes, dónde está y cuánto vale. Cada entrada y salida queda registrada con su costo, y Flowbit te avisa antes de que un producto se agote.',
    benefits: [
      { title: 'Trazabilidad completa', description: 'Cada movimiento guarda su origen (compra, venta, punto de venta, ajuste o traspaso), así reconstruyes la historia de cualquier producto.' },
      { title: 'Valor de inventario confiable', description: 'Costo promedio ponderado recalculado en cada entrada y valoración reconstruible a cualquier fecha.' },
      { title: 'Reabastecimiento a tiempo', description: 'Cuando un producto cruza su mínimo se crea una tarea de reabastecimiento con prioridad según la gravedad, y se cierra sola al reponerse.' }
    ],
    features: [
      { title: 'Catálogo de productos', description: 'SKU, código de barras, costos, precios, variantes y existencias mínimas.' },
      { title: 'Varios almacenes', description: 'Existencias, reservas y traspasos por almacén o sucursal.' },
      { title: 'Movimientos con código QR', description: 'Cada movimiento (picking) tiene su QR para escanearlo y confirmarlo desde el celular.' },
      { title: 'Reporte de inventario', description: 'Existencias y valor por producto y almacén, con alerta de productos sin costo.' },
      { title: 'Kardex y trazabilidad', description: 'Historial de entradas y salidas de cada producto con costo unitario y saldo.' },
      { title: 'Integrado con ventas', description: 'Órdenes, punto de venta y tienda en línea mueven el mismo inventario.' }
    ],
    useCases: [
      'Comercios con bodega y piso de venta que necesitan saber qué reponer.',
      'Distribuidores con varias sucursales que hacen traspasos entre almacenes.',
      'Talleres y fabricantes que controlan materia prima y producto terminado.'
    ],
    faqs: [
      { question: '¿Puedo manejar varios almacenes?', answer: 'Sí. Puedes crear los almacenes que necesites, consultar existencias y reservas de cada uno y hacer traspasos entre ellos.' },
      { question: '¿Qué método de costeo usa Flowbit?', answer: 'Costo promedio ponderado. Se recalcula con cada entrada y cada movimiento guarda el costo, de modo que la valoración de cualquier fecha se puede reconstruir.' },
      { question: '¿Puedo usar el celular en el almacén?', answer: 'Sí. Los movimientos tienen código QR y una vista de escaneo pensada para el celular.' }
    ],
    manualArticles: ['products-create', 'warehouses-list', 'pickings-scan', 'inventory-report', 'inventory-traceability'],
    related: ['ventas', 'punto-de-venta', 'tienda-en-linea']
  },
  {
    slug: 'tienda-en-linea',
    name: 'Tienda en línea',
    category: 'Canales digitales',
    icon: 'storefront',
    gradient: 'from-fuchsia-500 to-violet-600',
    tagline: 'Tu e-commerce con cupones, envíos, pagos con tarjeta y analítica.',
    mexico: 'Precios en pesos, checkout en español y cobro por transferencia, contra entrega o tarjeta con Stripe, que opera en México.',
    seoTitle: 'Tienda en línea gratis con inventario | Flowbit ERP',
    seoDescription: 'Tienda en línea gratis para negocios en México: catálogo desde tu inventario, precios en pesos, cupones, envíos y pagos con tarjeta vía Stripe.',
    keywords: ['tienda en línea gratis', 'crear tienda online', 'e-commerce gratis', 'tienda virtual', 'vender por internet', 'carrito de compras'],
    headline: 'Crea tu tienda en línea gratis, conectada a tu inventario y tus ventas',
    intro: 'Publica tu catálogo en minutos con tu marca. Los pedidos llegan como órdenes de venta, descuentan inventario y se cobran con los métodos que elijas.',
    benefits: [
      { title: 'Un solo inventario', description: 'Lo que vendes en línea se descuenta del mismo inventario que usan tu almacén y tu punto de venta. No hay que sincronizar nada.' },
      { title: 'Cobra como prefieras', description: 'Transferencia, contra entrega o tarjeta con Stripe Checkout. Flowbit nunca guarda datos de tarjeta.' },
      { title: 'Entiende a tus visitantes', description: 'Analítica propia de visitas, productos vistos, carritos y conversiones, sin depender de terceros.' }
    ],
    features: [
      { title: 'Plantillas y paletas', description: 'Elige diseño y colores; el contraste se ajusta para que tu tienda se lea bien.' },
      { title: 'Portada configurable', description: 'Ordena secciones de productos destacados, categorías y banners.' },
      { title: 'Cupones de descuento', description: 'Cupones por porcentaje o monto, con vigencia y límites de uso.' },
      { title: 'Métodos de envío', description: 'Define tus opciones de envío con su tarifa y tiempo estimado de entrega.' },
      { title: 'Pagos con tarjeta', description: 'Stripe Checkout con la cuenta de tu empresa y confirmación por webhook.' },
      { title: 'Cuenta de cliente', description: 'Tus clientes consultan sus pedidos desde su cuenta.' }
    ],
    useCases: [
      'Negocios que hoy venden por redes sociales y quieren un catálogo con carrito.',
      'Tiendas físicas que quieren abrir un canal en línea sin otro sistema.',
      'Marcas que necesitan medir qué productos generan más interés.'
    ],
    faqs: [
      { question: '¿Cuánto cuesta la tienda en línea?', answer: 'La tienda está incluida en Flowbit sin costo. Si cobras con tarjeta, Stripe aplica sus propias comisiones por transacción.' },
      { question: '¿Necesito saber programar?', answer: 'No. Activas la tienda, eliges plantilla, colores y productos desde el panel, y queda publicada en su propia dirección.' },
      { question: '¿Los pedidos en línea afectan mi inventario?', answer: 'Sí. Cada pedido se convierte en una orden de venta de Flowbit y reserva o descuenta inventario como cualquier otra venta.' }
    ],
    manualArticles: ['storefront-settings', 'storefront-stripe', 'storefront-analytics', 'storefront-public'],
    related: ['sitio-web', 'inventario', 'punto-de-venta']
  },
  {
    slug: 'sitio-web',
    name: 'Sitio web y blog',
    category: 'Canales digitales',
    icon: 'website',
    gradient: 'from-violet-500 to-indigo-600',
    tagline: 'Constructor de páginas, blog, menús y formularios de contacto.',
    mexico: 'Panel, editor y plantillas en español, fechas del blog en formato mexicano y mensajes de contacto que llegan directo a tu CRM.',
    seoTitle: 'Crea el sitio web de tu empresa gratis | Flowbit ERP',
    seoDescription: 'Constructor de sitios web gratis y en español para empresas: páginas por secciones, blog, menús, galerías y formularios conectados a tu CRM.',
    keywords: ['crear página web gratis', 'sitio web para empresas', 'constructor de páginas web', 'blog para empresas', 'CMS gratis'],
    headline: 'Crea el sitio web de tu empresa gratis, con blog y formularios conectados',
    intro: 'Arma tu sitio con secciones listas para usar, publica artículos en tu blog y recibe mensajes de contacto directo en Flowbit. Comparte diseño con tu tienda en línea.',
    benefits: [
      { title: 'Sin depender de un desarrollador', description: 'Construye páginas combinando secciones: portada, servicios, testimonios, galerías y más.' },
      { title: 'Listo para buscadores', description: 'Cada sitio publica su propio sitemap, títulos y descripciones editables, y redirecciones para no perder posiciones.' },
      { title: 'Contactos que no se pierden', description: 'Los mensajes del formulario llegan al panel y pueden convertirse en leads del CRM.' }
    ],
    features: [
      { title: 'Constructor por secciones', description: 'Agrega, ordena y edita secciones sin tocar código.' },
      { title: 'Blog completo', description: 'Posts con editor visual, categorías, etiquetas, autores y comentarios moderados.' },
      { title: 'Menús y redirecciones', description: 'Define la navegación del sitio y redirige direcciones antiguas.' },
      { title: 'Medios y galerías', description: 'Biblioteca de imágenes y galerías para tus páginas y artículos.' },
      { title: 'Formularios de contacto', description: 'Recibe mensajes en el panel y conviértelos en oportunidades.' },
      { title: 'Contenido seguro', description: 'El HTML de páginas y artículos se sanea en el servidor antes de publicarse.' }
    ],
    useCases: [
      'Pymes y profesionales que necesitan una presencia web profesional.',
      'Empresas que quieren publicar contenido en un blog para atraer clientes.',
      'Negocios con tienda en línea que buscan un sitio con el mismo diseño.'
    ],
    faqs: [
      { question: '¿Puedo tener un blog en mi sitio?', answer: 'Sí. El sitio incluye blog con categorías, etiquetas, autores y comentarios moderados.' },
      { question: '¿El sitio está optimizado para Google?', answer: 'Sí. Cada sitio genera su sitemap, permite editar título y descripción de cada página y administra redirecciones.' },
      { question: '¿Cuánto cuesta?', answer: 'El constructor de sitios web está incluido en Flowbit sin costo.' }
    ],
    manualArticles: ['website-settings', 'website-pages', 'website-blog-posts', 'website-menus'],
    related: ['tienda-en-linea', 'crm', 'contactos']
  },
  {
    slug: 'recursos-humanos',
    name: 'Recursos Humanos',
    category: 'Personas',
    icon: 'hr',
    gradient: 'from-indigo-500 to-fuchsia-500',
    tagline: 'Empleados, asistencia con kiosco, vacaciones e inasistencias.',
    mexico: 'Expediente con CURP, NSS y RFC, días de vacaciones según el artículo 76 de la Ley Federal del Trabajo (reforma 2023) y días de descanso obligatorio del artículo 74.',
    seoTitle: 'Control de asistencia y RR. HH. gratis | Flowbit ERP',
    seoDescription: 'Software de RR. HH. gratis para México: expediente con CURP y NSS, checador con kiosco y NIP, vacaciones según la LFT, retardos y horas extra.',
    keywords: ['software de recursos humanos gratis', 'control de asistencia', 'checador de asistencia', 'reloj checador', 'control de vacaciones', 'expediente de empleados'],
    headline: 'Software de Recursos Humanos y control de asistencia gratis',
    intro: 'Centraliza el expediente de tu equipo, registra asistencia desde un kiosco con NIP y gestiona vacaciones y permisos. Retardos, horas extra y días de vacaciones los calcula el sistema.',
    benefits: [
      { title: 'Checador sin hardware especial', description: 'Cualquier tableta o computadora se convierte en kiosco de asistencia: cada empleado marca con su NIP.' },
      { title: 'Cálculos automáticos', description: 'Retardos, horas extra y días de vacaciones se calculan a partir del horario de cada persona.' },
      { title: 'Datos sensibles protegidos', description: 'La información privada y fiscal solo la ven dueños y administradores; cada empleado consulta lo suyo.' }
    ],
    features: [
      { title: 'Expediente de empleados', description: 'Datos laborales, departamento, puesto y datos privados para nómina, sin duplicar el contacto.' },
      { title: 'Kiosco de asistencia con NIP', description: 'Enlace seguro por kiosco, bloqueo tras intentos fallidos y detección de marcas duplicadas.' },
      { title: 'Horarios de trabajo', description: 'Jornadas por día, tolerancia de retardo y días de descanso.' },
      { title: 'Vacaciones y permisos', description: 'Solicitudes, aprobación, saldos por empleado y tipos de ausencia configurables.' },
      { title: 'Inasistencias e incapacidades', description: 'Registro de faltas que se reflejan después en la nómina.' },
      { title: 'Días festivos y reporte', description: 'Calendario de festivos y reporte de asistencia por periodo.' }
    ],
    useCases: [
      'Negocios que hoy llevan la asistencia en papel o en un reloj checador aislado.',
      'Empresas con varias sucursales que necesitan un kiosco en cada una.',
      'Áreas de RR. HH. que quieren controlar vacaciones conforme a la ley.'
    ],
    faqs: [
      { question: '¿Necesito comprar un reloj checador?', answer: 'No. El kiosco funciona en el navegador de una tableta o computadora y cada empleado marca con su NIP.' },
      { question: '¿Calcula los días de vacaciones?', answer: 'Sí. Los días de cada solicitud se calculan según el horario de la persona y los días festivos, y se descuentan de su saldo.' },
      { question: '¿Se conecta con la nómina?', answer: 'Sí. Faltas, incapacidades, vacaciones y horas extra aprobadas alimentan el cálculo de la nómina de Flowbit.' }
    ],
    manualArticles: ['employees-create', 'hr-kiosks', 'hr-attendances', 'hr-leaves', 'hr-work-schedules'],
    related: ['nomina', 'aprobaciones', 'proyectos']
  },
  {
    slug: 'nomina',
    name: 'Nómina',
    category: 'Personas',
    icon: 'payroll',
    gradient: 'from-violet-600 to-fuchsia-600',
    tagline: 'Cálculo de nómina en México con ISR, IMSS e INFONAVIT.',
    mexico: 'Tarifa de ISR, subsidio para el empleo, cuotas obrero-patronales del IMSS con tope en UMA, INFONAVIT, ISN y percepciones de la LFT. Guarda las claves de los catálogos del SAT para el CFDI de nómina.',
    seoTitle: 'Software de nómina gratis México: ISR e IMSS | Flowbit ERP',
    seoDescription: 'Calcula tu nómina en México gratis: ISR, subsidio para el empleo, cuotas IMSS, INFONAVIT e ISN, horas extra, prima vacacional y recibos.',
    keywords: ['software de nómina gratis', 'calcular nómina México', 'cálculo de ISR', 'cuotas IMSS', 'sistema de nómina', 'recibos de nómina'],
    headline: 'Software de nómina gratis para México: ISR, IMSS e INFONAVIT',
    intro: 'Calcula periodos semanales, quincenales o mensuales a partir de la asistencia real de tu equipo. Aprueba, paga y comparte los recibos desde el mismo lugar.',
    benefits: [
      { title: 'Nómina basada en la asistencia real', description: 'Faltas, incapacidades, vacaciones y horas extra aprobadas entran solas al cálculo.' },
      { title: 'Parámetros fiscales por año', description: 'Tablas de ISR, UMA, cuotas IMSS e ISN configurables por empresa y por año.' },
      { title: 'Historial que no se altera', description: 'Una nómina aprobada o pagada ya no se puede modificar, lo que da certeza ante auditorías.' }
    ],
    features: [
      { title: 'ISR y subsidio para el empleo', description: 'Tarifa proporcional a los días pagados y subsidio acreditado contra el ISR.' },
      { title: 'Cuotas IMSS e INFONAVIT', description: 'Ramos del IMSS con tope de SBC, aportaciones de INFONAVIT e impuesto sobre nómina.' },
      { title: 'Percepciones de ley', description: 'Horas extra dobles y triples, prima dominical, prima vacacional, festivos laborados y aguinaldo.' },
      { title: 'Salarios con SDI y SBC', description: 'Historial de salarios con salario diario integrado sugerido por factor de integración.' },
      { title: 'Flujo de aprobación', description: 'Calcula, revisa, aprueba y marca como pagada cada nómina.' },
      { title: 'Mis recibos', description: 'Cada empleado consulta sus recibos de nómina desde su cuenta.' }
    ],
    useCases: [
      'Pymes mexicanas que calculan la nómina en hojas de cálculo.',
      'Despachos que quieren validar los cálculos antes de timbrar.',
      'Empresas que necesitan ligar asistencia y nómina en un solo sistema.'
    ],
    faqs: [
      { question: '¿Flowbit timbra los recibos de nómina (CFDI)?', answer: 'No. Flowbit calcula la nómina y genera los recibos, pero el timbrado CFDI se hace con tu proveedor de facturación.' },
      { question: '¿Las tablas de ISR están actualizadas?', answer: 'Los parámetros fiscales se configuran por empresa y por año. Antes de pagar, verifica que coincidan con lo publicado en el DOF y el SAT para el ejercicio vigente.' },
      { question: '¿Qué periodos de pago admite?', answer: 'Semanal, quincenal y mensual, con prorrateo para ingresos o bajas a mitad del periodo.' }
    ],
    manualArticles: ['payroll-settings', 'payroll-salaries', 'payroll-periods', 'payroll-slip'],
    related: ['recursos-humanos', 'aprobaciones', 'contactos']
  },
  {
    slug: 'proyectos',
    name: 'Proyectos y tareas',
    category: 'Colaboración',
    icon: 'projects',
    gradient: 'from-violet-500 to-fuchsia-600',
    tagline: 'Proyectos, tareas, diagrama de Gantt y enlace para clientes.',
    mexico: 'Todo en español, con fechas en formato mexicano y un enlace público para que tus clientes vean el avance sin crear cuenta.',
    seoTitle: 'Gestor de proyectos gratis con Gantt | Flowbit ERP',
    seoDescription: 'Gestor de proyectos y tareas gratis en español: responsables, prioridades, diagrama de Gantt, avance y un enlace público para tu cliente.',
    keywords: ['gestor de proyectos gratis', 'software de gestión de proyectos', 'diagrama de Gantt', 'gestión de tareas', 'seguimiento de proyectos'],
    headline: 'Gestor de proyectos y tareas gratis, con diagrama de Gantt',
    intro: 'Planea cada proyecto por tipo, divide el trabajo en tareas con responsable y fecha, y mide el avance real. Comparte el progreso con tu cliente sin darle acceso al panel.',
    benefits: [
      { title: 'Todo el equipo sabe qué sigue', description: 'Cada tarea tiene responsable, prioridad y fecha, y las notificaciones avisan de lo pendiente.' },
      { title: 'Clientes informados', description: 'Comparte un enlace público de solo lectura con el avance del proyecto.' },
      { title: 'Conectado con la operación', description: 'Flowbit crea tareas automáticas, como las de reabastecimiento de inventario.' }
    ],
    features: [
      { title: 'Tipos de proyecto', description: 'Clasifica tus proyectos y filtra el portafolio por tipo y estado.' },
      { title: 'Tareas con prioridad', description: 'Asigna, prioriza y vincula tareas a proyectos.' },
      { title: 'Diagrama de Gantt', description: 'Visualiza fechas y duración de las tareas en el tiempo.' },
      { title: 'KPIs de avance', description: 'Porcentaje de avance y tareas por estado en cada proyecto.' },
      { title: 'Enlace público', description: 'Vista compartible del proyecto para tus clientes.' },
      { title: 'Agenda', description: 'Tareas y actividades del equipo en un calendario común.' }
    ],
    useCases: [
      'Agencias y despachos que entregan proyectos a clientes.',
      'Equipos de implementación y soporte con varias tareas en paralelo.',
      'Empresas que quieren dejar las listas de pendientes dispersas.'
    ],
    faqs: [
      { question: '¿Tiene diagrama de Gantt?', answer: 'Sí. Cada proyecto incluye una vista de Gantt con sus tareas.' },
      { question: '¿Puedo compartir un proyecto con mi cliente?', answer: 'Sí. Genera un enlace público de solo lectura para que tu cliente vea el avance sin crear cuenta.' },
      { question: '¿Hay límite de proyectos o usuarios?', answer: 'No. Flowbit no limita proyectos, tareas ni usuarios.' }
    ],
    manualArticles: ['projects-create', 'tasks-list', 'public-project', 'agenda'],
    related: ['aprobaciones', 'crm', 'recursos-humanos']
  },
  {
    slug: 'aprobaciones',
    name: 'Aprobaciones',
    category: 'Colaboración',
    icon: 'approvals',
    gradient: 'from-indigo-500 to-violet-600',
    tagline: 'Solicitudes con flujo de autorización y aprobadores.',
    mexico: 'Solicitudes en español con montos en pesos, pensadas para autorizar compras, gastos y viáticos con evidencia de quién aprobó y cuándo.',
    seoTitle: 'Flujos de aprobación gratis para empresas | Flowbit ERP',
    seoDescription: 'Flujos de aprobación en español: solicitudes de compra, gastos o viáticos con montos en pesos, categorías, aprobadores y notificaciones.',
    keywords: ['flujo de aprobación', 'software de aprobaciones', 'solicitudes internas', 'autorización de gastos', 'workflow de aprobación'],
    headline: 'Flujos de aprobación para autorizar solicitudes sin correos ni papel',
    intro: 'Cualquier persona del equipo crea una solicitud, el aprobador correcto recibe el aviso y la decisión queda registrada con fecha y responsable.',
    benefits: [
      { title: 'Decisiones más rápidas', description: 'Cada solicitud llega directo a quien debe aprobarla, con aviso en el panel.' },
      { title: 'Control y evidencia', description: 'Queda registrado quién pidió, quién aprobó o rechazó y cuándo.' },
      { title: 'Reglas por categoría', description: 'Cada tipo de solicitud tiene sus propios aprobadores.' }
    ],
    features: [
      { title: 'Solicitudes', description: 'Crea solicitudes con descripción, monto y fecha.' },
      { title: 'Categorías', description: 'Compras, gastos, viáticos, permisos o las que definas.' },
      { title: 'Aprobadores', description: 'Asigna quién autoriza cada categoría.' },
      { title: 'Notificaciones', description: 'Las solicitudes pendientes aparecen en las notificaciones del panel.' },
      { title: 'Historial', description: 'Consulta el estado y la resolución de cada solicitud.' },
      { title: 'Multiempresa', description: 'Cada empresa tiene sus propias categorías y aprobadores.' }
    ],
    useCases: [
      'Empresas que autorizan compras y gastos por correo o WhatsApp.',
      'Equipos que necesitan evidencia de cada autorización.',
      'Organizaciones con varios niveles de responsables.'
    ],
    faqs: [
      { question: '¿Puedo definir quién aprueba cada tipo de solicitud?', answer: 'Sí. Cada categoría tiene sus aprobadores asignados.' },
      { question: '¿Cómo se entera el aprobador?', answer: 'Las solicitudes pendientes aparecen en las notificaciones del panel del aprobador.' },
      { question: '¿Tiene costo?', answer: 'No. El módulo de aprobaciones está incluido en Flowbit sin costo.' }
    ],
    manualArticles: ['approval-requests-create', 'approval-categories-list', 'approval-managers-list'],
    related: ['proyectos', 'recursos-humanos', 'ventas']
  },
  {
    slug: 'contactos',
    name: 'Contactos',
    category: 'Operación',
    icon: 'contacts',
    gradient: 'from-indigo-500 to-violet-600',
    tagline: 'Clientes, proveedores y empleados en una sola agenda.',
    mexico: 'Ficha con RFC y razón social para cada cliente y proveedor, y un mismo contacto que también puede ser empleado, sin capturarlo dos veces.',
    seoTitle: 'Base de datos de clientes y proveedores | Flowbit ERP',
    seoDescription: 'Agenda única de clientes, proveedores y empleados con RFC, razón social, direcciones, historial de ventas y métricas por contacto. Gratis.',
    keywords: ['base de datos de clientes', 'directorio de clientes y proveedores', 'gestión de contactos', 'cartera de clientes', 'RFC de clientes'],
    headline: 'Una sola base de datos de clientes, proveedores y empleados',
    intro: 'Captura cada contacto una sola vez y úsalo en el CRM, las ventas, las compras y Recursos Humanos. Consulta su historial y sus métricas desde su ficha.',
    benefits: [
      { title: 'Sin datos duplicados', description: 'El mismo contacto es cliente en ventas, lead en el CRM o empleado en RR. HH.' },
      { title: 'Datos fiscales a la mano', description: 'RFC, razón social y direcciones listos para cotizar y vender.' },
      { title: 'Conoce a tus clientes', description: 'Métricas de compras e historial de órdenes en la ficha de cada contacto.' }
    ],
    features: [
      { title: 'Ficha de contacto', description: 'Personas y empresas con datos de contacto y fiscales.' },
      { title: 'Panel de métricas', description: 'Compras, órdenes y saldo por contacto.' },
      { title: 'Búsqueda rápida', description: 'Encuentra contactos por nombre, correo o RFC.' },
      { title: 'Equipo e invitaciones', description: 'Invita a tu equipo con roles de dueño, administrador o miembro.' },
      { title: 'Multiempresa', description: 'Administra varias empresas con una sola cuenta y cambia entre ellas.' },
      { title: 'Seguridad por empresa', description: 'Cada empresa solo ve sus propios datos.' }
    ],
    useCases: [
      'Negocios con su cartera de clientes repartida entre hojas de cálculo y teléfonos.',
      'Empresas que compran y venden con los mismos socios comerciales.',
      'Grupos con varias razones sociales.'
    ],
    faqs: [
      { question: '¿Puedo manejar varias empresas con una cuenta?', answer: 'Sí. Una misma cuenta puede pertenecer a varias empresas y cambiar entre ellas desde el selector del panel.' },
      { question: '¿Quién puede ver mis contactos?', answer: 'Solo los miembros de tu empresa. Los datos están aislados por empresa con seguridad a nivel de fila.' },
      { question: '¿Hay límite de contactos?', answer: 'No. Puedes registrar todos los contactos que necesites.' }
    ],
    manualArticles: ['partners-create', 'partners-detail', 'team-list', 'invitations'],
    related: ['crm', 'ventas', 'recursos-humanos']
  }
]

/** Trazos SVG (viewBox 24×24, stroke) de cada icono de módulo. */
export const FEATURE_ICON_PATHS: Record<FeatureIcon, string> = {
  crm: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  sales: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  pos: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  inventory: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  storefront: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z',
  website: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9',
  hr: 'M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2',
  payroll: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
  projects: 'M13 10V3L4 14h7v7l9-11h-7z',
  approvals: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  contacts: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
}

export function getFeatureModule(slug: string): FeatureModule | undefined {
  return FEATURE_MODULES.find(module => module.slug === slug)
}

/**
 * Posicionamiento de la marca. Se repite igual en títulos, H1, metadatos y
 * redes para que los buscadores asocien «Flowbit ERP» con esta categoría.
 */
export const BRAND_NAME = 'Flowbit ERP'
export const BRAND_POSITIONING = 'ERP open source en español hecho para México'

/** Lo que hace a Flowbit un ERP para México. Cada punto existe en el producto. */
export const MEXICO_HIGHLIGHTS: FeaturePoint[] = [
  { title: 'Nómina mexicana incluida', description: 'ISR con subsidio para el empleo, cuotas IMSS con tope en UMA, INFONAVIT e ISN, con parámetros fiscales por año.' },
  { title: 'Ley Federal del Trabajo', description: 'Vacaciones según el artículo 76 (reforma 2023), días de descanso obligatorio, horas extra dobles y triples y prima dominical.' },
  { title: 'Datos fiscales del SAT', description: 'RFC y razón social de clientes y proveedores; CURP, NSS y claves de los catálogos del SAT para la nómina de tus empleados.' },
  { title: 'IVA y pesos mexicanos', description: 'IVA por línea con precios con o sin impuesto incluido, montos en pesos y compras en otra moneda con tipo de cambio.' },
  { title: 'En español, de verdad', description: 'Interfaz, manual de usuario y asistente Bit en español, con fechas y moneda en formato mexicano.' },
  { title: 'Open source con licencia MIT', description: 'Código público en GitHub: úsalo gratis en la nube o instálalo en tu propio servidor, sin pagar licencias.' }
]

/** Preguntas frecuentes generales de la landing y del hub. */
export const PLATFORM_FAQS: FeatureFaq[] = [
  { question: '¿Qué es Flowbit ERP?', answer: 'Flowbit es un ERP open source en español hecho para México. Reúne CRM, ventas, punto de venta, inventario, tienda en línea, sitio web, Recursos Humanos, nómina, proyectos y aprobaciones en una sola plataforma web, gratis y sin límite de usuarios.' },
  { question: '¿Por qué un ERP hecho para México?', answer: 'Porque calcula la nómina con ISR, IMSS, INFONAVIT e ISN, aplica la Ley Federal del Trabajo en vacaciones, horas extra y días festivos, maneja IVA y pesos mexicanos, y guarda RFC, CURP y NSS. No hay que adaptar un sistema extranjero.' },
  { question: '¿Flowbit es gratis de verdad?', answer: 'Sí. Todos los módulos y usuarios están incluidos sin costo y no se pide tarjeta de crédito. El código es público con licencia MIT.' },
  { question: '¿Flowbit timbra facturas o recibos de nómina (CFDI)?', answer: 'Todavía no. Flowbit guarda los datos fiscales y las claves del SAT, pero el timbrado se hace con tu proveedor de facturación actual.' },
  { question: '¿Necesito instalar algo?', answer: 'No. Flowbit funciona en el navegador. Creas tu cuenta, das de alta tu empresa y empiezas a operar. Como es open source, también puedes instalarlo en tu propio servidor.' },
  { question: '¿Puedo administrar varias empresas o razones sociales?', answer: 'Sí. Una cuenta puede pertenecer a varias empresas, cada una con sus datos aislados y su propio equipo.' },
  { question: '¿Mis datos están seguros?', answer: 'Cada empresa solo puede ver sus propios datos gracias a la seguridad a nivel de fila de la base de datos. No vendemos tu información.' }
]
