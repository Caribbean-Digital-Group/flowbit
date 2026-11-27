import { describe, expect, it } from 'vitest'
import {
  fromStripeAmount,
  isOrderOwnedByStore,
  toStripeAmount
} from '../../server/utils/storefrontStripe'

const STORE_A = '11111111-1111-4111-8111-111111111111'
const STORE_B = '22222222-2222-4222-8222-222222222222'

describe('isOrderOwnedByStore', () => {
  it('acepta una orden de la misma empresa que firmó el evento', () => {
    expect(isOrderOwnedByStore({ company_id: STORE_A }, STORE_A)).toBe(true)
  })

  it('rechaza una orden de otra empresa (evento forjado con el secret propio)', () => {
    expect(isOrderOwnedByStore({ company_id: STORE_B }, STORE_A)).toBe(false)
  })

  it('rechaza cuando la orden no existe o no es del storefront', () => {
    expect(isOrderOwnedByStore(null, STORE_A)).toBe(false)
    expect(isOrderOwnedByStore(undefined, STORE_A)).toBe(false)
  })

  it('rechaza cuando no se conoce la empresa de la tienda', () => {
    expect(isOrderOwnedByStore({ company_id: STORE_A }, undefined)).toBe(false)
    expect(isOrderOwnedByStore({ company_id: STORE_A }, '')).toBe(false)
  })

  it('rechaza una orden sin empresa', () => {
    expect(isOrderOwnedByStore({ company_id: '' }, '')).toBe(false)
  })
})

describe('montos de Stripe', () => {
  it('convierte a centavos y de regreso en monedas con decimales', () => {
    expect(toStripeAmount(199.99, 'MXN')).toBe(19999)
    expect(fromStripeAmount(19999, 'mxn')).toBe(199.99)
  })

  it('no multiplica en monedas sin decimales', () => {
    expect(toStripeAmount(1500, 'JPY')).toBe(1500)
    expect(fromStripeAmount(1500, 'jpy')).toBe(1500)
  })
})
