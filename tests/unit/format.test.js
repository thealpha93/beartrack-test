import { formatDays } from '@/lib/utils/format.js'

describe('formatDays', () => {
  it('renders whole numbers without decimals', () => {
    expect(formatDays(20)).toBe('20')
    expect(formatDays(0)).toBe('0')
    expect(formatDays(1)).toBe('1')
  })
  it('renders fractional values with one decimal place', () => {
    expect(formatDays(0.5)).toBe('0.5')
    expect(formatDays(1.5)).toBe('1.5')
    expect(formatDays(19.5)).toBe('19.5')
  })
  it('handles negative values', () => {
    expect(formatDays(-1)).toBe('-1')
    expect(formatDays(-0.5)).toBe('-0.5')
  })
})
