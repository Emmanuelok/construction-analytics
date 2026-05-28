/** Formatting helpers for figures shown across the studio. */

export function formatCurrency(value: number, opts: { compact?: boolean; currency?: string } = {}) {
  const { compact = true, currency = 'USD' } = opts
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 0,
  }).format(value)
}

export function formatNumber(value: number, opts: { compact?: boolean; digits?: number } = {}) {
  const { compact = false, digits } = opts
  return new Intl.NumberFormat('en-US', {
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: digits ?? (compact ? 1 : 0),
  }).format(value)
}

export function formatPercent(value: number, digits = 1) {
  return `${value > 0 && value < 1 ? (value * 100).toFixed(digits) : value.toFixed(digits)}%`
}

export function formatDelta(value: number, digits = 1) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(digits)}%`
}

export function formatBytes(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB']
  let i = 0
  let v = bytes
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}
