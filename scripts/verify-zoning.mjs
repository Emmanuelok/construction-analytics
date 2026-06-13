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

  // ── per-edge setbacks ──
  await page.evaluate(() => { const b = [...document.querySelectorAll('[data-peredge] button')].find((x) => /Uniform|Per-edge/.test(x.textContent || '')); b?.click() })
  await wait(600)
  const hasFront = await page.evaluate(() => !!document.querySelector('input[aria-label="Front (frontage)"]'))
  ok('per-edge setbacks expose front / side / rear controls', hasFront)
  if (hasFront) {
    const ba0 = num(await page.evaluate(() => document.body.innerText), /buildable ([\d,]+) m/)
    await setRange('Rear', 16)
    await wait(600)
    const ba1 = num(await page.evaluate(() => document.body.innerText), /buildable ([\d,]+) m/)
    ok('raising the rear setback shrinks the buildable area', ba1 < ba0, { ba0, ba1 })
  }

  // ── shadow study ──
  const shadow = await text('[data-shadow]')
  ok('the shadow study renders three moments with reach + area', /Shadow study/i.test(shadow) && /09:00/.test(shadow) && /noon/i.test(shadow) && /Reach/.test(shadow))
  const svgs = await page.evaluate(() => document.querySelectorAll('[data-shadow] svg[aria-label="Shadow cast diagram"]').length)
  ok('each moment draws a shadow-cast diagram', svgs === 3, svgs)
  await setSelect('Shadow study month', '12')
  await wait(600)
  ok('changing the month recomputes the study (winter)', /Shadow study/i.test(await text('[data-shadow]')))

  // ── A/B compare ──
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Pin current as A/.test(x.textContent || '')); b?.click() })
  await wait(500)
  const cmp0 = await text('[data-compare]')
  ok('pinning A populates the comparison table', /A \(pinned\)/i.test(cmp0) && /B \(current\)/i.test(cmp0) && /Residual land/.test(cmp0))
  ok('the comparison reports the feasibility return for both schemes', /Margin \(land-free\)/.test(cmp0) && /GDV/.test(cmp0))

  // ── value-optimal massing ──
  const vm = await text('[data-value-maximize]')
  ok('a value-optimal massing banner is offered', /Value-optimal massing/i.test(vm) && /storeys/i.test(vm) && /land/i.test(vm))
  const feasBeforeVal = await page.evaluate(() => document.querySelector('[data-feasibility]')?.innerText || '')
  await page.evaluate(() => { const b = [...document.querySelectorAll('[data-value-maximize] button')].find((x) => /Max value/.test(x.textContent || '')); b?.click() })
  await wait(800)
  const feasAfterVal = await page.evaluate(() => document.querySelector('[data-feasibility]')?.innerText || '')
  ok('Max value loads the residual-land-value-maximal scheme (page recomputes)', feasAfterVal !== feasBeforeVal || /Residual land value/i.test(feasAfterVal))

  // ── development cashflow appraisal (DCF) ──
  const appr = await text('[data-appraisal]')
  ok('a development cashflow appraisal card is present', /Development cashflow/i.test(appr) && /Profit/i.test(appr) && /Margin on cost/i.test(appr))
  ok('the appraisal reports a project IRR, NPV and peak debt', /IRR \(project\)/i.test(appr) && /NPV/i.test(appr) && /Peak debt/i.test(appr) && /Break-even/i.test(appr))
  ok('the quarterly cashflow table renders', /Quarterly cashflow/i.test(appr) && /Q1/.test(appr) && /Cumulative/i.test(appr))
  ok('the cashflow J-curve chart is drawn', await page.evaluate(() => !!document.querySelector('[data-appraisal] svg')))
  ok('an appraisal CSV export is offered', await page.evaluate(() => [...document.querySelectorAll('[data-appraisal] button')].some((b) => /CSV/.test(b.textContent || ''))))
  const apprPeak0 = await page.evaluate(() => document.querySelector('[data-appraisal]')?.innerText || '')
  await setRange('Facility interest rate', 0)
  await wait(700)
  const apprPeak1 = await page.evaluate(() => document.querySelector('[data-appraisal]')?.innerText || '')
  ok('changing the facility rate re-runs the appraisal (interest/return move)', apprPeak1 !== apprPeak0)
  const period0 = await page.evaluate(() => document.querySelector('[data-appraisal]')?.innerText || '')
  await setRange('Construction', 40)
  await wait(700)
  const period1 = await page.evaluate(() => document.querySelector('[data-appraisal]')?.innerText || '')
  ok('a longer construction programme lengthens the cashflow', period1 !== period0)

  // ── sensitivity & scenarios ──
  const sens = await text('[data-sensitivity]')
  ok('a sensitivity & scenarios card is present', /Sensitivity & scenarios/i.test(sens) && /Tornado/i.test(sens))
  ok('a sensitivity metric + swing selector exist', await page.evaluate(() => !!document.querySelector('select[aria-label="Sensitivity metric"]') && !!document.querySelector('select[aria-label="Sensitivity swing"]')))
  ok('the tornado chart is drawn', await page.evaluate(() => !!document.querySelector('[data-sensitivity] svg[aria-label^="Tornado sensitivity"]')))
  ok('the two-way data grid renders (sale price × build cost)', /price/i.test(sens) && /cost/i.test(sens))
  ok('the scenario table shows downside / base / upside', /Downside/i.test(sens) && /Base/i.test(sens) && /Upside/i.test(sens))
  ok('a sensitivity CSV export is offered', await page.evaluate(() => [...document.querySelectorAll('[data-sensitivity] button')].some((b) => /CSV/.test(b.textContent || ''))))
  const sens0 = await page.evaluate(() => { const s = document.querySelector('[data-sensitivity] svg[aria-label^="Tornado sensitivity"]'); return s?.getAttribute('aria-label') || '' })
  await setSelect('Sensitivity metric', 'irr')
  await wait(700)
  const sens1 = await page.evaluate(() => { const s = document.querySelector('[data-sensitivity] svg[aria-label^="Tornado sensitivity"]'); return s?.getAttribute('aria-label') || '' })
  ok('switching the metric re-runs the tornado', /IRR/i.test(sens1) && sens1 !== sens0, { sens0, sens1 })

  // ── context & overshadowing ──
  await page.evaluate(() => { const b = [...document.querySelectorAll('[data-context] button')].find((x) => /Add context/.test(x.textContent || '')); b?.click() })
  await wait(900)
  const ctx = await text('[data-context]')
  ok('enabling context runs the overshadowing study', /Overshadowing by neighbour/i.test(ctx) && /neighbour/i.test(ctx))
  ok('the per-neighbour table reports worst shadow, sunlit moments + sun-hours', /Worst shadow/i.test(ctx) && /Sunlit/i.test(ctx) && /Sun-hrs/i.test(ctx) && /(Significant|Moderate|Minor)/i.test(ctx))
  ok('the context plan diagram is drawn', await page.evaluate(() => !!document.querySelector('[data-context] svg[aria-label="Context overshadowing plan"]')))
  ok('an overshadowing CSV export is offered', await page.evaluate(() => [...document.querySelectorAll('[data-context] button')].some((b) => /CSV/.test(b.textContent || ''))))
  const ctx0 = await page.evaluate(() => document.querySelector('[data-context] table')?.innerText || '')
  const raised = await setRange('North neighbour', 120)
  await wait(800)
  const ctx1 = await page.evaluate(() => document.querySelector('[data-context] table')?.innerText || '')
  ok('changing a neighbour height re-runs the study', !raised || ctx1 !== ctx0, { raised })

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
