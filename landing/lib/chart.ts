/* Pure SVG chart math — no dependencies, deterministic, unit-testable. The
 * landing page's live charts are hand-built from these so the marketing site
 * feels like the actual analytics instrument, not a brochure. */

export type Pt = { x: number; y: number }

/** Map values to evenly-spaced points within a w×h box (y inverted for SVG). */
export function buildLine(values: number[], w: number, h: number, pad = 6): Pt[] {
  if (!values.length) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const innerW = w - pad * 2
  const innerH = h - pad * 2
  const stepX = values.length > 1 ? innerW / (values.length - 1) : 0
  return values.map((v, i) => ({
    x: pad + i * stepX,
    y: pad + innerH * (1 - (v - min) / span),
  }))
}

/** Smooth (cardinal-spline) path through points → SVG path `d`. */
export function smoothLineD(pts: Pt[]): string {
  if (!pts.length) return ''
  if (pts.length < 3) return `M ${pts.map((p) => `${r(p.x)} ${r(p.y)}`).join(' L ')}`
  let d = `M ${r(pts[0].x)} ${r(pts[0].y)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${r(cp1x)} ${r(cp1y)} ${r(cp2x)} ${r(cp2y)} ${r(p2.x)} ${r(p2.y)}`
  }
  return d
}

/** Close a line path into a filled area down to the baseline. */
export function areaD(pts: Pt[], h: number): string {
  if (pts.length < 2) return ''
  return `${smoothLineD(pts)} L ${r(pts[pts.length - 1].x)} ${r(h)} L ${r(pts[0].x)} ${r(h)} Z`
}

/** Ordinary least-squares fit → slope, intercept, and Pearson r. */
export function linreg(xs: number[], ys: number[]): { slope: number; intercept: number; r: number } {
  const n = Math.min(xs.length, ys.length)
  if (n < 2) return { slope: 0, intercept: 0, r: 0 }
  const mx = xs.reduce((s, x) => s + x, 0) / n
  const my = ys.reduce((s, y) => s + y, 0) / n
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx
    const dy = ys[i] - my
    sxy += dx * dy
    sxx += dx * dx
    syy += dy * dy
  }
  const slope = sxx === 0 ? 0 : sxy / sxx
  const denom = Math.sqrt(sxx * syy)
  return { slope, intercept: my - slope * mx, r: denom === 0 ? 0 : sxy / denom }
}

const r = (n: number) => Math.round(n * 100) / 100
