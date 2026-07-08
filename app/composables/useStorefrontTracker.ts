import { storefrontTracker } from '~/utils/analyticsTracker'
import type {
  AnalyticsConsent,
  AnalyticsEventName,
  AnalyticsEcommerceEventName,
  AnalyticsEcommercePayload,
  AnalyticsProperties
} from '~/utils/analytics'

/**
 * Fachada única de analítica del storefront público.
 *
 * Envuelve el singleton del tracker (utils/analyticsTracker.ts) y expone
 * el estado de consentimiento de forma reactiva para el banner de cookies
 * y el layout. En SSR todos los métodos son no-op.
 */
export const useStorefrontTracker = () => {
  const consent = useState<AnalyticsConsent>('storefront-analytics-consent', () => 'unknown')

  const configure = (slug: string): void => {
    if (import.meta.server) return
    storefrontTracker.onConsentChange((state) => {
      consent.value = state
    })
    storefrontTracker.configure(slug)
  }

  const setConsent = (state: Exclude<AnalyticsConsent, 'unknown'>): void => {
    if (import.meta.server) return
    storefrontTracker.setConsent(state)
  }

  const identify = (userId: string | null): void => {
    if (import.meta.server) return
    storefrontTracker.identify(userId)
  }

  const trackPageView = (path?: string, properties?: AnalyticsProperties): void => {
    if (import.meta.server) return
    storefrontTracker.trackPageView(path, properties)
  }

  const trackEvent = (
    name: Exclude<AnalyticsEventName, 'page_view'>,
    properties?: AnalyticsProperties
  ): void => {
    if (import.meta.server) return
    storefrontTracker.trackEvent(name, properties)
  }

  const trackEcommerce = (
    name: AnalyticsEcommerceEventName,
    payload: AnalyticsEcommercePayload = {}
  ): void => {
    if (import.meta.server) return
    storefrontTracker.trackEcommerce(name, payload)
  }

  return {
    consent,
    configure,
    setConsent,
    identify,
    trackPageView,
    trackEvent,
    trackEcommerce
  }
}
