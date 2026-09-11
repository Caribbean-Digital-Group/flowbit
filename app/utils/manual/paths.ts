import type { LearningPath, ModuleMeta } from './types'

/**
 * Orden, etiqueta y color canónicos de cada módulo de la documentación.
 * El orden de este arreglo es el orden del menú del manual.
 */
export const MODULE_META: ModuleMeta[] = [
  {
    id: 'core',
    label: 'Primeros pasos',
    emoji: '🏠',
    description: 'Arranque, dashboard, agenda, perfil y configuración de la empresa.',
    accent: 'indigo'
  },
  {
    id: 'partners',
    label: 'Contactos',
    emoji: '👥',
    description: 'Clientes, proveedores y empleados: la base de datos de personas y empresas.',
    accent: 'sky'
  },
  {
    id: 'crm',
    label: 'CRM',
    emoji: '📊',
    description: 'Oportunidades de venta, etapas del pipeline y seguimiento comercial.',
    accent: 'sky'
  },
  {
    id: 'orders',
    label: 'Ventas y compras',
    emoji: '🛒',
    description: 'Órdenes de venta y compra, líneas y métodos de pago.',
    accent: 'emerald'
  },
  {
    id: 'storefront',
    label: 'Tienda en línea',
    emoji: '🛍️',
    description: 'Tu canal de venta en internet: catálogo, envíos, cupones, pagos y analítica.',
    accent: 'violet'
  },
  {
    id: 'pos',
    label: 'Punto de venta',
    emoji: '🧾',
    description: 'Cobro en mostrador, cajas, turnos, devoluciones y cortes.',
    accent: 'fuchsia'
  },
  {
    id: 'products',
    label: 'Productos',
    emoji: '📦',
    description: 'Catálogo de bienes y servicios, precios y datos de inventario.',
    accent: 'orange'
  },
  {
    id: 'warehouses',
    label: 'Almacenes',
    emoji: '🏭',
    description: 'Ubicaciones físicas donde vive tu inventario.',
    accent: 'orange'
  },
  {
    id: 'pickings',
    label: 'Movimientos',
    emoji: '🚚',
    description: 'Entradas y salidas de inventario, escaneo y trazabilidad.',
    accent: 'orange'
  },
  {
    id: 'projects',
    label: 'Proyectos',
    emoji: '📁',
    description: 'Planeación, avance y seguimiento de proyectos con tus clientes.',
    accent: 'violet'
  },
  {
    id: 'tasks',
    label: 'Tareas',
    emoji: '✅',
    description: 'El trabajo del día a día del equipo dentro de cada proyecto.',
    accent: 'violet'
  },
  {
    id: 'approvals',
    label: 'Aprobaciones',
    emoji: '✍️',
    description: 'Solicitudes internas, categorías y cadena de aprobadores.',
    accent: 'amber'
  },
  {
    id: 'team',
    label: 'Equipo',
    emoji: '👨‍💼',
    description: 'Miembros, roles e invitaciones a tu empresa.',
    accent: 'slate'
  }
]

/**
 * Rutas de aprendizaje: secuencias curadas de artículos que resuelven un
 * objetivo de negocio completo, aunque crucen varios módulos.
 */
export const LEARNING_PATHS: LearningPath[] = [
  {
    id: 'path-onboarding',
    title: 'Arranca tu empresa en Flowbit',
    emoji: '🚀',
    description: 'Lo mínimo para pasar de una cuenta vacía a operar de verdad: empresa, contactos, catálogo y equipo.',
    estimatedMinutes: 20,
    level: 'basico',
    accent: 'indigo',
    articleIds: ['getting-started', 'settings', 'partners-create', 'products-create', 'warehouses-create', 'team-list']
  },
  {
    id: 'path-sell-online',
    title: 'Vende en línea',
    emoji: '🛍️',
    description: 'Abre tu tienda, define envíos y cupones, cobra con tarjeta y mide los resultados.',
    estimatedMinutes: 45,
    level: 'intermedio',
    accent: 'violet',
    articleIds: ['storefront-settings', 'storefront-design', 'storefront-shipping-create', 'storefront-coupons-create', 'storefront-stripe', 'storefront-fulfillment', 'storefront-analytics']
  },
  {
    id: 'path-pos',
    title: 'Abre tu punto de venta',
    emoji: '🧾',
    description: 'Configura la caja, aprende los atajos del mostrador y cierra el turno cuadrado.',
    estimatedMinutes: 25,
    level: 'basico',
    accent: 'fuchsia',
    articleIds: ['pos-registers-create', 'pos-terminal', 'pos-returns', 'pos-close', 'pos-sessions-list']
  },
  {
    id: 'path-order-to-delivery',
    title: 'Del prospecto a la entrega',
    emoji: '🔄',
    description: 'El flujo comercial completo: lead, contacto, orden de venta, picking y entrega.',
    estimatedMinutes: 30,
    level: 'intermedio',
    accent: 'emerald',
    articleIds: ['crm-leads-create', 'partners-create', 'orders-create', 'orders-detail', 'pickings-detail', 'pickings-scan']
  },
  {
    id: 'path-inventory',
    title: 'Controla tu inventario',
    emoji: '📦',
    description: 'Catálogo, almacenes, movimientos y trazabilidad para que el stock del sistema sea el real.',
    estimatedMinutes: 25,
    level: 'intermedio',
    accent: 'orange',
    articleIds: ['products-create', 'warehouses-create', 'pickings-list', 'pickings-scan', 'picking-lines-list']
  },
  {
    id: 'path-team',
    title: 'Coordina a tu equipo',
    emoji: '👨‍💼',
    description: 'Invita personas, reparte tareas por proyecto y ordena las decisiones con aprobaciones.',
    estimatedMinutes: 20,
    level: 'basico',
    accent: 'slate',
    articleIds: ['team-list', 'invitations', 'projects-create', 'tasks-list', 'approval-requests-create']
  }
]
