export interface DocField {
  label: string
  required: boolean
  type: 'text' | 'select' | 'date' | 'number' | 'textarea' | 'boolean' | 'relation'
  description: string
  tip?: string
}

export interface ProcessStep {
  step: number
  title: string
  description: string
}

export interface DocArticle {
  id: string
  routePatterns: string[]
  module: string
  moduleLabel: string
  moduleEmoji: string
  title: string
  description: string
  importance: string
  viewType: 'list' | 'create' | 'detail' | 'scan' | 'dashboard' | 'config' | 'team'
  tips: string[]
  fields?: DocField[]
  process?: ProcessStep[]
  relatedModules?: { label: string; route: string }[]
  tags?: string[]
}

export interface DocModule {
  id: string
  label: string
  emoji: string
  articles: DocArticle[]
}

const ARTICLES: DocArticle[] = [
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
    routePatterns: ['/admin/manual'],
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
  }
]

function matchRoutePattern(path: string, pattern: string): number {
  const regexStr = '^' + pattern.replace(/:[^/]+/g, '[^/]+') + '/?$'
  const regex = new RegExp(regexStr)
  if (regex.test(path)) {
    return pattern.length
  }
  return -1
}

export const useManual = () => {
  const getContextForRoute = (path: string): DocArticle | undefined => {
    let bestMatch: DocArticle | undefined
    let bestScore = -1
    for (const article of ARTICLES) {
      for (const pattern of article.routePatterns) {
        const score = matchRoutePattern(path, pattern)
        if (score > bestScore) {
          bestScore = score
          bestMatch = article
        }
      }
    }
    return bestMatch
  }

  const searchArticles = (query: string): DocArticle[] => {
    if (!query.trim()) return ARTICLES
    const q = query.toLowerCase()
    return ARTICLES.filter(a =>
      a.title.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.importance.toLowerCase().includes(q) ||
      a.tips.some(t => t.toLowerCase().includes(q)) ||
      a.fields?.some(f => f.label.toLowerCase().includes(q) || f.description.toLowerCase().includes(q)) ||
      a.tags?.some(t => t.toLowerCase().includes(q))
    )
  }

  const modules = computed((): DocModule[] => {
    const moduleMap = new Map<string, DocModule>()
    for (const article of ARTICLES) {
      if (!moduleMap.has(article.module)) {
        moduleMap.set(article.module, {
          id: article.module,
          label: article.moduleLabel,
          emoji: article.moduleEmoji,
          articles: []
        })
      }
      moduleMap.get(article.module)!.articles.push(article)
    }
    return [...moduleMap.values()]
  })

  return { articles: ARTICLES, getContextForRoute, searchArticles, modules }
}
