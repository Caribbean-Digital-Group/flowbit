import { describe, expect, it } from 'vitest'
import {
  buildOnboardingProgress,
  hasText,
  onboardingDismissKey,
  type OnboardingSignals
} from '../../app/utils/onboarding'

const emptySignals: OnboardingSignals = {
  hasLegalName: false,
  hasTaxId: false,
  productCount: 0,
  paymentMethodCount: 0,
  teamMemberCount: 1,
  saleOrderCount: 0
}

const doneIds = (signals: OnboardingSignals) =>
  buildOnboardingProgress(signals).steps.filter((s) => s.done).map((s) => s.id)

describe('buildOnboardingProgress', () => {
  it('una empresa recién creada no tiene pasos completos', () => {
    const progress = buildOnboardingProgress(emptySignals)
    expect(progress.completed).toBe(0)
    expect(progress.total).toBe(5)
    expect(progress.percent).toBe(0)
    expect(progress.isComplete).toBe(false)
    expect(progress.nextStepId).toBe('company')
  })

  it('los datos fiscales requieren razón social y RFC', () => {
    expect(doneIds({ ...emptySignals, hasLegalName: true })).not.toContain('company')
    expect(doneIds({ ...emptySignals, hasTaxId: true })).not.toContain('company')
    expect(doneIds({ ...emptySignals, hasLegalName: true, hasTaxId: true })).toContain('company')
  })

  it('el equipo cuenta como completo solo con una segunda persona', () => {
    expect(doneIds({ ...emptySignals, teamMemberCount: 1 })).not.toContain('team')
    expect(doneIds({ ...emptySignals, teamMemberCount: 2 })).toContain('team')
  })

  it('marca producto, método de pago y venta con al menos un registro', () => {
    const ids = doneIds({ ...emptySignals, productCount: 3, paymentMethodCount: 1, saleOrderCount: 1 })
    expect(ids).toEqual(['product', 'payment_method', 'first_sale'])
  })

  it('el siguiente paso es el primero pendiente en orden', () => {
    const progress = buildOnboardingProgress({ ...emptySignals, hasLegalName: true, hasTaxId: true, productCount: 1 })
    expect(progress.nextStepId).toBe('payment_method')
    expect(progress.percent).toBe(40)
  })

  it('completa al 100 % cuando todo está hecho', () => {
    const progress = buildOnboardingProgress({
      hasLegalName: true,
      hasTaxId: true,
      productCount: 1,
      paymentMethodCount: 1,
      teamMemberCount: 2,
      saleOrderCount: 1
    })
    expect(progress.isComplete).toBe(true)
    expect(progress.percent).toBe(100)
    expect(progress.nextStepId).toBeNull()
  })

  it('cada paso enlaza a una ruta del panel y a una guía del manual', () => {
    for (const step of buildOnboardingProgress(emptySignals).steps) {
      expect(step.to.startsWith('/admin')).toBe(true)
      expect(step.manualHref.startsWith('/manual/')).toBe(true)
    }
  })
})

describe('hasText', () => {
  it('descarta nulos, vacíos y espacios', () => {
    expect(hasText(null)).toBe(false)
    expect(hasText(undefined)).toBe(false)
    expect(hasText('   ')).toBe(false)
    expect(hasText('XAXX010101000')).toBe(true)
  })
})

describe('onboardingDismissKey', () => {
  it('es distinta por empresa', () => {
    expect(onboardingDismissKey('a')).not.toBe(onboardingDismissKey('b'))
    expect(onboardingDismissKey('a')).toBe('flowbit:onboarding-dismissed:a')
  })
})
