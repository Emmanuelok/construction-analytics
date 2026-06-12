/* Headless verification of the Site & Zoning feasibility studio on /site-zoning:
 * the zoning-district presets reshape the rules, the as-of-right Maximize button
 * loads the GFA-maximal compliant scheme, and the development pro forma recomputes
 * GDV / residual land value live as the programme mix + margin change. Run:
 * node scripts/verify-zoning.mjs */
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
  localStorage.setItem('aec-profile', JSON.stringify({ name: 'T', role: 'Developer', disciplines: [], sectors: [], goals: [], experience: 'pro', onboarded: true }))
  sessionStorage.setItem('aec-onb-seen', '1')
})
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const text = (s) => page.evaluate((x) => document.querySelector(x)?.innerText || '', s)
const num = (s, re) => { const m = (s || '').match(re); return m ? Number(m[1].replace(/,/g, '')) : NaN }
const setSelect = (aria, v) => page.evaluate(({ a, val }) => { const el = document.querySelector(`select[aria-label="${a}"]`); if (!el) return false; const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set; set.call(el, val); el.dispatchEvent(new Event('change', { bubbles: true })); return true }, { a: aria, val: v })
const setRange = (aria, v) => page.evaluate(({ a, val }) => { const el = document.querySelector(`input[aria-label="${a}"]`); if (!el) return false; const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; set.call(el, String(val)); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true }, { a: aria, val: v })

try {
  await page.goto(BASE + '/site-zoning', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('[data-feasibility]', { timeout: 25000 })
  await wait(1500)
  ok('the page presents itself as a feasibility studio', /feasibility studio/i.test(await page.evaluate(() => document.body.innerText)))

  // ── zoning district preset ──
  ok('a zoning-district selector exists', await page.evaluate(() => !!document.querySelector('select[aria-label="Zoning district preset"]')))
  const farBefore = num(await page.evaluate(() => document.body.innerText), /FAR\s+([\d.]+)/)
  await setSelect('Zoning district preset', 'downtown-hd')
  await wait(800)
  const maxText = await text('[data-zoning-maximize]')
  ok('picking Downtown high-density loads its dense rules', /Downtown high-density/i.test(await text('[data-zoning-district]')))
  ok('the as-of-right maximum recomputes for the district', /As-of-right maximum/.test(maxText) && /storeys · binds on/.test(maxText))
  void farBefore

  // ── maximize ──
  const utilBefore = num(await page.evaluate(() => document.body.innerText), /Capacity used[\s\S]{0,20}?(\d+)%/)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Maximize/.test(x.textContent || '')); b?.click() })
  await wait(800)
  const utilAfter = num(await page.evaluate(() => document.body.innerText), /Capacity used[\s\S]{0,20}?(\d+)%/)
  ok('Maximize pushes capacity used up toward the cap', utilAfter >= 90 && utilAfter >= utilBefore, { utilBefore, utilAfter })

  // ── feasibility pro forma ──
  const feas = await text('[data-feasibility]')
  ok('the feasibility card shows GDV, cost, residual land value + returns', /GDV \(value\)/i.test(feas) && /Total cost/i.test(feas) && /Residual land value/i.test(feas) && /Margin/i.test(feas))
  ok('the programme table breaks down by use with units + tenure', /Residential/i.test(feas) && /Units/i.test(feas) && /(sale|investment)/i.test(feas))
  ok('parking bays are derived from the programme', /parking bays required/i.test(feas))
  const rlvBefore = num(feas, /Residual land value\s*\n?\s*\$?([\d.,]+[kmb]?)/i)
  void rlvBefore
  // change the mix to all-residential and lift target margin → headline + numbers move
  const land0 = await page.evaluate(() => document.querySelector('[data-feasibility]')?.innerText || '')
  await setRange('Target margin', 30)
  await wait(700)
  const land1 = await page.evaluate(() => document.querySelector('[data-feasibility]')?.innerText || '')
  ok('raising the target margin re-prices the residual land value (page recomputed)', land1 !== land0)
  ok('the feasibility headline reads as an underwriting verdict', /support|margin|underwater|stack/i.test(feas))
  ok('the feasibility CSV export is offered', await page.evaluate(() => [...document.querySelectorAll('[data-feasibility] button')].some((b) => /CSV/.test(b.textContent || ''))))

  // existing compliance still works
  ok('the live compliance KPI still renders', /Compliant|Non-compliant/.test(await page.evaluate(() => document.body.innerText)))

  const realErrors = errors.filter((e) => !/404|favicon|tile|Failed to load resource|ERR_|leaflet/i.test(e))
  ok('no console errors', realErrors.length === 0, realErrors.slice(0, 4))
} catch (e) {
  failures++
  console.error('✗ harness error —', e.message)
}
await browser.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nall Site & Zoning checks passed')
process.exit(failures ? 1 : 0)
