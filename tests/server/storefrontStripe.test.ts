import { describe, expect, it } from 'vitest'
import {
  classifyMarkPaidResult,
  fromStripeAmount,
  toStripeAmount
} from '../../server/utils/storefrontStripe'

describe('classifyMarkPaidResult', () => {
  it('registra el pago cuando el RPC responde ok', () => {
    expect(classifyMarkPaidResult({ status: 'ok', payment_status: 'paid' })).toBe('paid')
    expect(classifyMarkPaidResult({ status: 'ok', already_paid: true })).toBe('paid')
  })

  it('ignora (sin reintento) una orden de otra empresa o inexistente', () => {
    // Desde TRY-71 el RPC exige la empresa: una orden ajena llega como not_found
    expect(classifyMarkPaidResult({ status: 'not_found' })).toBe('ignore')
  })

  it('pide reintento ante errores o falta de respuesta', () => {
    expect(classifyMarkPaidResult({ status: 'error', code: 'currency_mismatch' })).toBe('retry')
    expect(classifyMarkPaidResult(null)).toBe('retry')
    expect(classifyMarkPaidResult(undefined)).toBe('retry')
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
