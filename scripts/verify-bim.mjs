/* Headless verification of the BIM Intelligence revamp on /bim: parse the geometry
 * sample → storeys tile populated (was 0), the plain-language explainer + health
 * check render with a grade and "why it matters" copy, the composition translates
 * raw classes into groups (with a raw toggle), the audit CSV is offered, and the
 * Building Explorer hand-off link exists. Run: node scripts/verify-bim.mjs */
import puppeteer from 'puppeteer'

const BASE = process.env.BASE || 'http://localhost:4173/construction-analytics'
const browser = await puppeteer.launch({ headless: 'new', protocolTimeout: 120000, args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] })
let failures = 0
const ok = (n, c, extra) => { if (c) console.log(`✓ ${n}`); else { failures++; console.error(`✗ ${n}`, extra ?? '') } }
const page = await browser.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('aec-profile', JSON.stringify({ name: 'T', role: 'BIM manager', disciplines: [], sectors: [], goals: [], experience: 'pro', onboarded: true }))
  sessionStorage.setItem('aec-onb-seen', '1')
})
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const text = (sel) => page.evaluate((s) => document.querySelector(s)?.innerText || '', sel)

try {
  await page.goto(BASE + '/bim', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await wait(1200)
  ok('the page explains itself in plain language', /universal BIM format|plain language/i.test(await page.evaluate(() => document.body.innerText)))

  // parse the geometry sample
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Sample with geometry/.test(x.textContent || '')); b?.click() })
  await wait(2500)
  const body = await page.evaluate(() => document.body.innerText)
  ok('the sample parses with a real spatial structure (4 storeys, was 0)', /Storeys\s*\n\s*4/.test(body), body.match(/Storeys[\s\S]{0,12}/)?.[0])
  ok('tiles read in plain language (records / building elements)', /Records in the file/i.test(body) && /Building elements/i.test(body))

  // explainer strip
  const exp = await text('[data-bim-explainer]')
  ok('the “how to read an IFC” explainer renders', /database, not a picture/i.test(exp) && /spatial tree/i.test(exp))

  // health check
  const health = await text('[data-bim-health]')
  ok('the model-health check grades the file', /Model health — \d+\/100/.test(health) && /Grade [A-E]/.test(health))
  ok('findings pass the good checks on the fixed sample', /Spatial structure present/i.test(health) && /placed in storeys/i.test(health) && /real 3D geometry/i.test(health))
  ok('and honestly flag what to tighten, with plain “why it matters” copy', /No element types|No property sets/i.test(health) && /Why it matters:/.test(health))
  ok('the audit CSV export is offered', await page.evaluate(() => !!document.querySelector('[data-bim-health] button')))

  // composition
  const compT = await text('[data-bim-composition]')
  ok('records translate into relatable groups', /Geometry plumbing/i.test(compT) && /Building elements/i.test(compT) && /Relationships/i.test(compT))
  ok('plain labels replace raw classes (Points, not IFCCARTESIANPOINT)', /Points \(coordinates\)/i.test(compT) && !/IFCCARTESIANPOINT/.test(compT))
  await page.evaluate(() => { const b = [...document.querySelectorAll('[data-bim-composition] button')].find((x) => /raw IFC class names/i.test(x.textContent || '')); b?.click() })
  await wait(400)
  ok('the raw-class toggle reveals the pro view', /IFCCARTESIANPOINT/.test(await text('[data-bim-composition]')))
  ok('the Building Explorer hand-off is linked', await page.evaluate(() => !!document.querySelector('[data-bim-composition] a[href*="building-explorer"]')))

  // the clash workbench below still computes
  ok('the clash workbench renders with a live health score', /Model health/.test(body) && /Open clashes/.test(body) && /Resolution rate/.test(body))

  const realErrors = errors.filter((e) => !/404|favicon|tile|Failed to load resource|ERR_|pointerLock/i.test(e))
  ok('no console errors', realErrors.length === 0, realErrors.slice(0, 4))
} catch (e) {
  failures++
  console.error('✗ harness error —', e.message)
}
await browser.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nall BIM Intelligence checks passed')
process.exit(failures ? 1 : 0)
