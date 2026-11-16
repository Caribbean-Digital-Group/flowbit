import { describe, expect, it } from 'vitest'
import {
  agingBucket,
  bucketBalances,
  bucketShare,
  buildStatement,
  daysOverdue,
  filterAgingPartners,
  overdueAmount,
  resolveDueDate,
  statementTotals,
  type AgingPartnerRow,
  type StatementEntry
} from '../../app/utils/receivables'

describe('resolveDueDate', () => {
  it('prefers payment_due_date, then confirmation_date, then order_date', () => {
    expect(resolveDueDate({ payment_due_date: '2026-12-01', confirmation_date: '2026-11-02T10:00:00Z', order_date: '2026-11-01' })).toBe('2026-12-01')
    expect(resolveDueDate({ payment_due_date: null, confirmation_date: '2026-11-02T10:00:00Z', order_date: '2026-11-01' })).toBe('2026-11-02')
    expect(resolveDueDate({ order_date: '2026-11-01' })).toBe('2026-11-01')
  })

  it('returns null when no valid date exists', () => {
    expect(resolveDueDate({ payment_due_date: 'garbage', order_date: null })).toBeNull()
  })
})

describe('daysOverdue', () => {
  it('counts calendar days between due date and cut-off date', () => {
    expect(daysOverdue('2026-11-01', '2026-11-16')).toBe(15)
    expect(daysOverdue('2026-11-16', '2026-11-16')).toBe(0)
    expect(daysOverdue('2026-12-01', '2026-11-16')).toBe(-15)
  })

  it('crosses month and leap-year boundaries correctly', () => {
    expect(daysOverdue('2028-02-28', '2028-03-01')).toBe(2)
    expect(daysOverdue('2026-12-31', '2027-01-01')).toBe(1)
  })

  it('ignores the time part of ISO timestamps', () => {
    expect(daysOverdue('2026-11-01T23:59:00Z', '2026-11-02')).toBe(1)
  })
})

describe('agingBucket', () => {
  it.each([
    [-5, 'current'],
    [0, 'current'],
    [1, 'd1_30'],
    [30, 'd1_30'],
    [31, 'd31_60'],
    [60, 'd31_60'],
    [61, 'd61_90'],
    [90, 'd61_90'],
    [91, 'd90_plus'],
    [400, 'd90_plus']
  ] as const)('%i days → %s', (days, bucket) => {
    expect(agingBucket(days)).toBe(bucket)
  })
})

describe('bucketBalances', () => {
  it('sums balances into buckets and ignores settled orders', () => {
    const result = bucketBalances([
      { balance: 100.1, days_overdue: -3 },
      { balance: 200.2, days_overdue: 15 },
      { balance: 50, days_overdue: 45 },
      { balance: 25, days_overdue: 75 },
      { balance: 10, days_overdue: 120 },
      { balance: 0.004, days_overdue: 200 },
      { balance: -30, days_overdue: 10 }
    ])
    expect(result).toEqual({ current: 100.1, d1_30: 200.2, d31_60: 50, d61_90: 25, d90_plus: 10, total: 385.3 })
    expect(overdueAmount(result)).toBe(285.2)
  })

  it('avoids floating point drift', () => {
    const result = bucketBalances([{ balance: 0.1, days_overdue: 1 }, { balance: 0.2, days_overdue: 1 }])
    expect(result.d1_30).toBe(0.3)
    expect(result.total).toBe(0.3)
  })
})

describe('bucketShare', () => {
  it('returns a percentage with one decimal and handles zero totals', () => {
    expect(bucketShare(1, 3)).toBe(33.3)
    expect(bucketShare(5, 0)).toBe(0)
  })
})

describe('buildStatement', () => {
  const entries: StatementEntry[] = [
    { date: '2026-10-01', kind: 'order', order_id: 'o1', order_name: 'S001', reference: 'S001', charge: 1160, credit: 0 },
    { date: '2026-10-05', kind: 'payment', order_id: 'o1', order_name: 'S001', reference: 'Transferencia', charge: 0, credit: 500 },
    { date: '2026-10-07', kind: 'refund', order_id: 'o1', order_name: 'S001', reference: 'R001', charge: 0, credit: 116 },
    { date: '2026-10-07', kind: 'reimbursement', order_id: 'o1', order_name: 'S001', reference: 'R001', charge: 116, credit: 0 },
    { date: '2026-10-10', kind: 'order', order_id: 'o2', order_name: 'S002', reference: 'S002', charge: 300.33, credit: 0 }
  ]

  it('computes the running balance from the opening balance', () => {
    const lines = buildStatement(100, entries)
    expect(lines.map(l => l.balance)).toEqual([1260, 760, 644, 760, 1060.33])
  })

  it('closing balance equals opening + charges − credits', () => {
    const totals = statementTotals(100, entries)
    expect(totals).toEqual({ opening: 100, charges: 1576.33, credits: 616, closing: 1060.33 })
    expect(buildStatement(100, entries).at(-1)?.balance).toBe(totals.closing)
  })

  it('a refund that is reimbursed in cash leaves the balance unchanged', () => {
    const lines = buildStatement(0, entries.slice(0, 4))
    expect(lines[1]?.balance).toBe(lines[3]?.balance)
  })

  it('returns an empty list when there are no movements', () => {
    expect(buildStatement(50, [])).toEqual([])
    expect(statementTotals(50, []).closing).toBe(50)
  })
})

describe('filterAgingPartners', () => {
  const row = (name: string, email: string | null = null, phone: string | null = null): AgingPartnerRow => ({
    partner_id: name, partner_name: name, partner_email: email, partner_phone: phone,
    order_count: 1, total: 1, max_days_overdue: 0, current: 1, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0
  })
  const rows = [row('Comercializadora Peña'), row('Juan Pérez', 'juan@example.com'), row('Taller ACME', null, '555-1234')]

  it('matches name ignoring accents and case', () => {
    expect(filterAgingPartners(rows, 'pena').map(r => r.partner_name)).toEqual(['Comercializadora Peña'])
    expect(filterAgingPartners(rows, 'PÉREZ').map(r => r.partner_name)).toEqual(['Juan Pérez'])
  })

  it('matches email and phone, and returns all rows for an empty term', () => {
    expect(filterAgingPartners(rows, 'example.com')).toHaveLength(1)
    expect(filterAgingPartners(rows, '1234')).toHaveLength(1)
    expect(filterAgingPartners(rows, '  ')).toHaveLength(3)
  })
})
