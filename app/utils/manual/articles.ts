import type { DocArticle } from './types'

/**
 * Catálogo de artículos de la documentación de Flowbit.
 * Fuente única para el manual público (/manual), el asistente Bit
 * y los botones de compartir. Al agregar un módulo nuevo, agrega aquí su artículo.
 */
export const ARTICLES: DocArticle[] = [
  // ─── PRIMEROS PASOS ──────────────────────────────────────────────────────────
  {
    id: 'getting-started',
    routePatterns: [],
    module: 'core',
    moduleLabel: 'General',
    moduleEmoji: '🏠',
    title: 'Primeros pasos en Flowbit',
    viewType: 'config',
    level: 'basico',
    summary: 'Configura tu empresa, invita a tu equipo y registra tu primera operación en Flowbit en menos de 15 minutos.',
    description: 'Guía de arranque para una empresa nueva: qué configurar primero, en qué orden y qué puedes ignorar hasta más adelante. Sigue el asistente paso a paso y tendrás la plataforma lista para operar.',
    importance: 'El orden en que configuras Flowbit importa: los contactos, productos y almacenes son la base sobre la que se apoyan órdenes, pickings, proyectos y la tienda en línea. Configurarlos primero evita tener que corregir datos después.',
    tips: [
      'No intentes configurar todo el primer día. Empieza por el módulo que resuelve tu dolor más urgente (ventas, inventario o proyectos) y crece desde ahí.',
      'Todos los datos están separados por empresa. Si administras varias, usa el selector de empresa del header antes de capturar información.',
      'Registra tus contactos reales desde el inicio: clientes, proveedores y empleados viven en el mismo módulo diferenciados por su rol.',
      'Invita a tu equipo cuando ya tengas la estructura básica: así encuentran el sistema listo para usar y no vacío.'
    ],
    wizard: {
      id: 'wz-onboarding',
      title: 'Pon a operar tu empresa',
      description: 'Cinco pasos para pasar de una cuenta vacía a un sistema funcionando.',
      estimatedMinutes: 15,
      steps: [
        {
          id: 'company',
          title: 'Completa los datos de tu empresa',
          description: 'Nombre comercial, identificación fiscal, moneda y datos de contacto. Estos datos aparecen en documentos, tickets y en tu tienda en línea.',
          action: { label: 'Ir a Configuración', route: '/admin/settings' },
          checklist: ['Nombre y razón social', 'Identificación fiscal', 'Moneda y datos de contacto']
        },
        {
          id: 'contacts',
          title: 'Registra tus primeros contactos',
          description: 'Da de alta al menos un cliente y un proveedor. Todo documento del sistema (orden, proyecto, picking) se asocia a un contacto.',
          action: { label: 'Crear contacto', route: '/admin/partners/create' },
          tip: 'Puedes marcar un mismo contacto como cliente y proveedor si te compra y te vende.'
        },
        {
          id: 'catalog',
          title: 'Carga tu catálogo y tu almacén',
          description: 'Crea los productos o servicios que vendes y al menos un almacén donde se guarda el inventario físico.',
          action: { label: 'Crear producto', route: '/admin/products/create' },
          checklist: ['Al menos un almacén activo', 'Productos con precio de venta', 'Stock inicial cargado con un picking de entrada'],
          tip: 'Los servicios no necesitan almacén: márcalos como tipo servicio y no manejarán stock.'
        },
        {
          id: 'operation',
          title: 'Registra tu primera operación',
          description: 'Crea una orden de venta real de principio a fin: cliente, líneas de producto, confirmación y entrega. Así ves cómo se conecta todo el sistema.',
          action: { label: 'Crear orden', route: '/admin/orders/create' },
          tip: 'Al marcar la orden como entregada, Flowbit genera el picking de salida y el inventario se descuenta al confirmarlo.'
        },
        {
          id: 'team',
          title: 'Invita a tu equipo',
          description: 'Agrega a las personas que operarán contigo y asígnales su rol: propietario, administrador o miembro.',
          action: { label: 'Ir a Equipo', route: '/admin/team' },
          tip: 'Los miembros ven y operan los módulos; los administradores además configuran catálogos, cajas y aprobaciones.'
        }
      ]
    },
    faqs: [
      {
        question: '¿Puedo manejar varias empresas con una sola cuenta?',
        answer: 'Sí. Cada empresa tiene sus propios datos y usuarios. Cambia entre ellas con el selector del header; la empresa seleccionada se recuerda entre sesiones.'
      },
      {
        question: '¿Qué pasa si capturo algo mal?',
        answer: 'Casi todo es editable y nada se borra de verdad: los registros se archivan (quedan inactivos) para conservar la trazabilidad de las operaciones que los usaron.'
      },
      {
        question: '¿Necesito configurar todos los módulos?',
        answer: 'No. Los módulos son independientes: puedes usar solo Proyectos, solo Ventas o solo el Punto de Venta. Configura el resto cuando lo necesites.'
      }
    ],
    relatedModules: [
      { label: 'Configuración', route: '/admin/settings' },
      { label: 'Contactos', route: '/admin/partners' },
      { label: 'Equipo', route: '/admin/team' }
    ],
    relatedArticles: ['settings', 'partners-create', 'team-list'],
    tags: ['inicio', 'onboarding', 'primeros pasos', 'configuración', 'empezar', 'tutorial']
  },
  // ─── DASHBOARD ───────────────────────────────────────────────────────────────
  {
    id: 'dashboard',
    routePatterns: ['/admin'],
    module: 'core',
    moduleLabel: 'General',
    moduleEmoji: '🏠',
    title: 'Dashboard Principal',
    viewType: 'dashboard',
    description: 'El dashboard es tu vista general de la empresa. Muestra métricas clave, accesos rápidos y el estado actual de los módulos principales.',
    importance: 'Es el punto de partida del panel. Permite tener una visión rápida del estado del negocio sin necesidad de navegar a cada módulo. Revísalo al inicio de cada jornada.',
    tips: [
      'Revisa el dashboard al inicio de cada jornada para identificar alertas y pendientes.',
      'Las métricas se actualizan en tiempo real conforme se realizan operaciones en la plataforma.',
      'Desde el header puedes acceder rápidamente a tus tareas asignadas, solicitudes por aprobar y actividades de seguimiento CRM.',
      'El ícono de campana en el header muestra notificaciones de tareas y aprobaciones pendientes.'
    ],
    relatedModules: [
      { label: 'Agenda', route: '/admin/agenda' },
      { label: 'Tareas', route: '/admin/tasks' },
      { label: 'Solicitudes de Aprobación', route: '/admin/approval-requests' }
    ],
    tags: ['inicio', 'resumen', 'métricas', 'estadísticas', 'dashboard']
  },

  // ─── SOCIOS (PARTNERS) ───────────────────────────────────────────────────────
  {
    id: 'partners-list',
    routePatterns: ['/admin/partners'],
    module: 'partners',
    moduleLabel: 'Contactos / Socios',
    moduleEmoji: '👥',
    title: 'Lista de Socios',
    viewType: 'list',
    description: 'Los socios son las personas o empresas con las que mantienes relaciones comerciales: clientes, proveedores, contactos y colaboradores.',
    importance: 'El catálogo de socios es el núcleo del sistema. Sin socios correctamente registrados no es posible crear órdenes, asignar proyectos, gestionar el equipo o llevar seguimiento CRM. Toda operación en Flowbit está vinculada a un socio.',
    tips: [
      'Un socio puede tener múltiples roles: cliente, proveedor y contacto al mismo tiempo.',
      'Usa las categorías para segmentar socios (Cliente Premium, Proveedor Estratégico, etc.).',
      'Antes de crear un socio nuevo, verifica que no exista con el mismo email para evitar duplicados.',
      'Los socios archivados no aparecen en listados activos pero conservan su historial completo.',
      'La búsqueda localiza socios por nombre, email o RFC en tiempo real.'
    ],
    relatedModules: [
      { label: 'Crear Socio', route: '/admin/partners/create' },
      { label: 'Órdenes', route: '/admin/orders' },
      { label: 'Proyectos', route: '/admin/projects' },
      { label: 'CRM Leads', route: '/admin/crm/leads' }
    ],
    tags: ['socios', 'clientes', 'proveedores', 'contactos', 'personas', 'empresas', 'partners']
  },
  {
    id: 'partners-create',
    routePatterns: ['/admin/partners/create'],
    module: 'partners',
    moduleLabel: 'Contactos / Socios',
    moduleEmoji: '👥',
    title: 'Crear Nuevo Socio',
    viewType: 'create',
    description: 'Registra un nuevo socio en el sistema. Un socio puede ser una persona física o moral con la que mantienes relaciones comerciales.',
    importance: 'El registro correcto de socios garantiza la trazabilidad de todas las operaciones relacionadas (órdenes, proyectos, actividades CRM). Un socio mal registrado puede causar errores en facturación y reportes.',
    tips: [
      'El nombre es el campo más importante: usa el nombre completo o razón social oficial.',
      'El RFC es fundamental para la generación de documentos fiscales; verifica que sea correcto.',
      'Agrega la dirección completa para facilitar los pickings y envíos.',
      'Las categorías permiten filtrar y segmentar socios en reportes; asígnalas desde el inicio.',
      'Si el socio ya es cliente en otro sistema, busca primero si ya fue importado antes de crear uno nuevo.'
    ],
    fields: [
      { label: 'Nombre / Razón Social', required: true, type: 'text', description: 'Nombre completo de la persona o razón social de la empresa.', tip: 'Usa el nombre oficial que aparece en sus documentos legales para evitar problemas fiscales.' },
      { label: 'Tipo de Socio', required: false, type: 'select', description: 'Clasifica al socio como persona física o moral (empresa).', tip: 'Esta clasificación afecta los requisitos fiscales y formatos de documentos.' },
      { label: 'Email', required: false, type: 'text', description: 'Correo electrónico principal de contacto.', tip: 'Este email se usa para invitaciones al equipo y comunicaciones; asegúrate de que sea válido.' },
      { label: 'Teléfono', required: false, type: 'text', description: 'Número telefónico de contacto.', tip: 'Incluye el código de área y país para contactos internacionales (ej. +52 55 1234 5678).' },
      { label: 'RFC / Identificación Fiscal', required: false, type: 'text', description: 'Registro Federal de Contribuyentes u otro identificador fiscal.', tip: 'Requerido para emitir facturas; verifica el formato correcto (13 caracteres para personas físicas, 12 para morales).' },
      { label: 'Dirección', required: false, type: 'textarea', description: 'Dirección física del socio.', tip: 'La dirección completa facilita los envíos, pickings y documentos de entrega.' },
      { label: 'Categorías', required: false, type: 'relation', description: 'Etiquetas para clasificar al socio (Cliente, Proveedor, VIP, etc.).', tip: 'Puedes asignar múltiples categorías; úsalas para segmentar en reportes.' },
      { label: 'Notas', required: false, type: 'textarea', description: 'Información adicional relevante sobre el socio.', tip: 'Documenta condiciones especiales, preferencias de contacto o contexto de la relación.' }
    ],
    relatedModules: [
      { label: 'Lista de Socios', route: '/admin/partners' }
    ],
    tags: ['socio', 'crear', 'nuevo', 'registro', 'cliente', 'proveedor', 'contacto']
  },
  {
    id: 'partners-detail',
    routePatterns: ['/admin/partners/:id'],
    module: 'partners',
    moduleLabel: 'Contactos / Socios',
    moduleEmoji: '👥',
    title: 'Detalle de Socio',
    viewType: 'detail',
    description: 'Vista completa de un socio con toda su información, datos de contacto, categorías asignadas y acciones disponibles.',
    importance: 'Esta vista centraliza toda la información de un socio. Es el punto de partida para ver su historial de órdenes, proyectos y actividades CRM asociadas.',
    tips: [
      'Usa el botón "Editar" para modificar los datos del socio.',
      'Si necesitas archivar al socio, usa el menú de opciones (tres puntos) en la esquina superior.',
      'Un socio archivado conserva todo su historial pero no aparece en listados ni selectores.',
      'Verifica las categorías asignadas para asegurarte de que la segmentación sea correcta.'
    ],
    relatedModules: [
      { label: 'Lista de Socios', route: '/admin/partners' },
      { label: 'CRM Leads', route: '/admin/crm/leads' },
      { label: 'Órdenes', route: '/admin/orders' }
    ],
    tags: ['socio', 'detalle', 'editar', 'historial', 'información']
  },

  // ─── PRODUCTOS ───────────────────────────────────────────────────────────────
  {
    id: 'products-list',
    routePatterns: ['/admin/products'],
    module: 'products',
    moduleLabel: 'Productos',
    moduleEmoji: '📦',
    title: 'Catálogo de Productos',
    viewType: 'list',
    description: 'El catálogo de productos incluye todos los artículos, materiales y servicios que tu empresa maneja, vende o compra.',
    importance: 'Sin un catálogo de productos actualizado no es posible crear líneas de órdenes ni gestionar el inventario mediante pickings. Es la base del módulo de ventas y almacén.',
    tips: [
      'Mantén el SKU único por producto para evitar confusiones en pickings y reportes.',
      'El precio de lista es el precio base; puede modificarse en cada línea de orden individual.',
      'Activa el control de stock para recibir alertas cuando el inventario esté bajo.',
      'Usa categorías para organizar el catálogo (Electrónicos, Ropa, Servicios, etc.).',
      'El código de barras es necesario para usar el escáner QR en el módulo de pickings.'
    ],
    process: [
      { step: 1, title: 'Crear producto en catálogo', description: 'Registra el producto con SKU, nombre, precio y unidad de medida.' },
      { step: 2, title: 'Clasificar y configurar', description: 'Asigna categoría, activa control de stock y registra código de barras si aplica.' },
      { step: 3, title: 'Usar en órdenes', description: 'El producto ya está disponible para agregar a líneas de órdenes.' },
      { step: 4, title: 'Movimientos de inventario', description: 'El stock se actualiza automáticamente al completar pickings.' }
    ],
    relatedModules: [
      { label: 'Crear Producto', route: '/admin/products/create' },
      { label: 'Órdenes', route: '/admin/orders' },
      { label: 'Pickings', route: '/admin/pickings' },
      { label: 'Almacenes', route: '/admin/warehouses' }
    ],
    tags: ['productos', 'catálogo', 'inventario', 'artículos', 'servicios', 'SKU', 'stock']
  },
  {
    id: 'products-create',
    routePatterns: ['/admin/products/create'],
    module: 'products',
    moduleLabel: 'Productos',
    moduleEmoji: '📦',
    title: 'Crear Producto',
    viewType: 'create',
    description: 'Registra un nuevo producto o servicio en el catálogo de la empresa para usarlo en órdenes y pickings.',
    importance: 'Un producto bien registrado garantiza la precisión en órdenes, pickings y reportes de inventario. Los campos SKU y código de barras son especialmente críticos para la operación del almacén.',
    tips: [
      'El SKU debe ser único; usa un sistema de codificación consistente (ej. CAT-001, SERV-012).',
      'Si el producto no tiene control de stock (es un servicio), desmarca la opción de inventario.',
      'La unidad de medida debe corresponder a cómo vendes: pieza, caja, kg, hora, etc.',
      'El código de barras EAN/UPC es imprescindible para el escaneo en pickings.'
    ],
    fields: [
      { label: 'Nombre del Producto', required: true, type: 'text', description: 'Nombre descriptivo y claro del producto o servicio.', tip: 'Sé específico: "Laptop Dell XPS 15 i7 2023" es mucho mejor que "Laptop".' },
      { label: 'SKU / Código Interno', required: true, type: 'text', description: 'Código único de identificación del producto en tu sistema.', tip: 'Una vez asignado no debe cambiarse; defínelo con un estándar consistente desde el inicio.' },
      { label: 'Descripción', required: false, type: 'textarea', description: 'Descripción detallada: especificaciones técnicas, características y usos.', tip: 'Una buena descripción facilita la identificación correcta en órdenes y durante el picking.' },
      { label: 'Precio de Lista', required: false, type: 'number', description: 'Precio base de venta o compra del producto.', tip: 'Este es el precio predeterminado en órdenes; puede modificarse línea a línea.' },
      { label: 'Unidad de Medida (UOM)', required: false, type: 'select', description: 'Unidad en que se cuantifica: pieza, kg, litro, caja, hora, etc.', tip: 'Selecciona la UOM correcta; un error aquí afecta cantidades en todos los documentos.' },
      { label: 'Código de Barras', required: false, type: 'text', description: 'Código de barras EAN-13/UPC para escaneo en pickings.', tip: 'Si el producto tiene código de barras en el empaque, úsalo. Si no, asigna uno interno.' },
      { label: 'Categoría', required: false, type: 'select', description: 'Clasificación del producto dentro del catálogo.', tip: 'Las categorías facilitan la búsqueda y la generación de reportes por tipo de producto.' },
      { label: 'Control de Stock', required: false, type: 'boolean', description: 'Indica si se gestiona el inventario físico de este producto.', tip: 'Activa para productos físicos (afectan inventario); desactiva para servicios o digitales.' }
    ],
    relatedModules: [
      { label: 'Lista de Productos', route: '/admin/products' },
      { label: 'Almacenes', route: '/admin/warehouses' }
    ],
    tags: ['producto', 'crear', 'SKU', 'catálogo', 'inventario', 'código de barras']
  },
  {
    id: 'products-detail',
    routePatterns: ['/admin/products/:id'],
    module: 'products',
    moduleLabel: 'Productos',
    moduleEmoji: '📦',
    title: 'Detalle de Producto',
    viewType: 'detail',
    description: 'Vista completa de un producto con su información, configuración de inventario y disponibilidad para uso en órdenes.',
    importance: 'Permite verificar la información del producto antes de crear órdenes y monitorear su disponibilidad en el catálogo.',
    tips: [
      'El stock actual refleja los movimientos procesados mediante pickings completados.',
      'Si el stock es incorrecto, verifica que todos los pickings relacionados estén en estado "Completado".',
      'Puedes editar el precio de lista sin afectar órdenes ya confirmadas.',
      'El código de barras puede actualizarse si cambias de proveedor o presentación del producto.'
    ],
    relatedModules: [
      { label: 'Lista de Productos', route: '/admin/products' },
      { label: 'Pickings', route: '/admin/pickings' }
    ],
    tags: ['producto', 'detalle', 'stock', 'inventario', 'precio']
  },

  // ─── ALMACENES ────────────────────────────────────────────────────────────────
  {
    id: 'warehouses-list',
    routePatterns: ['/admin/warehouses'],
    module: 'warehouses',
    moduleLabel: 'Almacenes',
    moduleEmoji: '🏭',
    title: 'Almacenes',
    viewType: 'list',
    description: 'Los almacenes son las ubicaciones físicas donde se almacenan y gestionan los productos de la empresa. Cada almacén es un punto de origen o destino en los movimientos de inventario.',
    importance: 'Cada picking está asociado a un almacén de origen. Una correcta configuración garantiza la trazabilidad del inventario y permite saber exactamente qué hay en cada ubicación.',
    tips: [
      'Crea un almacén por cada ubicación física real: sucursal, bodega, piso de producción.',
      'El almacén principal suele ser el origen de la mayoría de los pickings de venta.',
      'Asigna un responsable a cada almacén para facilitar la coordinación operativa.',
      'Si manejas múltiples almacenes, verifica siempre que el picking apunte al almacén correcto.'
    ],
    relatedModules: [
      { label: 'Crear Almacén', route: '/admin/warehouses/create' },
      { label: 'Pickings', route: '/admin/pickings' },
      { label: 'Productos', route: '/admin/products' }
    ],
    tags: ['almacén', 'bodega', 'inventario', 'ubicación', 'logística']
  },
  {
    id: 'warehouses-create',
    routePatterns: ['/admin/warehouses/create'],
    module: 'warehouses',
    moduleLabel: 'Almacenes',
    moduleEmoji: '🏭',
    title: 'Crear Almacén',
    viewType: 'create',
    description: 'Registra una nueva ubicación de almacenamiento para gestionar los movimientos de inventario.',
    importance: 'Los almacenes son el origen de los pickings. Sin al menos un almacén registrado no es posible procesar movimientos de inventario.',
    tips: [
      'Usa nombres descriptivos que identifiquen claramente la ubicación: "Bodega Principal CDMX".',
      'La dirección del almacén es importante para la logística de pickings y envíos a clientes.',
      'Si tienes un solo almacén, igualmente debes crearlo para poder asignarlo a los pickings.'
    ],
    fields: [
      { label: 'Nombre del Almacén', required: true, type: 'text', description: 'Nombre identificador de la bodega o almacén.', tip: 'Incluye la ciudad o referencia: "Bodega Norte MTY", "Almacén Central CDMX".' },
      { label: 'Código', required: false, type: 'text', description: 'Código abreviado para identificar el almacén en reportes y pickings.', tip: 'Usa un código corto y consistente: BDG-MTY, ALM-CDMX, BOD-01.' },
      { label: 'Dirección', required: false, type: 'textarea', description: 'Dirección física completa del almacén.', tip: 'Incluye calle, número, colonia, ciudad y código postal.' },
      { label: 'Responsable', required: false, type: 'relation', description: 'Socio o miembro del equipo encargado del almacén.', tip: 'El responsable es el punto de contacto para operaciones y discrepancias de inventario.' },
      { label: 'Notas', required: false, type: 'textarea', description: 'Información adicional: horarios, instrucciones de acceso, capacidad.', tip: 'Documenta restricciones de acceso, horarios de operación y capacidad máxima.' }
    ],
    relatedModules: [
      { label: 'Lista de Almacenes', route: '/admin/warehouses' },
      { label: 'Pickings', route: '/admin/pickings' }
    ],
    tags: ['almacén', 'crear', 'bodega', 'inventario', 'ubicación']
  },
  {
    id: 'warehouses-detail',
    routePatterns: ['/admin/warehouses/:id'],
    module: 'warehouses',
    moduleLabel: 'Almacenes',
    moduleEmoji: '🏭',
    title: 'Detalle de Almacén',
    viewType: 'detail',
    description: 'Vista completa de un almacén con su información, responsable y configuración.',
    importance: 'Permite verificar y actualizar la información del almacén para garantizar que los pickings se asignen correctamente.',
    tips: [
      'Mantén la dirección actualizada especialmente para notificaciones de entrega.',
      'Si cambias el responsable del almacén, actualiza este campo para reflejar la situación actual.',
      'Un almacén archivado ya no está disponible para nuevos pickings pero conserva su historial.'
    ],
    relatedModules: [
      { label: 'Lista de Almacenes', route: '/admin/warehouses' },
      { label: 'Pickings', route: '/admin/pickings' }
    ],
    tags: ['almacén', 'detalle', 'bodega', 'responsable']
  },

  // ─── MÉTODOS DE PAGO ─────────────────────────────────────────────────────────
  {
    id: 'payment-methods-list',
    routePatterns: ['/admin/payment-methods'],
    module: 'orders',
    moduleLabel: 'Órdenes',
    moduleEmoji: '🛒',
    title: 'Métodos de Pago',
    viewType: 'list',
    description: 'Los métodos de pago definen las formas en que recibes o realizas pagos en las órdenes: transferencia SPEI, efectivo, tarjeta, crédito, cheque, etc.',
    importance: 'Sin métodos de pago configurados no es posible especificar las condiciones de cobro o pago en las órdenes. Es un catálogo fundamental antes de operar el módulo de ventas.',
    tips: [
      'Crea un método por cada forma de pago que aceptes o uses regularmente.',
      'El nombre debe ser claro y reconocible para quien crea las órdenes.',
      'Considera métodos diferenciados por plazo: "Contado", "Crédito 30 días", "Crédito 60 días".',
      'Los métodos archivados ya no aparecen en los selectores de órdenes nuevas.'
    ],
    fields: [
      { label: 'Nombre del Método', required: true, type: 'text', description: 'Nombre del método de pago.', tip: 'Ejemplos: "Transferencia SPEI", "Tarjeta Crédito", "Efectivo", "Cheque", "Crédito 30 días".' },
      { label: 'Descripción', required: false, type: 'textarea', description: 'Detalles adicionales del método.', tip: 'Incluye instrucciones bancarias, condiciones de pago o términos especiales si es necesario.' }
    ],
    relatedModules: [
      { label: 'Órdenes', route: '/admin/orders' }
    ],
    tags: ['pago', 'métodos', 'transferencia', 'efectivo', 'crédito', 'facturación']
  },
  {
    id: 'payment-methods-detail',
    routePatterns: ['/admin/payment-methods/:id'],
    module: 'orders',
    moduleLabel: 'Órdenes',
    moduleEmoji: '🛒',
    title: 'Detalle de Método de Pago',
    viewType: 'detail',
    description: 'Vista y edición de un método de pago específico.',
    importance: 'Permite actualizar la información de un método de pago cuando cambian las condiciones comerciales.',
    tips: [
      'Cambiar el nombre de un método afecta cómo se muestra en órdenes existentes.',
      'Si ya no usas un método de pago, archívalo en lugar de eliminarlo.'
    ],
    relatedModules: [
      { label: 'Lista de Métodos de Pago', route: '/admin/payment-methods' },
      { label: 'Órdenes', route: '/admin/orders' }
    ],
    tags: ['pago', 'método', 'detalle', 'editar']
  },

  // ─── ÓRDENES ─────────────────────────────────────────────────────────────────
  {
    id: 'orders-list',
    routePatterns: ['/admin/orders'],
    module: 'orders',
    moduleLabel: 'Órdenes',
    moduleEmoji: '🛒',
    title: 'Órdenes de Venta / Compra',
    viewType: 'list',
    description: 'Las órdenes son los documentos principales de transacción comercial. Registran ventas, compras y servicios vinculando un socio, productos y condiciones de pago.',
    importance: 'Las órdenes son el eje del negocio en Flowbit. Generan pickings de inventario, alimentan los reportes financieros y crean el historial de transacciones con cada socio.',
    tips: [
      'Una orden en "Borrador" puede modificarse libremente; una vez "Confirmada" sus líneas quedan fijas.',
      'Una orden confirmada genera automáticamente un picking en estado borrador.',
      'Las órdenes canceladas conservan su historial pero no generan movimientos de inventario.',
      'Filtra por estado (Borrador, Confirmada, Cancelada) para encontrar las órdenes relevantes rápidamente.',
      'El número de orden se asigna automáticamente al confirmar; en borrador es temporal.'
    ],
    process: [
      { step: 1, title: 'Crear Orden (Borrador)', description: 'Selecciona el socio, agrega líneas de productos y configura condiciones de pago.' },
      { step: 2, title: 'Revisar y Confirmar', description: 'Verifica totales, precios y cantidades. La confirmación es irreversible.' },
      { step: 3, title: 'Picking Generado', description: 'Al confirmar, se crea automáticamente un picking para la entrega de productos.' },
      { step: 4, title: 'Procesar Picking', description: 'El equipo de almacén prepara y verifica las líneas del picking.' },
      { step: 5, title: 'Inventario Actualizado', description: 'Al completar el picking, el stock de productos se actualiza automáticamente.' }
    ],
    relatedModules: [
      { label: 'Crear Orden', route: '/admin/orders/create' },
      { label: 'Pickings', route: '/admin/pickings' },
      { label: 'Socios', route: '/admin/partners' },
      { label: 'Productos', route: '/admin/products' }
    ],
    tags: ['órdenes', 'ventas', 'compras', 'pedidos', 'facturas', 'transacciones']
  },
  {
    id: 'orders-create',
    routePatterns: ['/admin/orders/create'],
    module: 'orders',
    moduleLabel: 'Órdenes',
    moduleEmoji: '🛒',
    title: 'Crear Orden',
    viewType: 'create',
    description: 'Crea un nuevo documento de transacción comercial vinculando un socio, productos o servicios y condiciones de negocio.',
    importance: 'Una orden bien registrada garantiza la trazabilidad financiera y de inventario de cada transacción. Los errores en la creación pueden causar discrepancias en el inventario.',
    tips: [
      'Selecciona el socio correcto antes de agregar líneas: define la relación comercial de la orden.',
      'El método de pago determina las condiciones de cobro o pago que deben respetarse.',
      'Las líneas de producto se pueden agregar, modificar o eliminar solo mientras la orden esté en Borrador.',
      'Verifica los precios antes de confirmar: no podrás cambiarlos después de la confirmación.',
      'Usa el campo "Notas" para instrucciones especiales de entrega o condiciones particulares.'
    ],
    fields: [
      { label: 'Socio', required: true, type: 'relation', description: 'Cliente o proveedor vinculado a esta orden.', tip: 'Busca por nombre o email; el socio debe estar registrado previamente en el catálogo.' },
      { label: 'Fecha de Orden', required: true, type: 'date', description: 'Fecha en que se emite la orden.', tip: 'Por defecto es la fecha actual; cámbiala solo para registros históricos con justificación.' },
      { label: 'Fecha de Entrega', required: false, type: 'date', description: 'Fecha comprometida de entrega al cliente.', tip: 'Usa esta fecha para programar el picking y coordinar con el almacén.' },
      { label: 'Método de Pago', required: false, type: 'select', description: 'Forma de pago acordada con el socio.', tip: 'Si no existe el método, créalo primero en el módulo de Métodos de Pago.' },
      { label: 'Moneda', required: false, type: 'select', description: 'Divisa en que se expresa la orden.', tip: 'Por defecto es MXN; cámbiala para clientes internacionales.' },
      { label: 'Notas', required: false, type: 'textarea', description: 'Instrucciones especiales, referencias o condiciones particulares de esta orden.', tip: 'Documenta todo lo que el almacén y el socio necesitan saber para procesar correctamente.' }
    ],
    relatedModules: [
      { label: 'Lista de Órdenes', route: '/admin/orders' },
      { label: 'Socios', route: '/admin/partners' },
      { label: 'Productos', route: '/admin/products' },
      { label: 'Métodos de Pago', route: '/admin/payment-methods' }
    ],
    tags: ['orden', 'crear', 'venta', 'compra', 'pedido', 'nueva orden']
  },
  {
    id: 'orders-detail',
    routePatterns: ['/admin/orders/:id'],
    module: 'orders',
    moduleLabel: 'Órdenes',
    moduleEmoji: '🛒',
    title: 'Detalle de Orden',
    viewType: 'detail',
    description: 'Vista completa de una orden con sus líneas de productos, totales, estado actual y pickings asociados.',
    importance: 'Permite supervisar el estado de cada transacción y los movimientos de inventario generados. Es el registro central de cada operación comercial.',
    tips: [
      'Una orden confirmada no puede modificarse; cancélala y crea una nueva si hay errores graves.',
      'El picking asociado aparece en la sección inferior; haz clic para ver su detalle.',
      'Si el picking no se generó automáticamente, usa el botón "Sincronizar Picking".',
      'Puedes agregar notas en cualquier momento para documentar acuerdos o incidencias.'
    ],
    relatedModules: [
      { label: 'Lista de Órdenes', route: '/admin/orders' },
      { label: 'Pickings', route: '/admin/pickings' }
    ],
    tags: ['orden', 'detalle', 'estado', 'picking', 'líneas', 'totales']
  },

  // ─── PICKINGS ─────────────────────────────────────────────────────────────────
  {
    id: 'pickings-list',
    routePatterns: ['/admin/pickings'],
    module: 'pickings',
    moduleLabel: 'Pickings / Movimientos',
    moduleEmoji: '📋',
    title: 'Pickings (Preparación de Pedidos)',
    viewType: 'list',
    description: 'Los pickings son las órdenes de trabajo para preparar y despachar productos de una orden comercial. Representan el proceso físico de selección y verificación de productos en el almacén.',
    importance: 'El módulo de pickings conecta las órdenes comerciales con el inventario físico. Sin completar el picking, el inventario no se actualiza y el pedido no se considera despachado.',
    tips: [
      'Un picking puede estar en: Borrador → En Proceso → Completado.',
      'Asigna el picking al operador de almacén responsable de prepararlo.',
      'Usa el escáner QR/código de barras en la vista de escaneo para verificar líneas rápidamente.',
      'Un picking parcial indica que no se completaron todas las líneas por falta de stock.',
      'Los pickings completados no pueden editarse; si hay un error, contacta al administrador.'
    ],
    process: [
      { step: 1, title: 'Picking Generado (Borrador)', description: 'Se crea automáticamente al confirmar una orden comercial.' },
      { step: 2, title: 'Iniciar Preparación', description: 'El operador cambia el estado a "En Proceso" y comienza a preparar productos.' },
      { step: 3, title: 'Verificar Líneas', description: 'Escanea el código de barras de cada producto para confirmar las cantidades.' },
      { step: 4, title: 'Confirmar o Marcar Parcial', description: 'Si todas las líneas están completas, confirma. Si hay faltantes, registra como parcial.' },
      { step: 5, title: 'Picking Completado', description: 'El inventario se actualiza automáticamente con los movimientos registrados.' }
    ],
    relatedModules: [
      { label: 'Órdenes', route: '/admin/orders' },
      { label: 'Productos', route: '/admin/products' },
      { label: 'Almacenes', route: '/admin/warehouses' }
    ],
    tags: ['picking', 'almacén', 'inventario', 'despacho', 'preparación', 'stock', 'movimientos']
  },
  {
    id: 'pickings-detail',
    routePatterns: ['/admin/pickings/:id'],
    module: 'pickings',
    moduleLabel: 'Pickings / Movimientos',
    moduleEmoji: '📋',
    title: 'Detalle de Picking',
    viewType: 'detail',
    description: 'Vista de un picking específico con sus líneas de productos, cantidades planificadas vs. reales, estado actual y código QR de verificación.',
    importance: 'Permite supervisar el avance de la preparación de pedidos y gestionar excepciones como productos faltantes o cantidades incorrectas.',
    tips: [
      'La columna "Planificado" muestra lo que la orden solicitó; "Real" muestra lo que se preparó.',
      'Si hay diferencia entre planificado y real, el picking se marcará como parcial.',
      'El código QR visible en esta pantalla puede imprimirse para facilitar el escaneo en almacén.',
      'Desde aquí puedes acceder a la vista de escaneo móvil para el operador de almacén.',
      'Los pickings completados no pueden editarse; registra cualquier discrepancia en notas.'
    ],
    relatedModules: [
      { label: 'Escanear Picking', route: '/admin/pickings/:id/scan' },
      { label: 'Lista de Pickings', route: '/admin/pickings' },
      { label: 'Órdenes', route: '/admin/orders' }
    ],
    tags: ['picking', 'detalle', 'QR', 'líneas', 'estado', 'cantidades']
  },
  {
    id: 'pickings-scan',
    routePatterns: ['/admin/pickings/:id/scan'],
    module: 'pickings',
    moduleLabel: 'Pickings / Movimientos',
    moduleEmoji: '📋',
    title: 'Escaneo de Picking',
    viewType: 'scan',
    description: 'Vista de escaneo optimizada para dispositivos móviles. Permite verificar los productos de un picking mediante código QR o código de barras directamente en el almacén.',
    importance: 'El escaneo garantiza la precisión en la preparación de pedidos, elimina errores humanos y acelera significativamente el proceso de picking.',
    tips: [
      'Usa un dispositivo móvil para escanear directamente en el almacén.',
      'Escanea el código de barras del producto para localizarlo automáticamente en la lista.',
      'Si el escáner no reconoce el producto, verifica que el código de barras esté en el catálogo.',
      'Puedes ingresar la cantidad manualmente si el escáner no está disponible.',
      'Una vez escaneadas todas las líneas, usa "Confirmar Picking" para completar el proceso.'
    ],
    process: [
      { step: 1, title: 'Abrir vista de escaneo', description: 'Desde el detalle del picking, toca el botón "Escanear" en tu dispositivo móvil.' },
      { step: 2, title: 'Escanear producto', description: 'Apunta la cámara al código de barras del producto; se localiza automáticamente.' },
      { step: 3, title: 'Confirmar cantidad', description: 'Verifica o ajusta la cantidad real preparada del producto escaneado.' },
      { step: 4, title: 'Continuar con siguiente', description: 'Pasa al siguiente producto hasta completar todas las líneas del picking.' },
      { step: 5, title: 'Confirmar picking', description: 'Con todas las líneas verificadas, confirma el picking para actualizar el inventario.' }
    ],
    relatedModules: [
      { label: 'Detalle de Picking', route: '/admin/pickings/:id' },
      { label: 'Productos', route: '/admin/products' }
    ],
    tags: ['picking', 'escaneo', 'QR', 'código de barras', 'almacén', 'móvil', 'scanner']
  },

  // ─── PROYECTOS ────────────────────────────────────────────────────────────────
  {
    id: 'projects-list',
    routePatterns: ['/admin/projects'],
    module: 'projects',
    moduleLabel: 'Proyectos',
    moduleEmoji: '🎯',
    title: 'Proyectos',
    viewType: 'list',
    description: 'Los proyectos son contratos, iniciativas o trabajos que la empresa realiza para un cliente o internamente, con un alcance definido, fechas, responsable y tareas.',
    importance: 'El módulo de proyectos permite planificar, asignar y dar seguimiento a trabajos complejos. El porcentaje de avance se calcula automáticamente basándose en las tareas completadas.',
    tips: [
      'Cada proyecto debe tener un responsable principal y fechas definidas desde el inicio.',
      'Las tareas del proyecto definen el trabajo específico a realizar por el equipo.',
      'El porcentaje de avance se calcula automáticamente en base a tareas completadas.',
      'Vincula el proyecto a un socio (cliente) para mejor trazabilidad comercial.',
      'Usa los tipos de proyecto para clasificar: Desarrollo, Consultoría, Mantenimiento, Implementación.'
    ],
    process: [
      { step: 1, title: 'Crear Proyecto', description: 'Define nombre, tipo, cliente, fechas y responsable del proyecto.' },
      { step: 2, title: 'Agregar Tareas', description: 'Desglosa el trabajo en tareas específicas y asígnalas a los miembros del equipo.' },
      { step: 3, title: 'Activar Proyecto', description: 'Cambia el estado a "Activo" cuando inicie la ejecución real del proyecto.' },
      { step: 4, title: 'Seguimiento y Avance', description: 'Monitorea el progreso en el dashboard y la vista de Gantt.' },
      { step: 5, title: 'Completar y Cerrar', description: 'Marca el proyecto como completado cuando todas las tareas terminen, luego ciérralo.' }
    ],
    relatedModules: [
      { label: 'Crear Proyecto', route: '/admin/projects/create' },
      { label: 'Tareas', route: '/admin/tasks' },
      { label: 'Socios', route: '/admin/partners' }
    ],
    tags: ['proyectos', 'tareas', 'gestión', 'planificación', 'equipo', 'Gantt', 'avance']
  },
  {
    id: 'projects-create',
    routePatterns: ['/admin/projects/create'],
    module: 'projects',
    moduleLabel: 'Proyectos',
    moduleEmoji: '🎯',
    title: 'Crear Proyecto',
    viewType: 'create',
    description: 'Registra un nuevo proyecto definiendo su alcance, responsable, cliente y fechas de inicio y fin.',
    importance: 'Un proyecto bien definido desde el inicio facilita la gestión de tareas, el seguimiento del avance y la comunicación con el cliente. Las fechas son especialmente importantes para la vista de Gantt.',
    tips: [
      'El nombre del proyecto debe ser claro y único para facilitar su identificación en listados.',
      'Define las fechas de inicio y fin desde el principio, aunque sean estimadas; se pueden ajustar.',
      'El tipo de proyecto ayuda a clasificar y filtrar en reportes por categoría de servicio.',
      'Asigna un socio (cliente) para vincular el proyecto a la relación comercial correcta.'
    ],
    fields: [
      { label: 'Nombre del Proyecto', required: true, type: 'text', description: 'Nombre identificador del proyecto.', tip: 'Usa un nombre descriptivo: "Implementación ERP Empresa XYZ Q3-2024".' },
      { label: 'Tipo de Proyecto', required: false, type: 'select', description: 'Categoría del proyecto: Desarrollo, Consultoría, Mantenimiento, Implementación, etc.', tip: 'Los tipos se configuran en el catálogo de Tipos de Proyecto; crea los que necesites.' },
      { label: 'Socio / Cliente', required: false, type: 'relation', description: 'Socio para quien se realiza el proyecto (cliente).', tip: 'Vincula el proyecto al cliente para relacionarlo con órdenes y actividades CRM.' },
      { label: 'Responsable', required: false, type: 'relation', description: 'Miembro del equipo encargado de liderar el proyecto.', tip: 'El responsable es el punto de contacto principal y quien reporta el avance.' },
      { label: 'Fecha de Inicio', required: false, type: 'date', description: 'Fecha planificada de inicio del proyecto.', tip: 'Puede ser estimada; actualízala cuando se confirme la fecha real.' },
      { label: 'Fecha de Fin', required: false, type: 'date', description: 'Fecha planificada de entrega o cierre del proyecto.', tip: 'Esta fecha se usa como límite en la vista de Gantt; defínela con el cliente desde el inicio.' },
      { label: 'Descripción / Alcance', required: false, type: 'textarea', description: 'Alcance, objetivos, entregables y restricciones del proyecto.', tip: 'Documenta aquí los detalles del alcance: qué incluye, qué no incluye y criterios de aceptación.' }
    ],
    relatedModules: [
      { label: 'Lista de Proyectos', route: '/admin/projects' },
      { label: 'Tareas', route: '/admin/tasks' },
      { label: 'Socios', route: '/admin/partners' }
    ],
    tags: ['proyecto', 'crear', 'nuevo', 'planificación', 'alcance', 'cliente']
  },
  {
    id: 'projects-detail',
    routePatterns: ['/admin/projects/:id'],
    module: 'projects',
    moduleLabel: 'Proyectos',
    moduleEmoji: '🎯',
    title: 'Detalle de Proyecto',
    viewType: 'detail',
    description: 'Vista completa de un proyecto con su avance, tareas, equipo asignado y vista de Gantt.',
    importance: 'Centraliza toda la información del proyecto: tareas, equipo, avance y cronograma. Es el centro de operaciones del proyecto.',
    tips: [
      'La vista de Gantt muestra las tareas en un cronograma visual para identificar retrasos.',
      'Cambia el estado del proyecto desde el menú de opciones (Activo, Pausado, Completado).',
      'El avance se recalcula automáticamente al completar tareas; no necesitas actualizarlo manualmente.',
      'Agrega notas o comentarios para documentar decisiones importantes del proyecto.'
    ],
    relatedModules: [
      { label: 'Lista de Proyectos', route: '/admin/projects' },
      { label: 'Tareas', route: '/admin/tasks' }
    ],
    tags: ['proyecto', 'detalle', 'Gantt', 'avance', 'tareas', 'equipo']
  },

  // ─── TAREAS ───────────────────────────────────────────────────────────────────
  {
    id: 'tasks-list',
    routePatterns: ['/admin/tasks'],
    module: 'tasks',
    moduleLabel: 'Tareas',
    moduleEmoji: '✅',
    title: 'Tareas de Proyectos',
    viewType: 'list',
    description: 'Las tareas son las unidades de trabajo específicas dentro de un proyecto. Cada tarea tiene un responsable, fechas y un estado que refleja su avance.',
    importance: 'Las tareas son el motor de los proyectos. Su correcta gestión permite distribuir el trabajo entre el equipo, medir el avance y detectar retrasos a tiempo.',
    tips: [
      'Filtra las tareas por proyecto, responsable o estado para encontrar rápidamente lo que buscas.',
      'Las tareas asignadas a ti aparecen en el panel de notificaciones del header (campana).',
      'Una tarea "Atrasada" indica que su fecha de vencimiento pasó sin completarse.',
      'Usa la vista de Agenda para ver las tareas en un calendario semanal o mensual.',
      'El avance del proyecto se actualiza automáticamente al completar o cancelar tareas.'
    ],
    relatedModules: [
      { label: 'Proyectos', route: '/admin/projects' },
      { label: 'Agenda', route: '/admin/agenda' }
    ],
    tags: ['tareas', 'trabajo', 'responsable', 'estado', 'avance', 'proyecto', 'pendientes']
  },
  {
    id: 'tasks-detail',
    routePatterns: ['/admin/tasks/:id'],
    module: 'tasks',
    moduleLabel: 'Tareas',
    moduleEmoji: '✅',
    title: 'Detalle de Tarea',
    viewType: 'detail',
    description: 'Vista completa de una tarea con su descripción, estado actual, responsable, fechas y opciones de actualización.',
    importance: 'Permite al responsable y supervisores ver el detalle completo de una tarea, actualizar su estado y documentar el avance.',
    tips: [
      'Actualiza el estado conforme avances: Pendiente → En Proceso → Completada.',
      'Agrega notas o comentarios para documentar el avance, decisiones y obstáculos encontrados.',
      'Al completar la tarea, el porcentaje de avance del proyecto se actualiza automáticamente.',
      'Si la tarea tiene dependencias, completa primero las tareas previas relacionadas.'
    ],
    fields: [
      { label: 'Nombre de la Tarea', required: true, type: 'text', description: 'Descripción breve y accionable de lo que hay que hacer.', tip: 'Usa verbos de acción: "Desarrollar módulo de pagos", "Revisar propuesta con cliente XYZ".' },
      { label: 'Proyecto', required: true, type: 'relation', description: 'Proyecto al que pertenece esta tarea.', tip: 'Una tarea siempre debe pertenecer a un proyecto; no se pueden crear tareas huérfanas.' },
      { label: 'Responsable', required: false, type: 'relation', description: 'Miembro del equipo encargado de completar la tarea.', tip: 'El responsable la verá en su panel de notificaciones y en la Agenda.' },
      { label: 'Estado', required: true, type: 'select', description: 'Estado actual: Pendiente, En Proceso, Completada, Cancelada.', tip: 'Mantén el estado actualizado en tiempo real para que el equipo sepa el avance real.' },
      { label: 'Prioridad', required: false, type: 'select', description: 'Urgencia e importancia de la tarea: Baja, Media, Alta, Crítica.', tip: 'Las tareas de alta prioridad deberían resolverse antes; úsala para comunicar urgencia.' },
      { label: 'Fecha de Inicio', required: false, type: 'date', description: 'Fecha en que se planea iniciar el trabajo en esta tarea.', tip: 'Considera la disponibilidad del responsable y las dependencias con otras tareas.' },
      { label: 'Fecha de Vencimiento', required: false, type: 'date', description: 'Fecha límite para completar la tarea.', tip: 'Las tareas vencidas se marcan automáticamente como "Atrasadas"; define fechas realistas.' },
      { label: 'Descripción', required: false, type: 'textarea', description: 'Detalle completo de lo que implica la tarea.', tip: 'Incluye criterios de aceptación claros: "La tarea está lista cuando X funcione correctamente".' }
    ],
    relatedModules: [
      { label: 'Lista de Tareas', route: '/admin/tasks' },
      { label: 'Proyectos', route: '/admin/projects' },
      { label: 'Agenda', route: '/admin/agenda' }
    ],
    tags: ['tarea', 'detalle', 'estado', 'responsable', 'avance', 'prioridad']
  },

  // ─── APROBACIONES ─────────────────────────────────────────────────────────────
  {
    id: 'approval-requests-list',
    routePatterns: ['/admin/approval-requests'],
    module: 'approvals',
    moduleLabel: 'Aprobaciones',
    moduleEmoji: '✍️',
    title: 'Solicitudes de Aprobación',
    viewType: 'list',
    description: 'Las solicitudes de aprobación son documentos formales que requieren autorización de un gestor designado antes de proceder con una acción (gasto, compra, contratación, etc.).',
    importance: 'El módulo de aprobaciones crea un flujo de autorización formal y auditable. Garantiza que las decisiones importantes pasen por el proceso de revisión y autorización correcto, creando un registro permanente.',
    tips: [
      'Las solicitudes "Publicadas" están esperando la aprobación del gestor asignado.',
      'Como aprobador, tus solicitudes pendientes aparecen en el panel de notificaciones del header.',
      'Una solicitud aprobada o rechazada queda como registro permanente de autorización.',
      'Adjunta documentos de soporte antes de publicar para agilizar la revisión del aprobador.',
      'Si el aprobador rechaza la solicitud, puedes corregirla y volver a publicarla.'
    ],
    process: [
      { step: 1, title: 'Crear Solicitud (Borrador)', description: 'El solicitante crea la solicitud describiendo qué requiere aprobar y adjunta soporte.' },
      { step: 2, title: 'Publicar Solicitud', description: 'El solicitante publica; esto notifica automáticamente al gestor asignado.' },
      { step: 3, title: 'Revisión por el Gestor', description: 'El gestor designado revisa la información y documentos adjuntos.' },
      { step: 4, title: 'Aprobación o Rechazo', description: 'El gestor aprueba o rechaza con una justificación obligatoria.' },
      { step: 5, title: 'Registro Final', description: 'La decisión queda registrada con fecha, responsable y justificación como evidencia de autorización.' }
    ],
    relatedModules: [
      { label: 'Crear Solicitud', route: '/admin/approval-requests/create' },
      { label: 'Categorías de Aprobación', route: '/admin/approval-categories' },
      { label: 'Gestores de Aprobación', route: '/admin/approval-managers' }
    ],
    tags: ['aprobación', 'solicitud', 'autorización', 'gestor', 'flujo', 'auditoria']
  },
  {
    id: 'approval-requests-create',
    routePatterns: ['/admin/approval-requests/create'],
    module: 'approvals',
    moduleLabel: 'Aprobaciones',
    moduleEmoji: '✍️',
    title: 'Crear Solicitud de Aprobación',
    viewType: 'create',
    description: 'Crea una solicitud formal de autorización para que un gestor designado la revise y apruebe antes de proceder.',
    importance: 'Una solicitud bien documentada desde el inicio facilita la revisión del aprobador y acelera el proceso de autorización. La categoría determina qué gestor la recibirá.',
    tips: [
      'El título debe ser claro y descriptivo: qué se solicita y para qué propósito.',
      'La categoría es crítica: determina qué gestor recibe y aprueba la solicitud.',
      'Incluye toda la información necesaria en la descripción para que el aprobador no pida más datos.',
      'Adjunta documentos de soporte (cotizaciones, facturas, propuestas) antes de publicar.',
      'Si hay un monto involucrado, ingrésalo para dar contexto financiero al aprobador.'
    ],
    fields: [
      { label: 'Título', required: true, type: 'text', description: 'Descripción breve de lo que se solicita aprobar.', tip: 'Ejemplo: "Compra de laptops para equipo de desarrollo - Presupuesto Q3 2024".' },
      { label: 'Categoría', required: true, type: 'select', description: 'Tipo de solicitud que determina el gestor asignado y el flujo de aprobación.', tip: 'Si no existe la categoría adecuada, solicita al administrador que la cree antes de proceder.' },
      { label: 'Descripción / Justificación', required: false, type: 'textarea', description: 'Explicación detallada de la solicitud y su justificación de negocio.', tip: 'Explica el "por qué" es necesario, el impacto esperado y las alternativas consideradas.' },
      { label: 'Monto', required: false, type: 'number', description: 'Valor monetario involucrado en la solicitud (si aplica).', tip: 'Incluye el monto exacto o estimado para facilitar la evaluación del aprobador.' },
      { label: 'Moneda', required: false, type: 'select', description: 'Divisa del monto indicado.', tip: 'Por defecto MXN; cámbiala para transacciones en divisas extranjeras.' },
      { label: 'Fecha Requerida', required: false, type: 'date', description: 'Fecha límite en que se necesita la aprobación para poder proceder.', tip: 'Da suficiente tiempo al aprobador para revisar; evita solicitudes de "urgente" sin justificación.' }
    ],
    relatedModules: [
      { label: 'Lista de Solicitudes', route: '/admin/approval-requests' },
      { label: 'Categorías de Aprobación', route: '/admin/approval-categories' }
    ],
    tags: ['solicitud', 'aprobación', 'crear', 'autorización', 'nueva solicitud']
  },
  {
    id: 'approval-requests-detail',
    routePatterns: ['/admin/approval-requests/:id'],
    module: 'approvals',
    moduleLabel: 'Aprobaciones',
    moduleEmoji: '✍️',
    title: 'Detalle de Solicitud de Aprobación',
    viewType: 'detail',
    description: 'Vista completa de una solicitud de aprobación con su estado, historial de cambios y acciones disponibles según tu rol.',
    importance: 'Permite al solicitante y al aprobador ver todo el contexto de la solicitud y tomar las acciones correspondientes según su rol en el proceso.',
    tips: [
      'Las acciones disponibles dependen de tu rol: solicitante o aprobador.',
      'Si eres el aprobador, verás los botones "Aprobar" y "Rechazar" con campo de justificación.',
      'Si eres el solicitante, puedes publicar (si está en borrador) o cancelar la solicitud.',
      'Una solicitud rechazada puede corregirse y volver a publicarse sin perder el historial.',
      'El historial muestra todas las transiciones de estado con fecha y responsable como evidencia.'
    ],
    relatedModules: [
      { label: 'Lista de Solicitudes', route: '/admin/approval-requests' },
      { label: 'Gestores de Aprobación', route: '/admin/approval-managers' }
    ],
    tags: ['solicitud', 'aprobación', 'detalle', 'estado', 'historial', 'revisar']
  },
  {
    id: 'approval-categories-list',
    routePatterns: ['/admin/approval-categories'],
    module: 'approvals',
    moduleLabel: 'Aprobaciones',
    moduleEmoji: '✍️',
    title: 'Categorías de Aprobación',
    viewType: 'list',
    description: 'Las categorías de aprobación clasifican los tipos de solicitudes y determinan qué gestores son responsables de aprobarlas.',
    importance: 'Las categorías son fundamentales para el funcionamiento del módulo. Sin categorías no es posible crear solicitudes. Deben configurarse antes de que el equipo empiece a solicitar aprobaciones.',
    tips: [
      'Crea una categoría por cada tipo de solicitud recurrente: Gastos, Compras, RRHH, IT, etc.',
      'Cada categoría puede tener uno o más gestores asignados.',
      'El nombre de la categoría debe ser claro para que el solicitante sepa cuál usar.',
      'Puedes archivar categorías obsoletas sin perder el historial de solicitudes anteriores.'
    ],
    fields: [
      { label: 'Nombre de la Categoría', required: true, type: 'text', description: 'Nombre descriptivo del tipo de solicitud.', tip: 'Ejemplo: "Gastos de Viaje y Hospedaje", "Compras > $10,000", "Contrataciones de Personal".' },
      { label: 'Descripción', required: false, type: 'textarea', description: 'Criterios y casos de uso de esta categoría.', tip: 'Explica cuándo usar esta categoría y qué tipo de solicitudes aplican para ella.' },
      { label: 'Gestores Asignados', required: false, type: 'relation', description: 'Socios que pueden aprobar solicitudes de esta categoría.', tip: 'Asegúrate de que los gestores estén registrados en el módulo de Gestores de Aprobación.' }
    ],
    relatedModules: [
      { label: 'Solicitudes de Aprobación', route: '/admin/approval-requests' },
      { label: 'Gestores de Aprobación', route: '/admin/approval-managers' }
    ],
    tags: ['categoría', 'aprobación', 'clasificación', 'tipo', 'configuración']
  },
  {
    id: 'approval-managers-list',
    routePatterns: ['/admin/approval-managers'],
    module: 'approvals',
    moduleLabel: 'Aprobaciones',
    moduleEmoji: '✍️',
    title: 'Gestores de Aprobación',
    viewType: 'list',
    description: 'Los gestores de aprobación son socios designados para revisar y aprobar solicitudes de una o más categorías. Reciben notificaciones automáticas cuando se publican solicitudes.',
    importance: 'Sin gestores configurados, el sistema no puede asignar solicitudes para aprobación. Deben configurarse junto con las categorías antes de usar el módulo.',
    tips: [
      'Un socio puede ser gestor de múltiples categorías simultáneamente.',
      'Los gestores reciben notificaciones en el panel de alertas del header al publicarse solicitudes.',
      'El gestor debe tener acceso activo al sistema para poder aprobar.',
      'Si el gestor designado cambia de rol, actualiza las categorías asignadas de inmediato.'
    ],
    fields: [
      { label: 'Socio', required: true, type: 'relation', description: 'Persona designada como gestor de aprobación.', tip: 'El socio debe ser miembro activo del equipo con acceso al sistema.' },
      { label: 'Categorías Asignadas', required: false, type: 'relation', description: 'Categorías en las que este socio actuará como aprobador designado.', tip: 'Asigna solo las categorías relevantes al rol y responsabilidades del gestor.' }
    ],
    relatedModules: [
      { label: 'Categorías de Aprobación', route: '/admin/approval-categories' },
      { label: 'Solicitudes de Aprobación', route: '/admin/approval-requests' }
    ],
    tags: ['gestor', 'aprobador', 'autorización', 'equipo', 'configuración']
  },

  // ─── CRM ──────────────────────────────────────────────────────────────────────
  {
    id: 'crm-leads-list',
    routePatterns: ['/admin/crm/leads'],
    module: 'crm',
    moduleLabel: 'CRM',
    moduleEmoji: '📊',
    title: 'Oportunidades CRM (Leads)',
    viewType: 'list',
    description: 'Los leads son oportunidades de negocio que estás trabajando para convertir en clientes o ventas. El CRM permite dar seguimiento sistemático a cada oportunidad a través de un pipeline de ventas.',
    importance: 'El CRM es esencial para no perder oportunidades de venta. Un seguimiento sistemático y registro de todas las interacciones aumenta significativamente las tasas de conversión.',
    tips: [
      'Registra cada oportunidad de negocio como lead desde el primer contacto.',
      'Avanza el lead por las etapas del pipeline conforme progresa la negociación.',
      'Registra todas las actividades de contacto (llamadas, emails, reuniones) para mantener historial.',
      'Los leads "Ganados" pueden vincularse directamente a una orden de venta.',
      'Las actividades vencidas aparecen en tu panel de notificaciones para que no pierdas el seguimiento.'
    ],
    process: [
      { step: 1, title: 'Crear Lead', description: 'Registra la oportunidad con datos del prospecto, valor estimado y etapa inicial.' },
      { step: 2, title: 'Asignar Responsable', description: 'Designa al vendedor o ejecutivo que dará seguimiento a la oportunidad.' },
      { step: 3, title: 'Actividades de Seguimiento', description: 'Registra llamadas, emails y reuniones para avanzar la negociación.' },
      { step: 4, title: 'Avanzar en Pipeline', description: 'Mueve el lead a la siguiente etapa conforme el prospecto muestre interés.' },
      { step: 5, title: 'Ganar o Perder', description: 'Cierra el lead como Ganado (genera una orden) o Perdido (documenta la razón).' }
    ],
    relatedModules: [
      { label: 'Crear Lead', route: '/admin/crm/leads/create' },
      { label: 'Etapas del Pipeline', route: '/admin/crm/stages' },
      { label: 'Socios', route: '/admin/partners' },
      { label: 'Órdenes', route: '/admin/orders' }
    ],
    tags: ['CRM', 'leads', 'oportunidades', 'ventas', 'seguimiento', 'pipeline', 'prospecto']
  },
  {
    id: 'crm-leads-create',
    routePatterns: ['/admin/crm/leads/create'],
    module: 'crm',
    moduleLabel: 'CRM',
    moduleEmoji: '📊',
    title: 'Crear Oportunidad / Lead',
    viewType: 'create',
    description: 'Registra una nueva oportunidad de negocio para dar seguimiento sistemático a la negociación.',
    importance: 'Registrar leads desde el primer contacto garantiza que ninguna oportunidad se pierda por falta de seguimiento. El valor estimado permite priorizar el pipeline.',
    tips: [
      'El título debe describir claramente la oportunidad: "Venta ERP a Empresa XYZ".',
      'El valor estimado ayuda a priorizar: trabaja primero las oportunidades de mayor impacto.',
      'Asigna la etapa inicial correctamente según el avance real de la negociación.',
      'Programa una primera actividad de seguimiento inmediatamente al crear el lead.'
    ],
    fields: [
      { label: 'Título / Oportunidad', required: true, type: 'text', description: 'Nombre descriptivo de la oportunidad de negocio.', tip: 'Incluye el cliente y el producto/servicio: "Digitalización Contabilidad - Empresa ABC".' },
      { label: 'Socio / Prospecto', required: false, type: 'relation', description: 'Empresa o persona con quien se trabaja la oportunidad.', tip: 'Si es un cliente nuevo, créalo primero en el módulo de Socios.' },
      { label: 'Etapa del Pipeline', required: true, type: 'select', description: 'Etapa actual de la negociación en el proceso de ventas.', tip: 'Sé honesto con la etapa real; no adelantes etapas por optimismo excesivo.' },
      { label: 'Responsable', required: false, type: 'relation', description: 'Miembro del equipo encargado de dar seguimiento al lead.', tip: 'El responsable recibirá alertas de actividades vencidas para no perder el seguimiento.' },
      { label: 'Valor Estimado', required: false, type: 'number', description: 'Valor monetario potencial de la oportunidad si se gana.', tip: 'Útil para priorizar y calcular el forecast de ventas; actualízalo si cambia la propuesta.' },
      { label: 'Probabilidad (%)', required: false, type: 'number', description: 'Probabilidad estimada de cierre exitoso (0-100%).', tip: 'Actualiza la probabilidad conforme avance la negociación; el pipeline ponderado la usa.' },
      { label: 'Fecha de Cierre Esperada', required: false, type: 'date', description: 'Fecha estimada en que se cerrará la negociación (ganado o perdido).', tip: 'Esta fecha es clave para el forecast de ventas por período.' },
      { label: 'Descripción', required: false, type: 'textarea', description: 'Detalles de la oportunidad, necesidades del cliente y contexto de la negociación.', tip: 'Documenta lo que el cliente necesita y los puntos clave a trabajar en la propuesta.' }
    ],
    relatedModules: [
      { label: 'Lista de Leads', route: '/admin/crm/leads' },
      { label: 'Etapas del Pipeline', route: '/admin/crm/stages' }
    ],
    tags: ['CRM', 'lead', 'oportunidad', 'crear', 'ventas', 'prospecto']
  },
  {
    id: 'crm-leads-detail',
    routePatterns: ['/admin/crm/leads/:id'],
    module: 'crm',
    moduleLabel: 'CRM',
    moduleEmoji: '📊',
    title: 'Detalle de Lead / Oportunidad',
    viewType: 'detail',
    description: 'Vista completa de una oportunidad con su historial de actividades, etapa actual en el pipeline y órdenes vinculadas.',
    importance: 'Centraliza toda la información de la oportunidad: comunicaciones pasadas, propuestas, avance en el pipeline y órdenes generadas al ganarse.',
    tips: [
      'Registra cada interacción con el prospecto como una actividad (llamada, email, reunión, demo).',
      'Avanza la etapa del pipeline cuando el prospecto muestre señales claras de avance.',
      'Al ganar el lead, vincúlalo a la orden generada para mantener trazabilidad completa.',
      'El historial de actividades es tu evidencia de seguimiento si alguien pregunta qué pasó.',
      'Las notas de cada actividad documentan acuerdos, compromisos y próximos pasos.'
    ],
    relatedModules: [
      { label: 'Lista de Leads', route: '/admin/crm/leads' },
      { label: 'Órdenes', route: '/admin/orders' }
    ],
    tags: ['CRM', 'lead', 'detalle', 'historial', 'pipeline', 'actividades', 'seguimiento']
  },
  {
    id: 'crm-stages-list',
    routePatterns: ['/admin/crm/stages'],
    module: 'crm',
    moduleLabel: 'CRM',
    moduleEmoji: '📊',
    title: 'Etapas del Pipeline CRM',
    viewType: 'list',
    description: 'Las etapas definen el proceso de ventas de tu empresa: las fases por las que pasa una oportunidad desde el primer contacto hasta el cierre.',
    importance: 'Un pipeline bien definido estandariza el proceso de ventas, facilita el seguimiento y permite reporting confiable. Debe configurarse antes de usar el módulo de Leads.',
    tips: [
      'Define etapas que reflejen tu proceso real de ventas, no el proceso "ideal".',
      'Entre 4 y 7 etapas es suficiente; demasiadas etapas crean fricción y confusión.',
      'El orden de las etapas define la secuencia lógica del pipeline.',
      'Las etapas "Ganado" y "Perdido" son finales; no deberían tener etapas siguientes.',
      'Puedes sembrar etapas predeterminadas con el botón "Inicializar etapas" si aún no tienes ninguna.'
    ],
    fields: [
      { label: 'Nombre de la Etapa', required: true, type: 'text', description: 'Nombre de la fase del proceso de ventas.', tip: 'Ejemplos: "Primer Contacto", "Propuesta Enviada", "Negociación", "Cierre", "Ganado", "Perdido".' },
      { label: 'Orden', required: true, type: 'number', description: 'Posición de la etapa en el pipeline (menor número = antes en el proceso).', tip: 'Usa múltiplos de 10 (10, 20, 30) para poder insertar etapas intermedias después.' },
      { label: 'Probabilidad de Cierre (%)', required: false, type: 'number', description: 'Probabilidad predeterminada para leads en esta etapa.', tip: 'Ayuda a calcular el forecast de ventas ponderado automáticamente.' },
      { label: 'Descripción / Criterios', required: false, type: 'textarea', description: 'Criterios claros para que un lead esté en esta etapa.', tip: 'Define qué condiciones debe cumplir el lead para estar aquí; evita la ambigüedad.' }
    ],
    relatedModules: [
      { label: 'Leads CRM', route: '/admin/crm/leads' }
    ],
    tags: ['CRM', 'etapas', 'pipeline', 'ventas', 'proceso', 'configuración']
  },

  // ─── EQUIPO ───────────────────────────────────────────────────────────────────
  {
    id: 'team-list',
    routePatterns: ['/admin/team'],
    module: 'team',
    moduleLabel: 'Equipo',
    moduleEmoji: '👨‍💼',
    title: 'Gestión de Equipo',
    viewType: 'team',
    description: 'El módulo de equipo permite gestionar los miembros que tienen acceso a tu empresa en Flowbit, sus roles y niveles de permiso.',
    importance: 'Una gestión correcta del equipo garantiza que cada persona tenga el acceso apropiado y que la información sensible esté protegida. Los roles determinan las capacidades de cada miembro.',
    tips: [
      'Invita a colaboradores por email; recibirán una notificación para aceptar la invitación.',
      'Los roles determinan los permisos: Owner > Admin > Member > Viewer.',
      'El Owner tiene control total incluyendo facturación; limita el número de Owners.',
      'Los Viewer solo pueden consultar; no pueden crear ni modificar información.',
      'Puedes remover un miembro en cualquier momento sin perder su historial de trabajo.'
    ],
    process: [
      { step: 1, title: 'Invitar Colaborador', description: 'Ingresa el email del colaborador y selecciona el rol apropiado para sus funciones.' },
      { step: 2, title: 'Aceptar Invitación', description: 'El colaborador recibe un email y acepta la invitación desde su cuenta.' },
      { step: 3, title: 'Acceso Activo', description: 'El miembro ya puede acceder a la empresa con el rol y permisos asignados.' },
      { step: 4, title: 'Gestión Continua', description: 'Ajusta roles o remueve miembros según cambios en el equipo o la organización.' }
    ],
    relatedModules: [
      { label: 'Socios', route: '/admin/partners' },
      { label: 'Invitaciones', route: '/admin/invitations' }
    ],
    tags: ['equipo', 'miembros', 'roles', 'permisos', 'acceso', 'invitaciones', 'colaboradores']
  },
  {
    id: 'invitations',
    routePatterns: ['/admin/invitations'],
    module: 'team',
    moduleLabel: 'Equipo',
    moduleEmoji: '👨‍💼',
    title: 'Mis Invitaciones',
    viewType: 'list',
    description: 'Lista de invitaciones que has recibido para unirte a empresas en Flowbit. Puedes aceptar o rechazar cada una.',
    importance: 'Gestionar tus invitaciones te permite colaborar en múltiples empresas con un solo usuario y login. Cada empresa es un entorno independiente con sus propios datos.',
    tips: [
      'Puedes pertenecer a múltiples empresas con un solo login de Flowbit.',
      'Acepta solo invitaciones de empresas que reconozcas y en las que debas colaborar.',
      'Al aceptar, la empresa aparece en tu selector de empresa del header (esquina superior).',
      'Rechazar una invitación no afecta tu cuenta ni tus otras empresas.'
    ],
    relatedModules: [
      { label: 'Equipo', route: '/admin/team' }
    ],
    tags: ['invitaciones', 'equipo', 'empresa', 'acceso', 'multi-empresa']
  },

  // ─── AGENDA ───────────────────────────────────────────────────────────────────
  {
    id: 'agenda',
    routePatterns: ['/admin/agenda'],
    module: 'core',
    moduleLabel: 'General',
    moduleEmoji: '🏠',
    title: 'Agenda y Calendario',
    viewType: 'dashboard',
    description: 'La agenda muestra en un calendario todas las tareas de proyectos y actividades CRM programadas, permitiendo una vista temporal del trabajo del equipo.',
    importance: 'Permite planificar el trabajo a futuro, detectar sobrecargas de trabajo y conflictos de agenda, y asegurarte de que ningún compromiso se olvide.',
    tips: [
      'La agenda combina tareas de proyectos y actividades CRM en un solo calendario.',
      'Filtra por responsable para ver solo tu agenda personal o la de un compañero.',
      'Los eventos en rojo indican tareas o actividades atrasadas que requieren atención inmediata.',
      'Haz clic en un evento para ver el detalle o acceder directamente al elemento relacionado.',
      'Usa la vista semanal para planificación detallada y la mensual para una visión general.'
    ],
    relatedModules: [
      { label: 'Tareas', route: '/admin/tasks' },
      { label: 'CRM Leads', route: '/admin/crm/leads' },
      { label: 'Proyectos', route: '/admin/projects' }
    ],
    tags: ['agenda', 'calendario', 'programación', 'tareas', 'actividades', 'planificación']
  },

  // ─── PERFIL & CONFIGURACIÓN ───────────────────────────────────────────────────
  {
    id: 'profile',
    routePatterns: ['/admin/profile'],
    module: 'core',
    moduleLabel: 'General',
    moduleEmoji: '🏠',
    title: 'Perfil de Usuario',
    viewType: 'config',
    description: 'Tu perfil contiene tu información personal, foto y preferencias dentro de la plataforma.',
    importance: 'Un perfil completo facilita la identificación en el equipo y mejora la experiencia de uso. Tu nombre de display aparece en tareas, aprobaciones y actividades CRM.',
    tips: [
      'Mantén tu email actualizado para recibir notificaciones correctamente.',
      'Tu foto de perfil aparece en el avatar del header y en asignaciones.',
      'El nombre de display es el que ven tus compañeros en tareas, aprobaciones y CRM.',
      'Cambia tu contraseña regularmente para mantener la seguridad de tu cuenta.'
    ],
    relatedModules: [
      { label: 'Equipo', route: '/admin/team' }
    ],
    tags: ['perfil', 'usuario', 'configuración', 'contraseña', 'foto', 'personal']
  },
  {
    id: 'settings',
    routePatterns: ['/admin/settings'],
    module: 'core',
    moduleLabel: 'General',
    moduleEmoji: '🏠',
    title: 'Configuración de Empresa',
    viewType: 'config',
    description: 'La configuración permite personalizar los datos y preferencias de tu empresa en Flowbit: nombre, logo, zona horaria, moneda predeterminada y datos fiscales.',
    importance: 'Una configuración correcta garantiza que los documentos, reportes y comunicaciones reflejen correctamente la identidad de tu empresa. Los datos fiscales son críticos para la facturación.',
    tips: [
      'El nombre y logo de la empresa aparecen en documentos y en el selector de empresa del header.',
      'Configura la moneda predeterminada para que se use en nuevas órdenes y solicitudes.',
      'La zona horaria afecta las fechas y horarios en notificaciones y reportes.',
      'Los datos fiscales (RFC, dirección fiscal) son necesarios para emitir documentos oficiales.'
    ],
    relatedModules: [
      { label: 'Equipo', route: '/admin/team' }
    ],
    tags: ['configuración', 'empresa', 'ajustes', 'preferencias', 'fiscal', 'RFC']
  },

  // ─── MANUAL ───────────────────────────────────────────────────────────────────
  {
    id: 'manual',
    routePatterns: ['/manual'],
    module: 'core',
    moduleLabel: 'General',
    moduleEmoji: '🏠',
    title: 'Manual de Usuario',
    viewType: 'config',
    description: 'Centro de documentación y ayuda de Flowbit. Encuentra guías detalladas de todos los módulos, procesos y funcionalidades de la plataforma.',
    importance: 'El manual es tu referencia principal para aprender a usar Flowbit correctamente y sacar el máximo provecho de cada módulo.',
    tips: [
      'Usa el buscador para encontrar rápidamente información sobre un tema específico.',
      'Navega por módulo en el menú lateral para explorar la documentación de cada sección.',
      'El asistente flotante (ícono en la esquina inferior derecha) también muestra ayuda contextual.',
      'Los diagramas de proceso muestran el flujo completo de cada operación del sistema.'
    ],
    relatedModules: [],
    tags: ['manual', 'ayuda', 'documentación', 'guía', 'soporte', 'tutorial']
  },
  // ─── TIENDA EN LÍNEA ─────────────────────────────────────────────────────────
  {
    id: 'storefront-settings',
    routePatterns: ['/admin/storefront'],
    module: 'storefront',
    moduleLabel: 'Tienda en línea',
    moduleEmoji: '🛍️',
    title: 'Ajustes de la tienda',
    viewType: 'config',
    level: 'basico',
    isNew: true,
    summary: 'Cada empresa de Flowbit puede publicar su propia tienda en línea; las ventas entran como órdenes reales al panel.',
    description: 'Desde aquí activas y personalizas tu tienda pública: la dirección web (slug), el branding, los textos de la portada, los datos de contacto, las políticas y la pasarela de pago con tarjeta. La tienda queda disponible en /stores/tu-slug.',
    importance: 'Es el interruptor y el escaparate de tu canal de venta en línea. Mientras la tienda esté desactivada o le falte algún requisito (productos publicados, método de envío y método de pago), tus clientes verán «Tienda no disponible» o no podrán completar la compra.',
    tips: [
      'El slug es la dirección pública de tu tienda: usa solo minúsculas, números y guiones, y elige un nombre corto y memorable porque cambiarlo rompe los enlaces que ya compartiste.',
      'Copia el enlace público con el botón de la sección «Enlace público» y compártelo en tus redes: es la puerta de entrada a tu catálogo.',
      'El banner y el logo se cargan por URL. Súbelos a tu hosting o CDN y pega la dirección; usa imágenes horizontales para el banner (mínimo 1600 px de ancho).',
      'La barra de anuncio es ideal para promociones temporales («Envío gratis en compras mayores a $1,000»). Déjala vacía cuando no tengas nada que anunciar.',
      'Completa las políticas de envío, devoluciones, privacidad y términos: además de dar confianza, muchas pasarelas y redes las exigen para aceptar anuncios.',
      'Los productos solo aparecen en la tienda si tienen activadas las opciones «Publicado en tienda» y «Se puede vender»; los marcados como destacados encabezan la portada.'
    ],
    fields: [
      { label: 'Estado de la tienda', required: true, type: 'boolean', description: 'Activa o desactiva la tienda pública completa.', tip: 'Desactívala mientras preparas el catálogo: los visitantes verán «Tienda no disponible» en lugar de una tienda a medias.' },
      { label: 'URL de la tienda (slug)', required: true, type: 'text', description: 'Identificador único en la dirección pública /stores/{slug}.', tip: 'Solo minúsculas, números y guiones. Debe ser único entre todas las tiendas de Flowbit.' },
      { label: 'Mostrar productos agotados', required: false, type: 'boolean', description: 'Define si el catálogo lista productos sin existencias.', tip: 'Mostrarlos ayuda al SEO y a captar interés, pero genera frustración si nunca se reabastecen.' },
      { label: 'URL del logo', required: false, type: 'text', description: 'Imagen del encabezado de la tienda.', tip: 'Usa PNG con fondo transparente y altura mínima de 120 px.' },
      { label: 'URL del banner (hero)', required: false, type: 'text', description: 'Imagen grande de la portada.', tip: 'Formato horizontal y peso menor a 300 KB para que la portada cargue rápido.' },
      { label: 'Color principal', required: false, type: 'text', description: 'Color de acento de botones y detalles de la tienda.', tip: 'Elige el color de tu marca y verifica que el texto blanco se lea encima.' },
      { label: 'Barra de anuncio', required: false, type: 'text', description: 'Mensaje fijo en la parte superior de la tienda.', tip: 'Mantenlo en una sola línea; se corta en pantallas pequeñas.' },
      { label: 'Título y subtítulo del hero', required: false, type: 'text', description: 'Textos principales de la portada.', tip: 'El título dice qué vendes; el subtítulo, por qué comprarte a ti.' },
      { label: 'Quiénes somos', required: false, type: 'textarea', description: 'Texto que se muestra en la página «Acerca de» de la tienda.', tip: 'Dos o tres párrafos bastan: quién eres, qué ofreces y cómo contactarte.' },
      { label: 'Contacto público', required: false, type: 'text', description: 'Email, teléfono, WhatsApp y dirección visibles para los compradores.', tip: 'El número de WhatsApp debe ir con código de país y sin espacios para que el enlace directo funcione.' },
      { label: 'Políticas', required: false, type: 'textarea', description: 'Envíos, devoluciones, aviso de privacidad y términos y condiciones.', tip: 'Escríbelas en lenguaje simple: son las preguntas que más frenan una compra.' }
    ],
    process: [
      { step: 1, title: 'Configura', description: 'Slug, branding y textos.' },
      { step: 2, title: 'Publica', description: 'Marca productos como publicados.' },
      { step: 3, title: 'Habilita', description: 'Envíos y métodos de pago.' },
      { step: 4, title: 'Activa', description: 'Enciende el estado de la tienda.' },
      { step: 5, title: 'Comparte', description: 'Difunde el enlace público.' }
    ],
    wizard: {
      id: 'wz-storefront-launch',
      title: 'Abre tu tienda en línea',
      description: 'De una tienda apagada a tu primera venta en línea, sin pasos ocultos.',
      estimatedMinutes: 20,
      steps: [
        {
          id: 'slug',
          title: 'Elige la dirección de tu tienda',
          description: 'Define el slug con el que tus clientes te encontrarán. Quedará como /stores/tu-slug y es el enlace que compartirás en redes.',
          action: { label: 'Ir a Ajustes de tienda', route: '/admin/storefront' },
          warning: 'Cambiar el slug después rompe los enlaces ya publicados. Decídelo bien la primera vez.'
        },
        {
          id: 'branding',
          title: 'Viste tu tienda',
          description: 'Carga el logo, el banner, el color principal y escribe el título y subtítulo de la portada.',
          checklist: ['Logo', 'Banner del hero', 'Color principal', 'Título y subtítulo', 'Texto de «Quiénes somos»']
        },
        {
          id: 'products',
          title: 'Publica tus productos',
          description: 'En cada producto activa «Publicado en tienda» y «Se puede vender». Marca como destacados los que quieres en la portada.',
          action: { label: 'Ir a Productos', route: '/admin/products' },
          tip: 'Sube una imagen y escribe una descripción por producto: el catálogo con fotos convierte mucho más.'
        },
        {
          id: 'shipping',
          title: 'Define cómo entregas',
          description: 'Crea al menos un método de envío con su costo y tiempo estimado. Sin métodos de envío el checkout no se puede completar.',
          action: { label: 'Métodos de envío', route: '/admin/storefront/shipping-methods' },
          checklist: ['Un método con costo', 'Tiempo estimado de entrega']
        },
        {
          id: 'payment',
          title: 'Define cómo te pagan',
          description: 'Activa al menos un método de pago manual (transferencia, contra entrega) o habilita el cobro con tarjeta vía Stripe.',
          action: { label: 'Métodos de pago', route: '/admin/payment-methods' },
          tip: 'Puedes ofrecer ambos: los manuales se concilian desde el panel y la tarjeta se cobra y confirma sola.'
        },
        {
          id: 'activate',
          title: 'Enciende la tienda y pruébala',
          description: 'Activa el estado de la tienda, abre el enlace público y completa una compra de prueba de principio a fin.',
          action: { label: 'Ver mis órdenes', route: '/admin/orders' },
          tip: 'La orden de prueba aparecerá en Órdenes con el badge «Tienda en línea». Puedes cancelarla después.'
        },
        {
          id: 'share',
          title: 'Comparte tu tienda',
          description: 'Copia el enlace público desde los ajustes y publícalo en tus redes, tu firma de correo y tu perfil de WhatsApp Business.',
          tip: 'Comparte también enlaces directos a productos concretos: cada producto tiene su propia dirección.'
        }
      ]
    },
    faqs: [
      {
        question: '¿Las ventas de la tienda descuentan inventario automáticamente?',
        answer: 'No en el momento de la compra. La orden llega al panel con origen «Tienda en línea»; al marcarla como entregada se genera el picking de salida y al confirmarlo se descuenta el stock, igual que en cualquier venta del ERP.'
      },
      {
        question: '¿Puedo tener la tienda visible pero sin vender?',
        answer: 'Sí. Deja la tienda activa sin métodos de envío o con los productos marcados como no vendibles: el catálogo se ve como escaparate pero no se puede completar el checkout.'
      },
      {
        question: '¿Los clientes necesitan crear una cuenta para comprar?',
        answer: 'No. El checkout funciona como invitado. Crear cuenta es opcional y solo sirve para consultar el historial de pedidos desde la propia tienda.'
      },
      {
        question: '¿La tienda se ve bien en celular?',
        answer: 'Sí, todas las vistas públicas son responsivas. Aun así, revisa tu banner y tu barra de anuncio en pantalla pequeña antes de difundir el enlace.'
      }
    ],
    relatedModules: [
      { label: 'Productos', route: '/admin/products' },
      { label: 'Métodos de envío', route: '/admin/storefront/shipping-methods' },
      { label: 'Cupones', route: '/admin/storefront/coupons' },
      { label: 'Analítica', route: '/admin/storefront/analytics' }
    ],
    relatedArticles: ['storefront-shipping-list', 'storefront-coupons-list', 'storefront-stripe', 'storefront-fulfillment', 'products-create'],
    tags: ['tienda', 'ecommerce', 'storefront', 'en línea', 'slug', 'branding', 'vender', 'catálogo']
  },
  {
    id: 'storefront-fulfillment',
    routePatterns: [],
    module: 'storefront',
    moduleLabel: 'Tienda en línea',
    moduleEmoji: '🛍️',
    title: 'Cómo atender un pedido de la tienda',
    viewType: 'detail',
    level: 'basico',
    isNew: true,
    summary: 'Un pedido en línea recorre el mismo flujo que cualquier venta: orden confirmada, entrega, picking y descuento de inventario.',
    description: 'Recorrido completo de un pedido desde que el cliente paga en la tienda hasta que sale de tu almacén. Explica dónde ver los pedidos, cómo identificar los que vienen del canal en línea y cuándo se afecta el inventario.',
    importance: 'La tienda no es un sistema aparte: sus pedidos son órdenes de venta reales. Entender el flujo evita el error más común, creer que el stock ya se descontó cuando en realidad se descuenta al confirmar el picking de salida.',
    tips: [
      'Los pedidos en línea llegan a Órdenes con el badge «Tienda en línea»; filtra por ese origen para atenderlos primero.',
      'Un pedido nace confirmado y sin pagar, salvo que el cliente haya pagado con tarjeta: en ese caso queda pagado automáticamente.',
      'Los pagos manuales (transferencia, contra entrega) se concilian a mano desde la orden cuando confirmes que el dinero entró.',
      'El costo de envío se agrega como una línea más de la orden para que los totales e impuestos cuadren.',
      'Entre la compra y el picking puede haber sobreventa si el mismo producto se vende por otro canal. Revisa existencias antes de prometer una fecha de entrega.'
    ],
    process: [
      { step: 1, title: 'Pedido', description: 'El cliente compra en la tienda.' },
      { step: 2, title: 'Orden', description: 'Llega a Órdenes como venta confirmada.' },
      { step: 3, title: 'Cobro', description: 'Automático con tarjeta o conciliado a mano.' },
      { step: 4, title: 'Entrega', description: 'Marcas la orden como entregada.' },
      { step: 5, title: 'Picking', description: 'Confirmas la salida y baja el inventario.' }
    ],
    wizard: {
      id: 'wz-storefront-fulfillment',
      title: 'Atiende tu primer pedido en línea',
      description: 'Del aviso de compra al paquete entregado.',
      estimatedMinutes: 8,
      steps: [
        {
          id: 'find',
          title: 'Localiza el pedido',
          description: 'Abre Órdenes y busca las que tienen el badge «Tienda en línea». Ahí ves el cliente, las líneas, el método de envío y el estado de pago.',
          action: { label: 'Ir a Órdenes', route: '/admin/orders' }
        },
        {
          id: 'payment',
          title: 'Verifica el pago',
          description: 'Si el cliente pagó con tarjeta, la orden ya aparece pagada. Si eligió un método manual, confirma que recibiste el dinero y márcala como pagada.',
          tip: 'No prepares el envío de un pago por transferencia sin verificar el comprobante en tu banco.'
        },
        {
          id: 'prepare',
          title: 'Prepara la mercancía',
          description: 'Revisa existencias en el almacén de salida y arma el paquete con las cantidades de cada línea.',
          action: { label: 'Ver Productos', route: '/admin/products' }
        },
        {
          id: 'deliver',
          title: 'Marca la orden como entregada',
          description: 'Al hacerlo, Flowbit genera automáticamente el picking de salida asociado a la orden.',
          tip: 'Registra la guía o número de rastreo en las notas de la orden para poder responder al cliente después.'
        },
        {
          id: 'picking',
          title: 'Confirma el picking',
          description: 'Abre el movimiento generado y confírmalo. Ese es el momento exacto en que el inventario se descuenta.',
          action: { label: 'Ir a Movimientos', route: '/admin/pickings' },
          warning: 'Mientras el picking no se confirme, tu inventario seguirá mostrando unidades que ya vendiste.'
        }
      ]
    },
    faqs: [
      {
        question: '¿Cómo cancelo un pedido en línea?',
        answer: 'Cancela la orden desde su vista de detalle. Si ya fue pagada con tarjeta, el reembolso se gestiona desde tu panel de Stripe; Flowbit registra el evento de devolución en la analítica.'
      },
      {
        question: '¿El cliente recibe algún aviso?',
        answer: 'Al comprar ve la página de confirmación con su número de pedido, que puede consultar después con su correo. Los avisos por correo dependen de la configuración de tu proveedor de email.'
      }
    ],
    relatedModules: [
      { label: 'Órdenes', route: '/admin/orders' },
      { label: 'Movimientos', route: '/admin/pickings' },
      { label: 'Ajustes de tienda', route: '/admin/storefront' }
    ],
    relatedArticles: ['orders-detail', 'pickings-detail', 'storefront-settings'],
    tags: ['pedido', 'tienda', 'cumplimiento', 'envío', 'entrega', 'inventario', 'fulfillment']
  },
  {
    id: 'storefront-coupons-list',
    routePatterns: ['/admin/storefront/coupons'],
    module: 'storefront',
    moduleLabel: 'Tienda en línea',
    moduleEmoji: '🛍️',
    title: 'Cupones de descuento',
    viewType: 'list',
    level: 'intermedio',
    isNew: true,
    summary: 'Los cupones aplican descuentos por porcentaje o monto fijo en el carrito de tu tienda, con vigencia y límite de usos.',
    description: 'Listado de los cupones de tu tienda en línea. Cada cupón tiene un código que el cliente escribe en el carrito y reglas que definen cuándo es válido: fechas, compra mínima y número máximo de usos.',
    importance: 'Los cupones son tu herramienta de promoción medible: puedes lanzar campañas por temporada, recuperar carritos abandonados o premiar a tu comunidad, sabiendo exactamente cuántas veces se usó cada código.',
    tips: [
      'Usa códigos cortos, en mayúsculas y fáciles de dictar por teléfono o de escribir en un celular: BIENVENIDO10 funciona mejor que dscto-nvo-2026.',
      'Un código por campaña. Si lanzas el mismo descuento en Instagram y en tu newsletter, crea dos códigos distintos para saber qué canal vendió más.',
      'El límite de usos protege tu margen si el código se filtra a un sitio de descuentos.',
      'La compra mínima se compara contra el subtotal sin impuestos, no contra el total final.',
      'Archiva los cupones vencidos en lugar de borrarlos: así conservas el historial de las órdenes que los usaron.'
    ],
    relatedModules: [
      { label: 'Ajustes de tienda', route: '/admin/storefront' },
      { label: 'Analítica', route: '/admin/storefront/analytics' }
    ],
    relatedArticles: ['storefront-coupons-create', 'storefront-settings'],
    tags: ['cupón', 'descuento', 'promoción', 'código', 'tienda', 'campaña']
  },
  {
    id: 'storefront-coupons-create',
    routePatterns: ['/admin/storefront/coupons/create'],
    module: 'storefront',
    moduleLabel: 'Tienda en línea',
    moduleEmoji: '🛍️',
    title: 'Crear un cupón',
    viewType: 'create',
    level: 'intermedio',
    isNew: true,
    summary: 'Define código, tipo de descuento, vigencia y límite de usos para lanzar una promoción en tu tienda.',
    description: 'Formulario de alta de un cupón de descuento. Define el código que escribirá el cliente, si el descuento es porcentual o de monto fijo, y las condiciones bajo las que se acepta.',
    importance: 'Un cupón mal configurado se convierte en pérdida directa: sin compra mínima ni límite de usos, un descuento generoso puede aplicarse miles de veces en pedidos pequeños.',
    tips: [
      'Antes de publicar el código, pruébalo tú mismo en el carrito de tu tienda con un pedido real de prueba.',
      'Para descuentos de porcentaje, el ahorro se reparte proporcionalmente en cada línea del pedido; para monto fijo se agrega una línea negativa al total.',
      'Deja «Vigente hasta» siempre lleno en campañas de temporada: es la forma más segura de que la promoción termine sola.',
      'La descripción interna no la ve el cliente: úsala para anotar en qué campaña o red social se publicó el código.'
    ],
    fields: [
      { label: 'Código', required: true, type: 'text', description: 'Texto que el cliente escribe en el carrito para obtener el descuento.', tip: 'Se compara sin distinguir mayúsculas. Evita caracteres confusos como la O y el cero.' },
      { label: 'Tipo de descuento', required: true, type: 'select', description: 'Porcentaje sobre el subtotal o monto fijo en dinero.', tip: 'El porcentaje escala con el tamaño del pedido; el monto fijo es más agresivo en pedidos chicos.' },
      { label: 'Porcentaje / Monto de descuento', required: true, type: 'number', description: 'Valor del descuento según el tipo elegido.', tip: 'En porcentaje captura solo el número (10 significa 10 %).' },
      { label: 'Compra mínima', required: false, type: 'number', description: 'Subtotal sin impuestos que debe alcanzar el carrito para aceptar el cupón.', tip: 'Ponla por encima de tu ticket promedio para que la promoción aumente el valor del pedido.' },
      { label: 'Límite de usos', required: false, type: 'number', description: 'Número máximo de veces que el cupón puede canjearse en total.', tip: 'Déjalo vacío solo en códigos privados; en campañas públicas siempre pon un tope.' },
      { label: 'Vigente desde', required: false, type: 'date', description: 'Fecha en que el cupón empieza a aceptarse.', tip: 'Úsalo para dejar preparada una promoción que arranca a medianoche.' },
      { label: 'Vigente hasta', required: false, type: 'date', description: 'Fecha en que el cupón deja de aceptarse.', tip: 'Una fecha de fin visible en tu publicación genera urgencia y mejora la conversión.' },
      { label: 'Descripción interna', required: false, type: 'textarea', description: 'Nota para tu equipo sobre el objetivo de la campaña.', tip: 'Anota el canal y la fecha de publicación para poder medir resultados después.' }
    ],
    process: [
      { step: 1, title: 'Código', description: 'Define el texto del cupón.' },
      { step: 2, title: 'Descuento', description: 'Porcentaje o monto fijo.' },
      { step: 3, title: 'Reglas', description: 'Mínimo, usos y vigencia.' },
      { step: 4, title: 'Prueba', description: 'Cánjealo en tu tienda.' },
      { step: 5, title: 'Publica', description: 'Compártelo en tus canales.' }
    ],
    relatedModules: [
      { label: 'Cupones', route: '/admin/storefront/coupons' },
      { label: 'Ajustes de tienda', route: '/admin/storefront' }
    ],
    relatedArticles: ['storefront-coupons-list', 'storefront-analytics'],
    tags: ['cupón', 'crear', 'descuento', 'porcentaje', 'vigencia', 'promoción']
  },
  {
    id: 'storefront-coupons-detail',
    routePatterns: ['/admin/storefront/coupons/:id'],
    module: 'storefront',
    moduleLabel: 'Tienda en línea',
    moduleEmoji: '🛍️',
    title: 'Detalle del cupón',
    viewType: 'detail',
    level: 'intermedio',
    isNew: true,
    summary: 'Consulta cuántas veces se canjeó un cupón, ajusta sus reglas o archívalo cuando termine la campaña.',
    description: 'Vista de consulta y edición de un cupón existente. Muestra su configuración y el contador de usos acumulados, y permite modificar las reglas o archivarlo.',
    importance: 'El contador de usos es la medida directa del éxito de una campaña. Revisarlo te dice qué códigos vale la pena repetir y cuáles nunca se usaron.',
    tips: [
      'Si un cupón ya se está usando, evita cambiar el porcentaje: los clientes que lo vieron publicado esperan el descuento anunciado.',
      'Para cortar una promoción de inmediato, archiva el cupón; deja de aceptarse en el carrito al instante.',
      'Subir el límite de usos de un cupón exitoso es más seguro que crear un código nuevo: conservas la métrica en un solo lugar.'
    ],
    relatedModules: [
      { label: 'Cupones', route: '/admin/storefront/coupons' }
    ],
    relatedArticles: ['storefront-coupons-create'],
    tags: ['cupón', 'editar', 'usos', 'archivar', 'campaña']
  },
  {
    id: 'storefront-shipping-list',
    routePatterns: ['/admin/storefront/shipping-methods'],
    module: 'storefront',
    moduleLabel: 'Tienda en línea',
    moduleEmoji: '🛍️',
    title: 'Métodos de envío',
    viewType: 'list',
    level: 'basico',
    isNew: true,
    summary: 'Sin al menos un método de envío activo, tus clientes no pueden completar el checkout de la tienda.',
    description: 'Listado de las opciones de entrega que verá el cliente en el paso de envío del checkout: nombre, costo, tiempo estimado y orden de aparición.',
    importance: 'Es un requisito para vender en línea. Además, el costo y el tiempo de entrega son dos de los factores que más pesan en la decisión de compra: opciones claras reducen el abandono del carrito.',
    tips: [
      'Ofrece al menos dos opciones: una económica y una rápida. Dar a elegir aumenta la conversión.',
      'El costo del envío se agrega como una línea más de la orden, por lo que se refleja correctamente en los totales y reportes.',
      'Un método con costo cero se muestra como «Envío gratis» y es un gancho comercial potente combinado con una compra mínima por cupón.',
      'El orden de aparición decide cuál ve primero el cliente: pon arriba el que más te conviene operar.',
      'Si ofreces recolección en tienda, créala como método de envío con costo cero y explica la dirección en la descripción.'
    ],
    relatedModules: [
      { label: 'Ajustes de tienda', route: '/admin/storefront' },
      { label: 'Almacenes', route: '/admin/warehouses' }
    ],
    relatedArticles: ['storefront-shipping-create', 'storefront-settings'],
    tags: ['envío', 'entrega', 'shipping', 'costo', 'tienda', 'checkout']
  },
  {
    id: 'storefront-shipping-create',
    routePatterns: ['/admin/storefront/shipping-methods/create'],
    module: 'storefront',
    moduleLabel: 'Tienda en línea',
    moduleEmoji: '🛍️',
    title: 'Crear método de envío',
    viewType: 'create',
    level: 'basico',
    isNew: true,
    summary: 'Define nombre, costo y tiempo estimado de cada opción de entrega de tu tienda en línea.',
    description: 'Formulario de alta de una opción de entrega. Lo que captures aquí es exactamente lo que el cliente lee al elegir cómo recibir su pedido.',
    importance: 'La claridad de este formulario evita disputas posteriores: un tiempo estimado realista y un costo correcto son la base de una experiencia de compra sin reclamos.',
    tips: [
      'Escribe el nombre desde la perspectiva del cliente: «Entrega a domicilio (24-48 h)» comunica más que «Estándar».',
      'Sé conservador con el tiempo estimado: prometer tres días y entregar en dos genera mejores reseñas que lo contrario.',
      'Usa la descripción para las condiciones: zonas de cobertura, horarios o restricciones de tamaño.',
      'Si tus costos varían por zona, crea un método por zona en lugar de promediar: el promedio te hace perder dinero en las entregas lejanas.'
    ],
    fields: [
      { label: 'Nombre', required: true, type: 'text', description: 'Etiqueta que ve el cliente en el checkout.', tip: 'Incluye el tiempo de entrega en el nombre para que se lea de un vistazo.' },
      { label: 'Costo', required: true, type: 'number', description: 'Importe que se cobra por este envío.', tip: 'Captura 0 para envío gratuito; se mostrará como tal en la tienda.' },
      { label: 'Tiempo estimado', required: false, type: 'text', description: 'Texto libre con la promesa de entrega.', tip: 'Usa rangos («3 a 5 días hábiles») en lugar de fechas exactas.' },
      { label: 'Orden de aparición', required: false, type: 'number', description: 'Posición en la lista del checkout, de menor a mayor.', tip: 'Numera de 10 en 10 para poder insertar métodos nuevos sin renumerar todo.' },
      { label: 'Descripción', required: false, type: 'textarea', description: 'Detalles y condiciones del método.', tip: 'Aclara aquí las zonas donde no aplica para evitar pedidos que no puedes cumplir.' }
    ],
    relatedModules: [
      { label: 'Métodos de envío', route: '/admin/storefront/shipping-methods' }
    ],
    relatedArticles: ['storefront-shipping-list'],
    tags: ['envío', 'crear', 'costo', 'tiempo', 'entrega']
  },
  {
    id: 'storefront-shipping-detail',
    routePatterns: ['/admin/storefront/shipping-methods/:id'],
    module: 'storefront',
    moduleLabel: 'Tienda en línea',
    moduleEmoji: '🛍️',
    title: 'Detalle del método de envío',
    viewType: 'detail',
    level: 'basico',
    isNew: true,
    summary: 'Ajusta el costo o el tiempo de entrega de una opción de envío, o archívala cuando dejes de ofrecerla.',
    description: 'Vista de consulta y edición de un método de envío existente, con la opción de archivarlo para que deje de aparecer en el checkout.',
    importance: 'Los costos de paquetería cambian. Mantener esta información al día evita que cada venta en línea te cueste más de lo que cobras por el envío.',
    tips: [
      'Al subir el costo, avisa en la barra de anuncio de tu tienda: los clientes recurrentes notan el cambio.',
      'Archivar un método no afecta las órdenes anteriores; conservan el nombre y el costo con el que se vendieron.'
    ],
    relatedModules: [
      { label: 'Métodos de envío', route: '/admin/storefront/shipping-methods' }
    ],
    relatedArticles: ['storefront-shipping-create'],
    tags: ['envío', 'editar', 'archivar', 'costo']
  },
  {
    id: 'storefront-stripe',
    routePatterns: [],
    module: 'storefront',
    moduleLabel: 'Tienda en línea',
    moduleEmoji: '🛍️',
    title: 'Cobrar con tarjeta (Stripe)',
    viewType: 'config',
    level: 'avanzado',
    isNew: true,
    summary: 'Conecta tu cuenta de Stripe y cobra con tarjeta en tu tienda: Flowbit nunca almacena datos de tarjeta.',
    description: 'Cada empresa puede conectar su propia cuenta de Stripe para aceptar pagos con tarjeta en el checkout. El cobro ocurre en la página segura de Stripe y la orden se marca como pagada automáticamente al confirmarse.',
    importance: 'El pago con tarjeta es lo que convierte tu catálogo en una tienda que cobra sola, sin conciliar transferencias a mano. Además, como el cobro ocurre en la página de Stripe, tu negocio no maneja ni almacena datos de tarjeta.',
    tips: [
      'Empieza siempre con las claves de prueba (pk_test y sk_test) y la tarjeta 4242 4242 4242 4242 antes de pasar a producción.',
      'La secret key es una credencial sensible: no la compartas por chat ni la publiques en capturas de pantalla.',
      'Configura el webhook: sin él el cobro también funciona, pero solo se confirma cuando el cliente vuelve a la página de confirmación.',
      'El monto siempre se toma de la orden guardada en la base de datos, nunca de lo que envíe el navegador: el cliente no puede alterar el precio.',
      'Si el cliente cancela el pago, la orden queda pendiente y en la confirmación aparece el botón «Pagar ahora con tarjeta» para reintentar.',
      'Los reembolsos se hacen desde tu panel de Stripe; en Flowbit cancela la orden para que el inventario y los reportes queden consistentes.'
    ],
    fields: [
      { label: 'Habilitado', required: true, type: 'boolean', description: 'Muestra u oculta la opción de tarjeta en el checkout.', tip: 'Desactívalo si necesitas suspender los cobros: los métodos manuales siguen funcionando.' },
      { label: 'Publishable key', required: true, type: 'text', description: 'Clave pública de Stripe (pk_...).', tip: 'Es pública por diseño; se usa para iniciar la sesión de pago.' },
      { label: 'Secret key', required: true, type: 'text', description: 'Clave secreta de Stripe (sk_... o rk_... restringida).', tip: 'Prefiere una clave restringida con permisos solo sobre Checkout Sessions.' },
      { label: 'Webhook signing secret', required: false, type: 'text', description: 'Secreto de firma (whsec_...) con el que se verifica cada aviso de Stripe.', tip: 'Recomendado: garantiza que la orden se marque como pagada aunque el cliente cierre la pestaña.' }
    ],
    process: [
      { step: 1, title: 'Claves', description: 'Copia las claves desde Stripe.' },
      { step: 2, title: 'Webhook', description: 'Registra la URL y pega el secreto.' },
      { step: 3, title: 'Habilita', description: 'Activa el pago con tarjeta.' },
      { step: 4, title: 'Prueba', description: 'Compra con la tarjeta de prueba.' },
      { step: 5, title: 'Producción', description: 'Cambia a las claves reales.' }
    ],
    wizard: {
      id: 'wz-stripe',
      title: 'Conecta Stripe y cobra con tarjeta',
      description: 'De cuenta de Stripe a primer cobro confirmado.',
      estimatedMinutes: 15,
      steps: [
        {
          id: 'account',
          title: 'Ten lista tu cuenta de Stripe',
          description: 'Crea o abre tu cuenta en Stripe y ve a Developers → API keys. Verás la publishable key y la secret key.',
          tip: 'Activa primero el modo de prueba (Test mode) con el interruptor del panel de Stripe.'
        },
        {
          id: 'keys',
          title: 'Pega las claves en Flowbit',
          description: 'En Ajustes de tienda, sección «Pasarela de pago — Stripe», pega ambas claves y guarda.',
          action: { label: 'Ir a Ajustes de tienda', route: '/admin/storefront' },
          warning: 'Verifica que estés pegando el par completo de claves del mismo modo (ambas de prueba o ambas de producción).'
        },
        {
          id: 'webhook',
          title: 'Registra el webhook',
          description: 'En Stripe → Developers → Webhooks crea un endpoint con la URL que muestra el panel, suscrito a los eventos de sesión de checkout completada, y pega aquí el signing secret.',
          checklist: ['Endpoint creado en Stripe', 'Eventos de checkout suscritos', 'Signing secret pegado en Flowbit']
        },
        {
          id: 'enable',
          title: 'Habilita el pago con tarjeta',
          description: 'Activa el interruptor «Habilitado» y guarda. La opción de tarjeta aparecerá en el paso de pago de tu checkout.'
        },
        {
          id: 'test',
          title: 'Haz una compra de prueba',
          description: 'Compra en tu propia tienda usando la tarjeta 4242 4242 4242 4242, cualquier fecha futura y cualquier CVC. Comprueba que la orden llegue marcada como pagada.',
          action: { label: 'Ver Órdenes', route: '/admin/orders' }
        },
        {
          id: 'live',
          title: 'Pasa a producción',
          description: 'Cuando la prueba funcione, cambia en Stripe a modo real, copia el nuevo par de claves y el nuevo signing secret, y actualízalos en Flowbit.',
          warning: 'Las claves de prueba y las reales no son intercambiables: si mezclas modos, los cobros fallan silenciosamente.'
        }
      ]
    },
    faqs: [
      {
        question: '¿Flowbit guarda los datos de la tarjeta de mis clientes?',
        answer: 'No. El cobro ocurre en la página hospedada de Stripe; Flowbit solo recibe la confirmación de que el pago se realizó y el identificador de la transacción.'
      },
      {
        question: '¿Qué pasa si el cliente cierra la pestaña justo al pagar?',
        answer: 'Si tienes el webhook configurado, Stripe avisa igualmente y la orden se marca como pagada. Sin webhook, la confirmación ocurre cuando el cliente regresa a la página de confirmación.'
      },
      {
        question: '¿Puedo ofrecer tarjeta y transferencia al mismo tiempo?',
        answer: 'Sí. La opción de tarjeta convive con todos los métodos de pago manuales de tu catálogo; el cliente elige en el checkout.'
      },
      {
        question: '¿Por qué la opción de tarjeta no aparece en mi tienda?',
        answer: 'Revisa tres cosas: que el interruptor esté habilitado, que ambas claves estén guardadas y que el despliegue tenga configurada la clave de servicio de Supabase. Sin ella los cobros con tarjeta responden con error y la tienda opera solo con métodos manuales.'
      }
    ],
    relatedModules: [
      { label: 'Ajustes de tienda', route: '/admin/storefront' },
      { label: 'Métodos de pago', route: '/admin/payment-methods' },
      { label: 'Órdenes', route: '/admin/orders' }
    ],
    relatedArticles: ['storefront-settings', 'storefront-fulfillment', 'payment-methods-list'],
    tags: ['stripe', 'tarjeta', 'pago', 'pasarela', 'cobro', 'checkout', 'webhook', 'seguridad']
  },
  {
    id: 'storefront-analytics',
    routePatterns: ['/admin/storefront/analytics'],
    module: 'storefront',
    moduleLabel: 'Tienda en línea',
    moduleEmoji: '🛍️',
    title: 'Analítica de la tienda',
    viewType: 'analytics',
    level: 'intermedio',
    isNew: true,
    summary: 'Analítica propia de tu tienda: visitas, embudo de checkout, productos más vistos y de dónde llegan tus clientes.',
    description: 'Panel de métricas del canal en línea. Mide visitas, sesiones, visitantes nuevos, embudo de compra, abandono de carrito, productos más vistos y comprados, fuentes de tráfico, búsquedas, dispositivos y países. Los datos son de la propia plataforma, sin servicios de terceros.',
    importance: 'Sin medición, mejorar la tienda es adivinar. El embudo te dice exactamente en qué paso pierdes clientes, y los tops te dicen qué productos y qué canales merecen tu inversión.',
    tips: [
      'Empieza por el embudo: si muchos ven producto pero pocos agregan al carrito, el problema es el precio o la ficha; si agregan pero no compran, el problema es el envío o el pago.',
      'Compara siempre contra el periodo anterior. Un número suelto no dice nada; una tendencia sí.',
      'Los productos más vistos que no aparecen entre los más comprados son tu mejor oportunidad: hay interés, falta cerrar la venta.',
      'Las búsquedas sin resultados te dicen qué te están pidiendo tus clientes y no tienes en catálogo.',
      'Las fuentes de tráfico se detectan por el enlace de origen. Si compartes en redes, agrega parámetros de campaña a la URL para distinguir cada publicación.',
      'Los datos se procesan por lotes cada pocos minutos: si acabas de recibir una visita, dale un momento antes de esperarla en el reporte.'
    ],
    process: [
      { step: 1, title: 'Visita', description: 'El cliente entra a la tienda.' },
      { step: 2, title: 'Producto', description: 'Ve fichas y agrega al carrito.' },
      { step: 3, title: 'Checkout', description: 'Avanza envío y pago.' },
      { step: 4, title: 'Compra', description: 'La orden confirma la conversión.' },
      { step: 5, title: 'Reporte', description: 'Todo se resume en el panel.' }
    ],
    wizard: {
      id: 'wz-analytics-read',
      title: 'Lee tu analítica en 5 minutos',
      description: 'Una rutina semanal para saber qué mejorar en tu tienda.',
      estimatedMinutes: 5,
      steps: [
        {
          id: 'range',
          title: 'Elige el rango y compara',
          description: 'Selecciona los últimos 7 o 30 días. Fíjate en la variación contra el periodo anterior, no en el número absoluto.',
          action: { label: 'Abrir Analítica', route: '/admin/storefront/analytics' }
        },
        {
          id: 'funnel',
          title: 'Revisa el embudo',
          description: 'Localiza el paso con la mayor caída porcentual. Ese es tu cuello de botella de esta semana.',
          tip: 'Una caída fuerte al pasar a envío casi siempre significa que el costo de envío sorprende al cliente.'
        },
        {
          id: 'products',
          title: 'Cruza vistos contra comprados',
          description: 'Compara la lista de productos más vistos con la de más comprados. Las diferencias marcan qué fichas mejorar.',
          action: { label: 'Ir a Productos', route: '/admin/products' }
        },
        {
          id: 'sources',
          title: 'Identifica tu mejor canal',
          description: 'Mira de dónde llegan tus visitas y qué búsquedas hacen dentro de la tienda. Invierte donde ya funciona.'
        },
        {
          id: 'act',
          title: 'Toma una sola acción',
          description: 'Elige una mejora concreta para la semana: bajar el costo de envío, mejorar una ficha, lanzar un cupón o publicar en el canal que más convierte.',
          action: { label: 'Crear un cupón', route: '/admin/storefront/coupons/create' }
        }
      ]
    },
    faqs: [
      {
        question: '¿Se rastrea a los visitantes sin su permiso?',
        answer: 'No. La tienda muestra un aviso de cookies y no captura absolutamente nada hasta que el visitante acepta. Si rechaza, se borra su identificador local.'
      },
      {
        question: '¿Se guardan datos personales de los visitantes?',
        answer: 'No. No se almacenan nombres, correos ni direcciones IP: solo un identificador anónimo por navegador y el país derivado de la conexión.'
      },
      {
        question: '¿Por qué las compras aparecen aunque el cliente use bloqueador de anuncios?',
        answer: 'Porque las compras y devoluciones se registran del lado del servidor a partir de la orden, no desde el navegador. Son la métrica más confiable del panel.'
      },
      {
        question: '¿Cada cuánto se actualizan los datos?',
        answer: 'El procesamiento corre periódicamente y también al abrir el panel, con un intervalo mínimo entre ejecuciones para no saturar la base de datos.'
      }
    ],
    relatedModules: [
      { label: 'Ajustes de tienda', route: '/admin/storefront' },
      { label: 'Cupones', route: '/admin/storefront/coupons' },
      { label: 'Productos', route: '/admin/products' }
    ],
    relatedArticles: ['storefront-settings', 'storefront-coupons-create', 'storefront-fulfillment'],
    tags: ['analítica', 'métricas', 'embudo', 'conversión', 'visitas', 'reportes', 'tráfico', 'privacidad']
  },
  {
    id: 'storefront-public',
    routePatterns: ['/stores/:slug'],
    module: 'storefront',
    moduleLabel: 'Tienda en línea',
    moduleEmoji: '🛍️',
    title: 'La tienda vista por tu cliente',
    viewType: 'public',
    level: 'basico',
    isNew: true,
    summary: 'Portada, catálogo, ficha de producto, carrito y checkout en cuatro pasos: así compra tu cliente en Flowbit.',
    description: 'Recorrido por las páginas públicas de tu tienda para que sepas qué ve exactamente quien te compra: portada con destacados, catálogo con filtros, ficha de producto, carrito con cupones y un checkout de cuatro pasos.',
    importance: 'Conocer la experiencia del comprador te permite explicarla por teléfono, detectar qué falta configurar y escribir mejores publicaciones al promocionar productos concretos.',
    tips: [
      'Cada producto tiene su propia dirección web: compártela directo en redes en lugar de enviar siempre a la portada.',
      'El carrito se guarda en el navegador del cliente: si cierra la pestaña y vuelve, su compra sigue ahí.',
      'La página de confirmación pide el correo de la compra para mostrar el pedido: es una protección para que nadie más consulte pedidos ajenos.',
      'Los clientes pueden crear una cuenta opcional en la tienda para ver su historial de pedidos.',
      'Revisa tu propia tienda en un celular al menos una vez al mes: la mayoría de tus visitas llegarán desde ahí.'
    ],
    process: [
      { step: 1, title: 'Portada', description: 'Hero, categorías y destacados.' },
      { step: 2, title: 'Catálogo', description: 'Búsqueda, filtros y orden.' },
      { step: 3, title: 'Producto', description: 'Ficha, atributos y cantidad.' },
      { step: 4, title: 'Carrito', description: 'Resumen y cupón.' },
      { step: 5, title: 'Checkout', description: 'Contacto, envío, pago y revisión.' }
    ],
    faqs: [
      {
        question: '¿Qué ve el cliente si desactivo la tienda?',
        answer: 'Un mensaje de «Tienda no disponible» en todas las rutas de tu tienda, sin exponer ningún dato de tu empresa.'
      },
      {
        question: '¿Se muestran mis costos o márgenes?',
        answer: 'Nunca. Las páginas públicas solo exponen los productos publicados con su precio de venta; los costos y datos internos jamás salen del panel.'
      }
    ],
    relatedModules: [
      { label: 'Ajustes de tienda', route: '/admin/storefront' },
      { label: 'Productos', route: '/admin/products' }
    ],
    relatedArticles: ['storefront-settings', 'storefront-fulfillment', 'storefront-analytics'],
    tags: ['tienda pública', 'catálogo', 'carrito', 'checkout', 'cliente', 'comprar']
  },
  // ─── PUNTO DE VENTA ──────────────────────────────────────────────────────────
  {
    id: 'pos-terminal',
    routePatterns: ['/pos', '/pos/terminal'],
    module: 'pos',
    moduleLabel: 'Punto de Venta',
    moduleEmoji: '🧾',
    title: 'Terminal de venta',
    viewType: 'terminal',
    level: 'basico',
    isNew: true,
    summary: 'Cobra en mostrador con teclado: cada ticket es una orden real, pagada, entregada y descontada del inventario.',
    description: 'Pantalla de venta del punto de venta. Está diseñada para operarse con teclado y lector de código de barras: buscas el producto, ajustas cantidades, aplicas descuentos y cobras. Cada ticket cobrado genera una orden de venta confirmada con su salida de inventario.',
    importance: 'Es donde ocurre el dinero del mostrador. Operarla con atajos en vez del ratón reduce el tiempo por cliente de minutos a segundos, y como cada venta descuenta inventario en tiempo real, tu stock refleja la realidad sin capturas adicionales.',
    tips: [
      'El cursor siempre vuelve a la búsqueda: escanea o teclea nombre o código y presiona Enter para agregar.',
      'Para vender varias unidades del mismo artículo, teclea el multiplicador antes de escanear: 3* y luego el código agrega tres piezas de golpe.',
      'Aprende primero cuatro teclas: F2 buscar, F4 descuento, F9 cobrar y F12 cerrar caja. Con eso operas un turno completo.',
      'F6 pone el ticket en espera para atender a otro cliente sin perder lo capturado; recupéralo desde el indicador ámbar.',
      'La venta en curso se guarda en el equipo: si la pantalla se recarga o se va la luz un momento, el ticket sigue ahí.',
      'No se puede vender sin una sesión de caja abierta, y cada caja admite una sola sesión abierta a la vez.',
      'Si un descuento supera tu límite como cajero, el sistema pedirá autorización de un supervisor.'
    ],
    shortcuts: [
      { keys: 'F1 / ?', action: 'Ver el mapa completo de atajos' },
      { keys: 'F2', action: 'Volver el foco a la búsqueda de productos' },
      { keys: 'F3', action: 'Buscar o dar de alta un cliente' },
      { keys: 'F4', action: 'Aplicar descuento a la línea o al ticket' },
      { keys: 'F6', action: 'Poner el ticket en espera / recuperarlo' },
      { keys: 'F7', action: 'Registrar entrada o salida de efectivo' },
      { keys: 'F9', action: 'Ir al cobro' },
      { keys: 'F10', action: 'Corte X (informativo, sin cerrar caja)' },
      { keys: 'F12', action: 'Corte Z (cierra la sesión de caja)' },
      { keys: 'Enter', action: 'Agregar el producto buscado / confirmar el pago' },
      { keys: 'Esc', action: 'Cancelar la acción o cerrar el modal' },
      { keys: '↑ ↓', action: 'Navegar entre las líneas del ticket' },
      { keys: '+ / −', action: 'Subir o bajar la cantidad de la línea seleccionada' },
      { keys: 'Supr', action: 'Eliminar la línea seleccionada' },
      { keys: 'Ctrl + Supr', action: 'Descartar el ticket completo' },
      { keys: '1 – 9', action: 'Elegir método de pago dentro del cobro' },
      { keys: 'Ctrl + P', action: 'Reimprimir el último ticket' },
      { keys: 'N*', action: 'Multiplicador antes de escanear (ejemplo: 3*)' }
    ],
    wizard: {
      id: 'wz-pos-shift',
      title: 'Tu primer turno de caja',
      description: 'Abrir, vender, cobrar y cerrar sin perderte.',
      estimatedMinutes: 10,
      steps: [
        {
          id: 'open',
          title: 'Abre tu caja',
          description: 'Entra al terminal, selecciona tu caja y pulsa «Abrir caja». Captura el fondo inicial en efectivo con el que arrancas el turno.',
          action: { label: 'Abrir el terminal', route: '/pos' },
          warning: 'Cuenta el fondo físicamente antes de capturarlo: ese número es la base de tu corte al final del turno.'
        },
        {
          id: 'sell',
          title: 'Arma el ticket',
          description: 'Escanea o busca los productos y ajusta cantidades con + y −. Con F3 asocias al cliente si lo necesitas.',
          checklist: ['Productos agregados', 'Cantidades correctas', 'Cliente asociado si aplica'],
          tip: 'Por defecto la venta se registra a «Público general»; solo asocia cliente cuando pidan comprobante o quieras historial.'
        },
        {
          id: 'discount',
          title: 'Aplica descuentos si corresponde',
          description: 'Con F4 aplicas descuento a la línea seleccionada o al ticket completo, en porcentaje o en monto.',
          tip: 'Si el sistema pide autorización, es porque el descuento excede el límite configurado para tu caja.'
        },
        {
          id: 'charge',
          title: 'Cobra con F9',
          description: 'Elige el método con las teclas 1 a 9, captura lo recibido y confirma. Puedes combinar métodos en un mismo ticket (efectivo más tarjeta).',
          tip: 'En efectivo tienes botones de denominaciones y «Exacto»; el cambio se muestra en grande hasta que inicies la siguiente venta.'
        },
        {
          id: 'cash',
          title: 'Registra movimientos de efectivo',
          description: 'Durante el turno, usa F7 para registrar entradas (cambio adicional) y salidas (retiros). El motivo es obligatorio.',
          warning: 'Todo movimiento afecta el efectivo esperado en tu corte. Registrarlos al momento evita diferencias al cerrar.'
        },
        {
          id: 'close',
          title: 'Cierra con el corte Z',
          description: 'Con F12 declaras lo contado por método de pago, justificas diferencias si las hay y cierras la sesión, que queda inmutable.',
          action: { label: 'Ir al corte', route: '/pos/close' }
        }
      ]
    },
    faqs: [
      {
        question: '¿Puedo vender si no abrí caja?',
        answer: 'No. La venta requiere una sesión de caja abierta; es lo que permite cuadrar el efectivo al final del turno.'
      },
      {
        question: '¿Qué pasa si me equivoco después de cobrar?',
        answer: 'Se registra como devolución: busca la venta por su folio, indica las cantidades a devolver y el método de reembolso. La devolución reintegra inventario y se descuenta del corte de la sesión actual.'
      },
      {
        question: '¿Las ventas del mostrador afectan el mismo inventario que la tienda en línea?',
        answer: 'Sí, es el mismo inventario. La diferencia es el momento: en el punto de venta el stock se descuenta al cobrar; en la tienda en línea, al confirmar el picking de salida.'
      },
      {
        question: '¿Puedo atender a dos clientes a la vez?',
        answer: 'Sí. Pon el primer ticket en espera con F6, atiende al segundo y recupera el ticket pendiente cuando el primero regrese.'
      }
    ],
    relatedModules: [
      { label: 'Cajas', route: '/admin/pos/registers' },
      { label: 'Sesiones de caja', route: '/admin/pos/sessions' },
      { label: 'Métodos de Pago', route: '/admin/payment-methods' }
    ],
    relatedArticles: ['pos-close', 'pos-returns', 'pos-registers-create', 'pos-sessions-list'],
    tags: ['pos', 'punto de venta', 'caja', 'cobrar', 'ticket', 'mostrador', 'atajos', 'escáner', 'vender']
  },
  {
    id: 'pos-close',
    routePatterns: ['/pos/close'],
    module: 'pos',
    moduleLabel: 'Punto de Venta',
    moduleEmoji: '🧾',
    title: 'Corte de caja',
    viewType: 'terminal',
    level: 'intermedio',
    isNew: true,
    summary: 'El corte X informa sin cerrar; el corte Z cuadra el efectivo, cierra la sesión y la vuelve inmutable.',
    description: 'Pantalla de arqueo y cierre de la sesión de caja. Compara lo que declaras haber contado contra lo que el sistema calculó por cada método de pago y exige justificar las diferencias que superen la tolerancia configurada.',
    importance: 'El corte es el control de dinero del turno. Hacerlo bien detecta faltantes el mismo día, protege al cajero de acusaciones injustas y deja un registro cerrado e inalterable de cada turno.',
    tips: [
      'El corte X (F10) es informativo y puedes hacerlo las veces que quieras: úsalo a media jornada para retirar excedente de efectivo con tranquilidad.',
      'El corte Z (F12) cierra la sesión de forma definitiva: no se puede reabrir ni editar después.',
      'El esperado en efectivo se calcula como fondo de apertura más ventas en efectivo más entradas menos salidas menos devoluciones.',
      'Si tu caja está configurada con corte ciego, no verás el monto esperado hasta declarar lo contado: es una medida de control, no un error.',
      'Cuenta el efectivo dos veces antes de declarar: corregir una declaración después del cierre no es posible.',
      'Las diferencias dentro de la tolerancia se aceptan sin comentario; las que la exceden exigen una justificación escrita.'
    ],
    process: [
      { step: 1, title: 'Cuenta', description: 'Arquea el efectivo físico.' },
      { step: 2, title: 'Declara', description: 'Captura lo contado por método.' },
      { step: 3, title: 'Compara', description: 'El sistema calcula el esperado.' },
      { step: 4, title: 'Justifica', description: 'Explica diferencias fuera de tolerancia.' },
      { step: 5, title: 'Cierra', description: 'La sesión queda inmutable con su reporte.' }
    ],
    faqs: [
      {
        question: '¿Puedo reabrir una sesión cerrada por error?',
        answer: 'No. El cierre es definitivo por diseño, para que el historial de cortes sea confiable. Si necesitas seguir vendiendo, abre una sesión nueva.'
      },
      {
        question: '¿Dónde consulto los cortes anteriores?',
        answer: 'En el panel, dentro de Punto de Venta → Sesiones de caja, con el detalle de cada sesión y su reporte imprimible.'
      },
      {
        question: '¿Qué hago si hay un faltante grande?',
        answer: 'Justifícalo con lo que sepas al momento del cierre y avisa a un administrador. El registro queda con el monto, la explicación y quién cerró la caja.'
      }
    ],
    relatedModules: [
      { label: 'Sesiones de caja', route: '/admin/pos/sessions' },
      { label: 'Cajas', route: '/admin/pos/registers' }
    ],
    relatedArticles: ['pos-terminal', 'pos-sessions-detail'],
    tags: ['corte', 'arqueo', 'cierre', 'caja', 'efectivo', 'corte z', 'corte x', 'diferencia']
  },
  {
    id: 'pos-returns',
    routePatterns: [],
    module: 'pos',
    moduleLabel: 'Punto de Venta',
    moduleEmoji: '🧾',
    title: 'Devoluciones en el mostrador',
    viewType: 'terminal',
    level: 'intermedio',
    isNew: true,
    summary: 'Una devolución en el punto de venta reintegra el inventario y descuenta del corte de la sesión actual.',
    description: 'Proceso para devolver total o parcialmente una venta ya cobrada: se busca por folio, se indican las cantidades por línea, el método de reembolso y el motivo.',
    importance: 'Una devolución mal registrada descuadra dos cosas a la vez: el inventario y el corte de caja. Hacerla desde el terminal mantiene ambos consistentes de forma automática.',
    tips: [
      'Necesitas el folio de la venta original (formato SO-XXXXXX); pídelo en el ticket impreso del cliente.',
      'Puedes devolver solo algunas líneas o algunas piezas de una línea: no es necesario anular la venta completa.',
      'El motivo es obligatorio y queda registrado: úsalo para detectar patrones de producto defectuoso.',
      'Anular una venta después de cobrada equivale a una devolución total.',
      'La mercancía devuelta regresa al inventario con una entrada confirmada, así que revisa su estado físico antes de aceptarla.'
    ],
    process: [
      { step: 1, title: 'Folio', description: 'Busca la venta original.' },
      { step: 2, title: 'Líneas', description: 'Indica qué y cuánto se devuelve.' },
      { step: 3, title: 'Reembolso', description: 'Elige el método de devolución.' },
      { step: 4, title: 'Motivo', description: 'Registra la razón.' },
      { step: 5, title: 'Confirma', description: 'Entra el inventario y ajusta el corte.' }
    ],
    faqs: [
      {
        question: '¿Puedo devolver una venta de un turno anterior?',
        answer: 'Sí. La búsqueda es por folio sin importar la sesión, pero el reembolso afecta el corte de la sesión abierta en ese momento.'
      },
      {
        question: '¿Y si el cliente pagó con tarjeta?',
        answer: 'Registra la devolución con el método de reembolso correspondiente en Flowbit y procesa la devolución del cargo en tu terminal bancaria o pasarela.'
      }
    ],
    relatedModules: [
      { label: 'Órdenes', route: '/admin/orders' },
      { label: 'Movimientos', route: '/admin/pickings' }
    ],
    relatedArticles: ['pos-terminal', 'pos-close'],
    tags: ['devolución', 'reembolso', 'anular', 'pos', 'caja', 'inventario']
  },
  {
    id: 'pos-registers-list',
    routePatterns: ['/admin/pos/registers'],
    module: 'pos',
    moduleLabel: 'Punto de Venta',
    moduleEmoji: '🧾',
    title: 'Cajas registradoras',
    viewType: 'list',
    level: 'intermedio',
    isNew: true,
    summary: 'Cada caja define su almacén de salida, su cliente por defecto, el límite de descuento y la tolerancia del corte.',
    description: 'Listado de las cajas configuradas en tu empresa. Una caja representa un punto de cobro físico y guarda las reglas con las que operarán los cajeros que abran turno en ella.',
    importance: 'La configuración de la caja determina de qué almacén sale la mercancía vendida y cuánta libertad tiene el cajero. Es el punto donde se equilibran la agilidad del mostrador y el control del negocio.',
    tips: [
      'Crea una caja por punto de cobro físico, no por cajero: los turnos identifican a la persona.',
      'Si tienes varias sucursales, asigna a cada caja el almacén de su sucursal para que el inventario se descuente del lugar correcto.',
      'El límite de descuento evita regalos involuntarios; los administradores pueden autorizar por encima de él.',
      'Archiva las cajas que dejes de usar en lugar de borrarlas: conservan el historial de sus sesiones.'
    ],
    relatedModules: [
      { label: 'Terminal POS', route: '/pos' },
      { label: 'Sesiones de caja', route: '/admin/pos/sessions' },
      { label: 'Almacenes', route: '/admin/warehouses' }
    ],
    relatedArticles: ['pos-registers-create', 'pos-terminal'],
    tags: ['caja', 'registradora', 'pos', 'configuración', 'sucursal']
  },
  {
    id: 'pos-registers-create',
    routePatterns: ['/admin/pos/registers/create'],
    module: 'pos',
    moduleLabel: 'Punto de Venta',
    moduleEmoji: '🧾',
    title: 'Configurar una caja',
    viewType: 'create',
    level: 'intermedio',
    isNew: true,
    summary: 'Almacén de salida, cliente por defecto, límite de descuento, corte ciego y tolerancia: las cinco decisiones de una caja.',
    description: 'Formulario de alta de una caja registradora. Define de dónde sale el inventario, a qué cliente se registran las ventas de mostrador y qué margen de maniobra tiene el cajero.',
    importance: 'Configurar mal el almacén de salida descuadra el inventario de toda una sucursal. Es el campo más crítico del formulario y conviene verificarlo antes de abrir el primer turno.',
    tips: [
      'El almacén de salida debe ser el que físicamente surte a ese mostrador.',
      'El cliente por defecto suele ser un contacto genérico tipo «Público general»; créalo antes en Contactos si aún no existe.',
      'Un límite de descuento entre 5 % y 10 % funciona bien para la mayoría de los mostradores.',
      'El corte ciego oculta al cajero el monto esperado hasta que declara lo contado: úsalo cuando quieras un control más estricto.',
      'La tolerancia debe cubrir el redondeo normal de tu operación, no los faltantes: montos pequeños evitan justificaciones innecesarias.'
    ],
    fields: [
      { label: 'Nombre', required: true, type: 'text', description: 'Identificación de la caja para cajeros y reportes.', tip: 'Incluye la sucursal si tienes varias: «Caja 1 — Centro».' },
      { label: 'Código', required: false, type: 'text', description: 'Clave corta de la caja.', tip: 'Útil para identificarla en tickets y reportes impresos.' },
      { label: 'Descripción', required: false, type: 'textarea', description: 'Notas internas sobre la caja.', tip: 'Anota aquí el equipo o la impresora asignada.' },
      { label: 'Almacén de salida', required: true, type: 'relation', description: 'Almacén del que se descuenta el inventario vendido en esta caja.', tip: 'Verifícalo dos veces: es el campo que más descuadres provoca si se elige mal.' },
      { label: 'Cliente por defecto', required: false, type: 'relation', description: 'Contacto al que se asignan las ventas sin cliente identificado.', tip: 'Usa un contacto genérico de mostrador para no ensuciar tu base de clientes reales.' },
      { label: 'Descuento máximo para cajeros (%)', required: false, type: 'number', description: 'Tope de descuento que un cajero puede aplicar sin autorización.', tip: 'Por encima de este porcentaje el sistema pedirá a un supervisor.' },
      { label: 'Tolerancia de diferencia en corte', required: false, type: 'number', description: 'Diferencia máxima aceptada en el arqueo sin exigir justificación.', tip: 'Un monto pequeño basta: la tolerancia cubre redondeos, no faltantes.' }
    ],
    relatedModules: [
      { label: 'Cajas', route: '/admin/pos/registers' },
      { label: 'Almacenes', route: '/admin/warehouses' },
      { label: 'Contactos', route: '/admin/partners' }
    ],
    relatedArticles: ['pos-registers-list', 'pos-terminal'],
    tags: ['caja', 'crear', 'configurar', 'almacén', 'descuento', 'tolerancia', 'corte ciego']
  },
  {
    id: 'pos-registers-detail',
    routePatterns: ['/admin/pos/registers/:id'],
    module: 'pos',
    moduleLabel: 'Punto de Venta',
    moduleEmoji: '🧾',
    title: 'Detalle de la caja',
    viewType: 'detail',
    level: 'intermedio',
    isNew: true,
    summary: 'Consulta y ajusta la configuración de una caja; los cambios aplican a partir del siguiente turno.',
    description: 'Vista de consulta y edición de una caja registradora, con la opción de archivarla cuando deje de operar.',
    importance: 'Ajustar límites de descuento o tolerancias es parte del control operativo cotidiano; hacerlo aquí evita tener que crear cajas nuevas y perder el historial.',
    tips: [
      'Evita cambiar el almacén de salida con una sesión abierta: espera al cierre del turno para que el inventario quede consistente.',
      'Archivar una caja no borra sus sesiones ni sus ventas: solo deja de ofrecerse al abrir turno.'
    ],
    relatedModules: [
      { label: 'Cajas', route: '/admin/pos/registers' }
    ],
    relatedArticles: ['pos-registers-create'],
    tags: ['caja', 'editar', 'archivar', 'configuración']
  },
  {
    id: 'pos-sessions-list',
    routePatterns: ['/admin/pos/sessions'],
    module: 'pos',
    moduleLabel: 'Punto de Venta',
    moduleEmoji: '🧾',
    title: 'Sesiones de caja',
    viewType: 'list',
    level: 'intermedio',
    isNew: true,
    summary: 'Historial de turnos: quién abrió, con cuánto, cuánto vendió y qué diferencia tuvo al cerrar.',
    description: 'Listado de todos los turnos de caja de tu empresa, abiertos y cerrados, con su fondo inicial, ventas, movimientos de efectivo y el resultado del arqueo.',
    importance: 'Es el libro de control del efectivo del negocio. Revisarlo con regularidad detecta patrones: cajas que siempre cierran con faltante, turnos con demasiadas devoluciones o retiros no justificados.',
    tips: [
      'Revisa las sesiones al menos una vez por semana; las diferencias repetidas casi siempre indican un problema de proceso, no de honestidad.',
      'Una sesión abierta desde hace días suele ser un turno que nadie cerró: pide el corte cuanto antes.',
      'Compara ventas por sesión para identificar tus horas y días fuertes.'
    ],
    relatedModules: [
      { label: 'Cajas', route: '/admin/pos/registers' },
      { label: 'Terminal POS', route: '/pos' }
    ],
    relatedArticles: ['pos-sessions-detail', 'pos-close'],
    tags: ['sesión', 'turno', 'caja', 'historial', 'cortes', 'efectivo']
  },
  {
    id: 'pos-sessions-detail',
    routePatterns: ['/admin/pos/sessions/:id'],
    module: 'pos',
    moduleLabel: 'Punto de Venta',
    moduleEmoji: '🧾',
    title: 'Detalle de la sesión',
    viewType: 'detail',
    level: 'intermedio',
    isNew: true,
    summary: 'El expediente completo de un turno: apertura, ventas, movimientos, devoluciones y arqueo final por método de pago.',
    description: 'Vista con todo lo ocurrido en un turno de caja: quién y cuándo la abrió, el fondo inicial, las ventas realizadas, las entradas y salidas de efectivo, las devoluciones y el resultado del corte por cada método de pago.',
    importance: 'Cuando aparece una diferencia, esta vista es donde se investiga. Reconstruye el turno completo y permite ubicar el movimiento exacto que descuadra.',
    tips: [
      'Empieza por el arqueo por método: una diferencia solo en efectivo apunta a cambio mal dado o retiros sin registrar.',
      'Revisa las devoluciones del turno: son el origen más frecuente de diferencias inesperadas.',
      'El reporte del corte es imprimible: úsalo como respaldo físico al entregar el efectivo.'
    ],
    relatedModules: [
      { label: 'Sesiones de caja', route: '/admin/pos/sessions' },
      { label: 'Órdenes', route: '/admin/orders' }
    ],
    relatedArticles: ['pos-sessions-list', 'pos-close', 'pos-returns'],
    tags: ['sesión', 'detalle', 'arqueo', 'diferencia', 'auditoría', 'turno']
  },
  // ─── COMPLEMENTOS DE VENTAS E INVENTARIO ────────────────────────────────────
  {
    id: 'order-lines-list',
    routePatterns: ['/admin/order-lines'],
    module: 'orders',
    moduleLabel: 'Órdenes',
    moduleEmoji: '📋',
    title: 'Líneas de orden',
    viewType: 'list',
    level: 'intermedio',
    summary: 'Vista transversal de todos los productos vendidos y comprados, sin importar a qué orden pertenecen.',
    description: 'Listado plano de todas las líneas de todas las órdenes de la empresa. Permite analizar el movimiento por producto en lugar de por documento.',
    importance: 'Responde preguntas que la lista de órdenes no puede: cuánto se vendió de un producto en el periodo, a qué precios se ha vendido y qué artículos no se mueven.',
    tips: [
      'Busca por producto para ver todo su historial comercial de un vistazo.',
      'Compara los precios de venta de un mismo producto en distintas órdenes para detectar descuentos excesivos.',
      'Esta vista es de consulta: las líneas se editan desde la orden a la que pertenecen.'
    ],
    relatedModules: [
      { label: 'Órdenes', route: '/admin/orders' },
      { label: 'Productos', route: '/admin/products' }
    ],
    relatedArticles: ['orders-list', 'products-list'],
    tags: ['líneas', 'orden', 'productos', 'análisis', 'ventas', 'consulta']
  },
  {
    id: 'picking-lines-list',
    routePatterns: ['/admin/picking-lines'],
    module: 'pickings',
    moduleLabel: 'Pickings / Movimientos',
    moduleEmoji: '🚚',
    title: 'Líneas de picking',
    viewType: 'list',
    level: 'intermedio',
    summary: 'Trazabilidad por producto: qué se movió, cuándo, desde qué almacén y con qué movimiento.',
    description: 'Listado plano de todas las líneas de movimiento de inventario. Es la vista de trazabilidad: cada entrada y salida de cada producto en un solo lugar.',
    importance: 'Cuando el stock de un producto no cuadra, aquí se reconstruye su historia movimiento por movimiento hasta encontrar la diferencia.',
    tips: [
      'Filtra por producto para auditar su historial completo de entradas y salidas.',
      'Las líneas de movimientos aún no confirmados no han afectado el inventario todavía.',
      'Si el stock no cuadra, compara esta vista con el conteo físico antes de hacer un ajuste.'
    ],
    relatedModules: [
      { label: 'Movimientos', route: '/admin/pickings' },
      { label: 'Productos', route: '/admin/products' },
      { label: 'Almacenes', route: '/admin/warehouses' }
    ],
    relatedArticles: ['pickings-list', 'products-detail'],
    tags: ['líneas', 'picking', 'trazabilidad', 'inventario', 'auditoría', 'stock']
  },
  {
    id: 'public-project',
    routePatterns: ['/public/projects/:id'],
    module: 'projects',
    moduleLabel: 'Proyectos',
    moduleEmoji: '📁',
    title: 'Vista pública de proyecto',
    viewType: 'public',
    level: 'intermedio',
    summary: 'Comparte el avance de un proyecto con tu cliente mediante un enlace, sin darle acceso al panel.',
    description: 'Página pública de seguimiento de un proyecto. Muestra el avance y las tareas al cliente mediante un enlace directo, sin exponer costos ni el resto de la información de tu empresa.',
    importance: 'Sustituye los reportes de avance por correo: el cliente consulta el estado cuando quiere y tú dejas de dedicar tiempo a informar lo mismo varias veces.',
    tips: [
      'Cualquiera con el enlace puede verlo: compártelo solo con las personas del proyecto.',
      'La vista se actualiza sola conforme tu equipo avanza las tareas; no hay que publicar nada.',
      'Redacta los títulos de las tareas pensando en que el cliente los va a leer.',
      'No es el lugar para notas internas ni información de costos.'
    ],
    relatedModules: [
      { label: 'Proyectos', route: '/admin/projects' },
      { label: 'Tareas', route: '/admin/tasks' }
    ],
    relatedArticles: ['projects-detail', 'tasks-list'],
    tags: ['público', 'proyecto', 'compartir', 'cliente', 'seguimiento', 'enlace']
  },
  {
    id: 'approval-categories-form',
    routePatterns: ['/admin/approval-categories/create', '/admin/approval-categories/:id'],
    module: 'approvals',
    moduleLabel: 'Aprobaciones',
    moduleEmoji: '✍️',
    title: 'Crear o editar una categoría',
    viewType: 'create',
    level: 'intermedio',
    summary: 'Las categorías clasifican las solicitudes y determinan quién debe autorizarlas.',
    description: 'Formulario de alta y edición de una categoría de aprobación. La categoría es lo que agrupa las solicitudes por tipo (gastos, vacaciones, compras) y define a qué aprobadores se enruta cada una.',
    importance: 'Sin categorías bien definidas, las solicitudes llegan a la persona equivocada o se quedan sin dueño. Es la pieza que convierte las aprobaciones en un proceso y no en una bandeja de correos.',
    tips: [
      'Crea una categoría por tipo de decisión real, no por departamento: quien autoriza un gasto no siempre es quien autoriza vacaciones.',
      'El código interno sirve para identificarla en reportes: mantenlo corto y estable.',
      'Explica en la descripción qué solicitudes van aquí y cuáles no; es lo que evita categorías duplicadas.',
      'Archiva las categorías que dejes de usar: las solicitudes históricas conservan su clasificación.'
    ],
    fields: [
      { label: 'Nombre de la categoría', required: true, type: 'text', description: 'Etiqueta que verá quien crea una solicitud.', tip: 'Usa el lenguaje de tu equipo: «Gastos de viaje» comunica más que «Categoría 3».' },
      { label: 'Código interno', required: false, type: 'text', description: 'Clave corta para reportes e integraciones.', tip: 'Mayúsculas y sin espacios, por ejemplo GASTOS-VIAJE.' },
      { label: 'Descripción', required: false, type: 'textarea', description: 'Qué solicitudes pertenecen a esta categoría.', tip: 'Incluye ejemplos concretos para que nadie dude al elegirla.' }
    ],
    relatedModules: [
      { label: 'Categorías', route: '/admin/approval-categories' },
      { label: 'Aprobadores', route: '/admin/approval-managers' }
    ],
    relatedArticles: ['approval-categories-list', 'approval-managers-list', 'approval-requests-create'],
    tags: ['aprobación', 'categoría', 'crear', 'clasificar', 'flujo']
  },
  {
    id: 'approval-managers-form',
    routePatterns: ['/admin/approval-managers/create', '/admin/approval-managers/:id'],
    module: 'approvals',
    moduleLabel: 'Aprobaciones',
    moduleEmoji: '✍️',
    title: 'Asignar un aprobador',
    viewType: 'create',
    level: 'intermedio',
    summary: 'El aprobador es quien puede autorizar o rechazar las solicitudes que le llegan.',
    description: 'Formulario para designar a un miembro del equipo como aprobador. Define quién recibe las solicitudes pendientes y puede resolverlas.',
    importance: 'Una cadena de aprobación sin responsables designados deja las solicitudes congeladas. Asignar aprobadores es lo que hace que el flujo avance.',
    tips: [
      'Designa siempre al menos dos aprobadores por área: uno solo se convierte en cuello de botella cuando sale de vacaciones.',
      'La persona debe ser primero miembro del equipo; invítala desde Equipo si aún no aparece en la lista.',
      'Usa las notas del rol para dejar claro su alcance: qué monto o qué tipo de solicitudes le corresponden.',
      'Revisa la lista de aprobadores cuando alguien cambie de puesto o deje la empresa.'
    ],
    fields: [
      { label: 'Miembro del equipo', required: true, type: 'relation', description: 'Persona que tendrá la facultad de aprobar.', tip: 'Si no aparece, primero invítala desde el módulo Equipo.' },
      { label: 'Notas del rol', required: false, type: 'textarea', description: 'Alcance y límites de esta persona como aprobador.', tip: 'Anota montos máximos o categorías que le corresponden.' }
    ],
    relatedModules: [
      { label: 'Aprobadores', route: '/admin/approval-managers' },
      { label: 'Equipo', route: '/admin/team' }
    ],
    relatedArticles: ['approval-managers-list', 'approval-categories-form', 'team-list'],
    tags: ['aprobador', 'autorizar', 'rol', 'permiso', 'equipo']
  },
  {
    id: 'crm-stages-form',
    routePatterns: ['/admin/crm/stages/create', '/admin/crm/stages/:id'],
    module: 'crm',
    moduleLabel: 'CRM',
    moduleEmoji: '📊',
    title: 'Crear o editar una etapa',
    viewType: 'create',
    level: 'intermedio',
    summary: 'Las etapas son las fases por las que pasa una oportunidad hasta cerrarse.',
    description: 'Formulario de alta y edición de una etapa del pipeline. Cada etapa representa una fase real de tu proceso comercial y su orden define el avance del embudo.',
    importance: 'El pipeline solo sirve como termómetro del negocio si las etapas reflejan tu proceso real. Etapas mal definidas hacen que todas las oportunidades se acumulen en una sola columna.',
    tips: [
      'Entre cinco y siete etapas es lo ideal: menos no distingue nada y más vuelve el tablero inmanejable.',
      'Nombra las etapas por el hecho verificable que las cierra («Cotización enviada»), no por un sentimiento («Interesado»).',
      'El orden define la posición en el tablero: numera de 10 en 10 para poder insertar etapas nuevas después.',
      'No borres etapas con oportunidades activas: muévelas primero para no perder el historial.'
    ],
    fields: [
      { label: 'Nombre de la etapa', required: true, type: 'text', description: 'Fase del proceso comercial que representa.', tip: 'Descríbela con un hecho concreto y verificable.' },
      { label: 'Orden / posición', required: true, type: 'number', description: 'Lugar de la etapa dentro del embudo, de menor a mayor.', tip: 'Numera de 10 en 10 para insertar etapas intermedias sin renumerar todo.' }
    ],
    relatedModules: [
      { label: 'Pipeline', route: '/admin/crm/stages' },
      { label: 'Leads', route: '/admin/crm/leads' }
    ],
    relatedArticles: ['crm-stages-list', 'crm-leads-create'],
    tags: ['etapa', 'pipeline', 'embudo', 'crm', 'proceso', 'venta']
  },
  // ─── AYUDA Y ASISTENTE ───────────────────────────────────────────────────────
  {
    id: 'bit-assistant',
    routePatterns: [],
    module: 'core',
    moduleLabel: 'General',
    moduleEmoji: '🏠',
    title: 'Bit, tu asistente',
    viewType: 'config',
    level: 'basico',
    isNew: true,
    summary: 'Bit es el asistente de Flowbit: sabe en qué vista estás y te explica qué hacer sin salir de tu trabajo.',
    description: 'Bit vive en el botón flotante de la esquina inferior derecha del panel. Reconoce la vista en la que estás y responde con la explicación, los campos, los consejos o la guía paso a paso que corresponden a ese momento.',
    importance: 'Buscar ayuda normalmente implica abandonar lo que estabas haciendo. Bit invierte eso: la documentación llega a la pantalla donde tienes la duda, en el momento exacto en que la tienes.',
    tips: [
      'Abre Bit con el botón flotante o pulsando la tecla ? cuando no estés escribiendo en un campo.',
      'Pregúntale «¿qué hago aquí?» y responderá con la explicación de la vista actual.',
      'Pide «guíame» y abrirá la guía paso a paso de esa vista, si existe, con su progreso guardado.',
      'Escribe cualquier término (cupón, corte, picking, Stripe) y Bit buscará en toda la documentación.',
      'Desde Bit puedes compartir la guía de la vista actual o abrirla completa en el manual.',
      'Cierra Bit con Escape; recuerda dónde te quedaste en cada guía aunque cambies de pantalla.'
    ],
    process: [
      { step: 1, title: 'Detecta', description: 'Bit reconoce tu vista actual.' },
      { step: 2, title: 'Explica', description: 'Responde qué es y para qué sirve.' },
      { step: 3, title: 'Guía', description: 'Abre el paso a paso interactivo.' },
      { step: 4, title: 'Amplía', description: 'Te lleva al manual completo.' },
      { step: 5, title: 'Comparte', description: 'Envías la solución a quien la necesita.' }
    ],
    faqs: [
      {
        question: '¿Bit envía mis datos a algún servicio externo?',
        answer: 'No. Bit responde con la documentación incluida en la propia plataforma; no consulta servicios externos ni comparte información de tu empresa.'
      },
      {
        question: '¿Por qué Bit dice que no hay documentación de esta vista?',
        answer: 'Porque esa pantalla todavía no tiene artículo asociado. Usa el buscador de Bit o abre el manual completo mientras se agrega.'
      },
      {
        question: '¿Puedo ocultar a Bit?',
        answer: 'Puedes cerrarlo en cualquier momento con Escape o con la X. El botón flotante permanece disponible para cuando lo necesites.'
      }
    ],
    relatedModules: [
      { label: 'Manual', route: '/manual' }
    ],
    relatedArticles: ['manual', 'manual-sharing', 'getting-started'],
    tags: ['bit', 'asistente', 'ayuda', 'soporte', 'chat', 'guía', 'contextual']
  },
  {
    id: 'manual-sharing',
    routePatterns: [],
    module: 'core',
    moduleLabel: 'General',
    moduleEmoji: '🏠',
    title: 'Compartir la documentación',
    viewType: 'config',
    level: 'basico',
    isNew: true,
    summary: 'Cualquier guía, consejo o paso del manual se copia o se comparte como enlace público listo para redes sociales.',
    description: 'Cada artículo del manual, y cada sección dentro de él, tiene botones para copiar el contenido o compartirlo. Los enlaces apuntan a la documentación pública, así que quien los recibe puede leerlos sin tener cuenta en Flowbit.',
    importance: 'Convierte tu manual interno en material de soporte y de difusión: resolver la duda de un compañero, capacitar a alguien nuevo o publicar un tip útil pasa a ser cuestión de dos clics.',
    tips: [
      'Usa «Copiar» para pegar la guía en un chat interno; conserva el formato de lista para que se lea bien.',
      'Usa «Compartir» para generar el enlace público del artículo, que se abre sin iniciar sesión.',
      'Cada sección (consejos, campos, preguntas frecuentes, cada paso de una guía) puede compartirse por separado: ideal para responder una duda concreta.',
      'La tarjeta descargable convierte una guía en una imagen lista para publicar en redes sociales.',
      'Los enlaces compartidos incluyen título y descripción, así que se ven bien al pegarlos en WhatsApp, X o LinkedIn.',
      'La documentación pública no expone ningún dato de tu empresa: explica cómo funciona la plataforma, no lo que hay dentro de tu cuenta.'
    ],
    process: [
      { step: 1, title: 'Elige', description: 'Artículo o sección concreta.' },
      { step: 2, title: 'Copia', description: 'Texto listo para pegar.' },
      { step: 3, title: 'Comparte', description: 'Enlace público o red social.' },
      { step: 4, title: 'Publica', description: 'Tarjeta de imagen para redes.' }
    ],
    faqs: [
      {
        question: '¿Quién puede ver un enlace que comparto?',
        answer: 'Cualquier persona con el enlace. La documentación pública es contenido genérico del producto y no incluye información de tu empresa ni de tus clientes.'
      },
      {
        question: '¿Puedo compartir solo un consejo y no el artículo completo?',
        answer: 'Sí. Pasa el cursor sobre cualquier sección y usa su botón de copiar o compartir: el enlace abrirá el artículo directamente en esa sección.'
      }
    ],
    relatedModules: [
      { label: 'Manual', route: '/manual' }
    ],
    relatedArticles: ['manual', 'bit-assistant'],
    tags: ['compartir', 'copiar', 'enlace', 'redes sociales', 'publicar', 'soporte', 'difusión']
  }
]
