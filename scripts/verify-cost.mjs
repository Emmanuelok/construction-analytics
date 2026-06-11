/* Headless verification of the elemental cost plan + per-element type overrides on
 * /building-explorer: the cost-plan card (total, $/m², groups, split bar), re-pricing
 * on a family swap, and the Element-inspector Type selector overriding one column
 * (recolours the model, marks the cost line). Run: node scripts/verify-cost.mjs */
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
  localStorage.setItem('aec-profile', JSON.stringify({ name: 'T', role: 'Cost manager', disciplines: [], sectors: [], goals: [], experience: 'pro', onboarded: true }))
  sessionStorage.setItem('aec-onb-seen', '1')
})
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const comps = () => page.evaluate(() => document.querySelector('[data-main-viewer] [aria-label^="3D building model"]')?.__components ?? null)
const cardText = (s) => page.evaluate((x) => document.querySelector(x)?.innerText || '', s)
const num = (s, re) => { const m = (s || '').match(re); return m ? Number(m[1].replace(/,/g, '')) : NaN }
const setSelect = (aria, v) => page.evaluate(({ a, val }) => { const el = document.querySelector(`select[aria-label="${a}"]`); if (!el) return false; const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set; set.call(el, val); el.dispatchEvent(new Event('change', { bubbles: true })); return true }, { a: aria, val: v })

try {
  await page.goto(BASE + '/building-explorer', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('[data-costplan]', { timeout: 25000 })
  await wait(2400)

  // ── cost plan card ──
  const cp = await cardText('[data-costplan]')
  ok('the elemental cost plan renders total + $/m² + NRM groups', /Total construction/i.test(cp) && /Cost \/ m² GFA/i.test(cp) && /Substructure/.test(cp) && /Frame & upper floors/.test(cp) && /Envelope & roof/.test(cp))
  const total0 = num(cp, /Total construction\s*\n\s*\$([\d,]+)/i)
  const perM20 = num(cp, /Cost \/ m² GFA\s*\n\s*\$([\d,]+)/i)
  ok('total + $/m² are real numbers', total0 > 1_000_000 && perM20 > 100, { total0, perM20 })
  const groupCount = await page.evaluate(() => document.querySelectorAll('[data-costplan] .rounded-full > div').length)
  ok('the group split bar has a segment per cost group', groupCount >= 4, groupCount)

  // swap façade to a costlier system → total rises
  await setSelect('Façade system type', 'double-skin')
  await wait(900)
  const total1 = num(await cardText('[data-costplan]'), /Total construction\s*\n\s*\$([\d,]+)/i)
  ok('a costlier façade re-prices the plan upward', total1 > total0, { total0, total1 })
  await setSelect('Façade system type', 'curtain')
  await wait(700)

  // ── per-element override: select a column via the Structure table, re-type it ──
  const ov0 = (await comps())?.overrides ?? 0
  const clicked = await page.evaluate(() => {
    // find the table whose header says "Utilisation" (the structure columns table),
    // then click its first body row → selectEl(column id)
    const table = [...document.querySelectorAll('table')].find((t) => /Utilisation/i.test(t.querySelector('thead')?.textContent || ''))
    const row = table?.querySelector('tbody tr')
    if (!row) return false
    row.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true
  })
  ok('a column can be selected from the structure schedule', clicked)
  await wait(900)
  const hasTypeSel = await page.evaluate(() => !!document.querySelector('select[aria-label="Element type"]'))
  ok('the Element inspector exposes a per-element Type selector', hasTypeSel)
  await setSelect('Element type', 'steel-uc')
  await wait(1000)
  const ov1 = (await comps())?.overrides ?? 0
  ok('overriding one element draws its override colour in the model', ov1 > ov0, { ov0, ov1 })
  ok('the inspector marks the element as overridden', /Overridden/.test(await page.evaluate(() => document.body.innerText)))
  const cpOv = await page.evaluate(() => document.querySelector('[data-costplan]')?.innerText || '')
  ok('the cost plan splits the overridden column onto a steel line', /Steel UC 305×305/.test(cpOv))

  // reset persists clean
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Reset to the global/.test(x.textContent || '')); b?.click() })
  await wait(800)
  ok('resetting the override clears it', ((await comps())?.overrides ?? 0) === ov0)

  const realErrors = errors.filter((e) => !/404|favicon|tile|Failed to load resource|ERR_|pointerLock/i.test(e))
  ok('no console errors', realErrors.length === 0, realErrors.slice(0, 4))
} catch (e) {
  failures++
  console.error('✗ harness error —', e.message)
}
await browser.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nall cost-plan / override checks passed')
process.exit(failures ? 1 : 0)
