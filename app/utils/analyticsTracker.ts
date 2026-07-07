import type {
  AnalyticsConsent,
  AnalyticsEventName,
  AnalyticsEcommerceEventName,
  AnalyticsEcommercePayload,
  AnalyticsProperties,
  AnalyticsWireEvent
} from '~/utils/analytics'

/**
 * Tracker first-party del storefront (solo cliente).
 *
 * Responsable de TODO el transporte: identidad (anonymous_id/session_id),
 * consentimiento, batching, cola offline persistida y reintentos. La UI y
 * el store de Pinia solo llaman a la fachada (useStorefrontTracker) — nunca
 * hablan con el endpoint directamente.
 *
 * Garantías:
 * - No captura ni envía nada sin consentimiento explícito.
 * - Nunca lanza: cualquier fallo se ignora (la analítica no rompe la compra).
 * - Usa sendBeacon al ocultarse la pestaña para no perder el último lote.
 */

const CONSENT_PREFIX = 'flowbit:sf-consent:'
const ANON_PREFIX = 'flowbit:sf-aid:'
const SESSION_PREFIX = 'flowbit:sf-session:'
const QUEUE_PREFIX = 'flowbit:sf-queue:'

const SESSION_TIMEOUT_MS = 30 * 60 * 1000
const FLUSH_INTERVAL_MS = 5000
const BATCH_SIZE = 20
const QUEUE_LIMIT = 200
const INGEST_ENDPOINT = '/api/storefront/analytics'

const randomId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`

const readStorage = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

const writeStorage = (key: string, value: string | null): void => {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // quota / modo privado: seguir en memoria
  }
}

interface SessionState {
  id: string
  lastActive: number
}

class StorefrontAnalyticsTracker {
  private slug: string | null = null
  private consent: AnalyticsConsent = 'unknown'
  private userId: string | null = null
  private queue: AnalyticsWireEvent[] = []
  private flushTimer: ReturnType<typeof setInterval> | null = null
  private isSending = false
  private lifecycleBound = false
  private consentListeners: ((state: AnalyticsConsent) => void)[] = []

  /** UTM de la landing actual (se capturan una vez por carga de página). */
  private utm: { source: string | null; medium: string | null; campaign: string | null } = {
    source: null,
    medium: null,
    campaign: null
  }
  private initialReferrer: string | null = null

  private get isClient(): boolean {
    return typeof window !== 'undefined'
  }

  /** Configura el tracker para la tienda actual. Idempotente por slug. */
  configure(slug: string): void {
    if (!this.isClient || !slug || this.slug === slug) return
    this.slug = slug
    this.consent = (readStorage(CONSENT_PREFIX + slug) as AnalyticsConsent) || 'unknown'
    this.userId = null
    this.queue = []

    const search = new URLSearchParams(window.location.search)
    this.utm = {
      source: search.get('utm_source'),
      medium: search.get('utm_medium'),
      campaign: search.get('utm_campaign')
    }
    this.initialReferrer = document.referrer || null

    if (this.consent === 'granted') this.restoreQueue()
    this.bindLifecycle()
    this.notifyConsent()
  }

  getConsent(): AnalyticsConsent {
    return this.consent
  }

  /** Suscripción a cambios de consentimiento (para la fachada reactiva). */
  onConsentChange(listener: (state: AnalyticsConsent) => void): void {
    this.consentListeners.push(listener)
  }

  setConsent(state: Exclude<AnalyticsConsent, 'unknown'>): void {
    if (!this.isClient || !this.slug) return
    this.consent = state
    writeStorage(CONSENT_PREFIX + this.slug, state)

    if (state === 'denied') {
      // Borrar identidad y todo lo pendiente: no queda rastro del visitante
      this.queue = []
      writeStorage(QUEUE_PREFIX + this.slug, null)
      writeStorage(ANON_PREFIX + this.slug, null)
      writeStorage(SESSION_PREFIX + this.slug, null)
    }
    this.notifyConsent()
  }

  /** Vincula el usuario autenticado (sin traits con PII). */
  identify(userId: string | null): void {
    this.userId = userId
  }

  trackPageView(path?: string, properties?: AnalyticsProperties): void {
    this.enqueue('page_view', {
      path: path ?? (this.isClient ? window.location.pathname : ''),
      properties
    })
  }

  trackEvent(
    name: Exclude<AnalyticsEventName, 'page_view'>,
    properties?: AnalyticsProperties
  ): void {
    this.enqueue(name, { properties })
  }

  trackEcommerce(name: AnalyticsEcommerceEventName, payload: AnalyticsEcommercePayload = {}): void {
    this.enqueue(name, {
      value: payload.value,
      currency: payload.currency,
      items: payload.items,
      checkoutToken: payload.checkoutToken,
      properties: payload.properties
    })
  }

  // ── Interno ────────────────────────────────────────────────────────

  private notifyConsent(): void {
    for (const listener of this.consentListeners) listener(this.consent)
  }

  private anonymousId(): string {
    const key = ANON_PREFIX + this.slug
    let id = readStorage(key)
    if (!id) {
      id = randomId()
      writeStorage(key, id)
    }
    return id
  }

  /** Sesión con rotación por inactividad (~30 min). */
  private sessionId(): string {
    const key = SESSION_PREFIX + this.slug
    const now = Date.now()
    let session: SessionState | null = null
    try {
      session = JSON.parse(readStorage(key) ?? 'null')
    } catch {
      session = null
    }
    if (!session?.id || now - session.lastActive > SESSION_TIMEOUT_MS) {
      session = { id: randomId(), lastActive: now }
    } else {
      session.lastActive = now
    }
    writeStorage(key, JSON.stringify(session))
    return session.id
  }

  private enqueue(
    name: AnalyticsEventName,
    data: {
      path?: string
      value?: number
      currency?: string
      items?: AnalyticsWireEvent['items']
      checkoutToken?: string | null
      properties?: AnalyticsProperties
    }
  ): void {
    // Sin consentimiento no se captura nada (ni siquiera en memoria)
    if (!this.isClient || !this.slug || this.consent !== 'granted') return

    try {
      const event: AnalyticsWireEvent = {
        id: randomId(),
        name,
        ts: new Date().toISOString(),
        anonymous_id: this.anonymousId(),
        session_id: this.sessionId(),
        user_id: this.userId,
        path: data.path ?? window.location.pathname,
        title: document.title || null,
        referrer: this.initialReferrer,
        utm_source: this.utm.source,
        utm_medium: this.utm.medium,
        utm_campaign: this.utm.campaign,
        language: navigator.language || null,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        value: data.value ?? null,
        currency: data.currency ?? null,
        items: data.items ?? null,
        checkout_token: data.checkoutToken ?? null,
        properties: data.properties
      }

      this.queue.push(event)
      if (this.queue.length > QUEUE_LIMIT) this.queue = this.queue.slice(-QUEUE_LIMIT)
      this.persistQueue()

      if (this.queue.length >= BATCH_SIZE) void this.flush()
    } catch {
      // nunca romper el storefront por analítica
    }
  }

  private persistQueue(): void {
    if (!this.slug) return
    writeStorage(QUEUE_PREFIX + this.slug, this.queue.length ? JSON.stringify(this.queue) : null)
  }

  /** Recupera eventos que quedaron pendientes en una visita anterior. */
  private restoreQueue(): void {
    if (!this.slug) return
    try {
      const pending = JSON.parse(readStorage(QUEUE_PREFIX + this.slug) ?? '[]')
      if (Array.isArray(pending) && pending.length) {
        this.queue = pending.slice(-QUEUE_LIMIT)
        void this.flush()
      }
    } catch {
      writeStorage(QUEUE_PREFIX + this.slug, null)
    }
  }

  private bindLifecycle(): void {
    if (this.lifecycleBound || !this.isClient) return
    this.lifecycleBound = true

    this.flushTimer = setInterval(() => {
      void this.flush()
    }, FLUSH_INTERVAL_MS)

    // Último lote al ocultar/cerrar la pestaña, sin bloquear la descarga
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush(true)
    })
    window.addEventListener('pagehide', () => this.flush(true))

    // Al recuperar conexión, reenviar lo pendiente
    window.addEventListener('online', () => {
      void this.flush()
    })
  }

  private flush(useBeacon = false): void {
    if (!this.slug || !this.queue.length || this.consent !== 'granted') return
    if (this.isSending && !useBeacon) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false && !useBeacon) return

    const batch = this.queue.slice(0, BATCH_SIZE)
    const payload = JSON.stringify({ slug: this.slug, events: batch })

    if (useBeacon && typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      // sendBeacon no confirma entrega: se asume enviado (el servidor
      // deduplica por id si además quedó persistido y se reenvía luego)
      const ok = navigator.sendBeacon(INGEST_ENDPOINT, new Blob([payload], { type: 'application/json' }))
      if (ok) {
        this.queue = this.queue.slice(batch.length)
        this.persistQueue()
      }
      return
    }

    this.isSending = true
    fetch(INGEST_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true
    })
      .then((response) => {
        if (response.ok) {
          this.queue = this.queue.slice(batch.length)
          this.persistQueue()
          // Si quedó más de un lote acumulado, drenar en cadena
          if (this.queue.length >= BATCH_SIZE) {
            setTimeout(() => void this.flush(), 250)
          }
        }
        // En error HTTP (rate limit, 5xx) los eventos quedan en cola y se
        // reintentan en el siguiente ciclo del timer
      })
      .catch(() => {
        // offline / red caída: la cola persiste y se reintenta
      })
      .finally(() => {
        this.isSending = false
      })
  }
}

/** Singleton del tracker (una tienda activa a la vez por pestaña). */
export const storefrontTracker = new StorefrontAnalyticsTracker()
