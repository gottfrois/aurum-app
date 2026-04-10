import { describe, expect, it } from 'vitest'
import { formatMoney } from '~/lib/money/format'

// Note: Intl outputs use NBSP (U+00A0) and NNBSP (U+202F) for grouping/separators.
// We assert the *normalised* form (collapse all whitespace to a single space) so
// the tests stay readable and resilient to minor ICU changes.
function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

describe('formatMoney', () => {
  it('formats EUR in fr-FR locale with French separators', () => {
    const out = formatMoney(1234.5, { locale: 'fr-FR', currency: 'EUR' })
    expect(normalize(out)).toBe('1 234,50 €')
  })

  it('formats USD in en-US locale with dollar sign prefix', () => {
    const out = formatMoney(1234.5, { locale: 'en-US', currency: 'USD' })
    expect(normalize(out)).toBe('$1,234.50')
  })

  it('formats EUR in en-US locale with currency code', () => {
    const out = formatMoney(1234.5, {
      locale: 'en-US',
      currency: 'EUR',
      currencyDisplay: 'code',
    })
    expect(normalize(out)).toBe('EUR 1,234.50')
  })

  it('formats negative USD with accounting parentheses in en-US', () => {
    const out = formatMoney(-1234.5, {
      locale: 'en-US',
      currency: 'USD',
      currencySign: 'accounting',
    })
    expect(normalize(out)).toBe('($1,234.50)')
  })

  it('formats JPY with zero default decimals', () => {
    const out = formatMoney(1234, { locale: 'ja-JP', currency: 'JPY' })
    // Either '￥1,234' (full-width) or '¥1,234' depending on ICU; check digits
    expect(out).toMatch(/1,234/)
    expect(out).not.toMatch(/\./) // no decimal point
  })

  it('formats large amounts in de-DE with German separators', () => {
    const out = formatMoney(1234567.89, {
      locale: 'de-DE',
      currency: 'EUR',
    })
    expect(normalize(out)).toBe('1.234.567,89 €')
  })

  it('respects custom maximumFractionDigits', () => {
    const out = formatMoney(1234.5, {
      locale: 'en-US',
      currency: 'EUR',
      maximumFractionDigits: 0,
    })
    expect(out).not.toMatch(/\./)
  })
})
