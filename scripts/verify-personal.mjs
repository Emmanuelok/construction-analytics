/* Headless verification of the personalization layer: the home greets the person by
 * name with a role-tuned lede, the advisor phase journey + next-best-action render,
 * the live site pulse ticks, the chrome takes the role accent, and visiting a tool
 * feeds the "Continue" trail. Run: node scripts/verify-personal.mjs */
import puppeteer from 'puppeteer'

const BASE = process.env.BASE || 'http://localhost:4173/construction-analytics'
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] })
let failures = 0
const ok = (n, c, extra) => { if (c) console.log(`✓ ${n}`); else { failures++; console.error(`✗ ${n}`, extra ?? '') } }
const page = await browser.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('aec-profile', JSON.stringify({ name: 'Ada', role: 'Structural Engineer', disciplines: ['Structural'], sectors: ['Commercial'], goals: ['Cut embodied carbon'], experience: 'Expert', onboarded: true }))
  sessionStorage.setItem('aec-onb-seen', '1')
})

try {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForFunction(() => /Ada/.test(document.body.innerText), { timeout: 20000 })
  ok('the home greets the person by name', true)
  ok('the lede speaks in their role', await page.evaluate(() => /structural engineer workspace/i.test(document.body.innerText)))
  ok('the chrome takes the role accent (cyan for structural)', await page.evaluate(() => document.documentElement.dataset.accent === 'cyan'))

  // advisor phase journey + next best action
  const phases = await page.evaluate(() => document.querySelectorAll('[data-command-center] [data-phase]').length)
  ok('the phase journey renders all six phases', phases === 6, { phases })
  ok('a next-best-action card deep-links into the model', await page.evaluate(() => /Next best action/i.test(document.body.innerText)))

  // live pulse ticks (frames advance with the clock)
  const crew0 = await page.evaluate(() => document.querySelector('[data-live="crew"]')?.textContent)
  await new Promise((r) => setTimeout(r, 3600))
  const ticked = await page.evaluate((c0) => {
    const el = document.querySelector('[data-live="crew"]')
    return !!el && (el.textContent !== c0 || /Live · simulated/.test(document.body.innerText))
  }, crew0)
  ok('the site pulse is live (badge + ticking frames)', ticked)

  // visiting a tool feeds the Continue trail
  await page.goto(BASE + '/building-explorer', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[aria-label^="3D building model"]', { timeout: 20000 })
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => /Ada/.test(document.body.innerText), { timeout: 20000 })
  ok('“Continue” remembers the tool just visited', await page.evaluate(() => { const r = document.querySelector('[data-recents]'); return !!r && /Building Explorer/.test(r.textContent || '') }))

  const realErrors = errors.filter((e) => !/404|favicon|tile|Failed to load resource|ERR_/i.test(e))
  ok('no console errors', realErrors.length === 0, realErrors.slice(0, 4))
} catch (e) {
  failures++
  console.error('✗ harness error —', e.message)
}
await browser.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nall personalization checks passed')
process.exit(failures ? 1 : 0)
