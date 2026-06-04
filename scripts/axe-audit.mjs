/* Automated accessibility audit — fails on any serious/critical WCAG 2 A/AA
 * violation (excluding color-contrast, tracked separately as a theme task).
 * Run: node scripts/axe-audit.mjs  (expects the dev server on :5173, or pass a
 * BASE env). CI builds, previews, then runs this. Keeps the studio's keyboard
 * and screen-reader access from regressing. */
import puppeteer from 'puppeteer'
import { AxePuppeteer } from '@axe-core/puppeteer'

const BASE = process.env.AXE_BASE || 'http://localhost:5173/construction-analytics'
const ROUTES = [
  '/welcome', '/overview', '/project', '/ask', '/alerts', '/notifications', '/developer',
  '/cost-schedule', '/procurement', '/field', '/reality-capture', '/digital-twin', '/connections',
  '/bim', '/building-explorer', '/site-zoning', '/sustainability', '/insights', '/governance', '/documents', '/ai-studio',
]
const IGNORE = new Set(['color-contrast']) // tracked separately (theme tokens)

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] })
let failures = 0
for (const r of ROUTES) {
  const page = await browser.newPage()
  try {
    // domcontentloaded (not networkidle0): pages with a continuous WebGL rAF loop
    // — /project's massing model, the BIM viewer — never reach network idle.
    await page.goto(BASE + r, { waitUntil: 'domcontentloaded', timeout: 30000 })
    // settle: the 3D pages build a full instanced building synchronously on mount
    await new Promise((x) => setTimeout(x, 2400))
    const res = await new AxePuppeteer(page).withTags(['wcag2a', 'wcag2aa']).analyze()
    const bad = res.violations.filter((v) => (v.impact === 'serious' || v.impact === 'critical') && !IGNORE.has(v.id))
    if (bad.length) {
      failures += bad.length
      console.error(`✗ ${r}`)
      for (const v of bad) console.error(`    [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length}) — e.g. ${v.nodes[0].target.join(' ')}`)
    } else {
      console.log(`✓ ${r}`)
    }
  } catch (e) {
    failures++
    console.error(`✗ ${r} — ${e.message}`)
  }
  await page.close()
}
await browser.close()
console.log(`\naxe: ${failures === 0 ? 'PASS' : failures + ' violation(s)'} across ${ROUTES.length} routes (color-contrast excluded)`)
process.exit(failures > 0 ? 1 : 0)
