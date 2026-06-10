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

const browser = await puppeteer.launch({ headless: 'new', protocolTimeout: 120000, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
let failures = 0
for (const r of ROUTES) {
  // analyze with retries: heavy 3D pages (instanced building + FF&E layer) build
  // synchronously on mount and can still be busy when axe injects under software
  // GL, which throws "Page/Frame is not ready" — give them progressively longer.
  let lastErr = null
  for (let attempt = 0; attempt < 3; attempt++) {
    const page = await browser.newPage()
    try {
      // domcontentloaded (not networkidle0): pages with a continuous WebGL rAF loop
      // — /project's massing model, the BIM viewer — never reach network idle.
      await page.goto(BASE + r, { waitUntil: 'domcontentloaded', timeout: 45000 })
      // settle: the 3D pages build a full instanced building synchronously on mount
      await new Promise((x) => setTimeout(x, 4000 + attempt * 4000))
      const res = await new AxePuppeteer(page).withTags(['wcag2a', 'wcag2aa']).analyze()
      const bad = res.violations.filter((v) => (v.impact === 'serious' || v.impact === 'critical') && !IGNORE.has(v.id))
      if (bad.length) {
        failures += bad.length
        console.error(`✗ ${r}`)
        for (const v of bad) console.error(`    [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length}) — e.g. ${v.nodes[0].target.join(' ')}`)
      } else {
        console.log(`✓ ${r}`)
      }
      lastErr = null
      await page.close()
      break
    } catch (e) {
      lastErr = e
      await page.close()
    }
  }
  if (lastErr) { failures++; console.error(`✗ ${r} — ${lastErr.message}`) }
}
await browser.close()
console.log(`\naxe: ${failures === 0 ? 'PASS' : failures + ' violation(s)'} across ${ROUTES.length} routes (color-contrast excluded)`)
process.exit(failures > 0 ? 1 : 0)
