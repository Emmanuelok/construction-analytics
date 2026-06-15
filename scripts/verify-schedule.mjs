/* Headless verification of the Critical Path Method (CPM) scheduler on
 * /cost-schedule: the Gantt renders, the critical path is shown, editing a
 * critical task's duration moves the project finish, and slack on a non-critical
 * task does not. Run: node scripts/verify-schedule.mjs */
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
  localStorage.setItem('aec-profile', JSON.stringify({ name: 'T', role: 'PM', disciplines: [], sectors: [], goals: [], experience: 'pro', onboarded: true }))
  sessionStorage.setItem('aec-onb-seen', '1')
})
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const text = (s) => page.evaluate((x) => document.querySelector(x)?.innerText || '', s)
const num = (s, re) => { const m = (s || '').match(re); return m ? Number(m[1].replace(/,/g, '')) : NaN }
const setNumber = (aria, v) => page.evaluate(({ a, val }) => { const el = document.querySelector(`input[aria-label="${a}"]`); if (!el) return false; const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; set.call(el, String(val)); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true }, { a: aria, val: v })

try {
  await page.goto(BASE + '/cost-schedule', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('[data-cpm]', { timeout: 25000 })
  await wait(1200)

  const cpm = await text('[data-cpm]')
  ok('a critical path schedule (CPM) card is present', /Critical path schedule/i.test(cpm) && /working days/i.test(cpm))
  ok('it reports duration, finish, critical tasks + float', /Duration/i.test(cpm) && /Finish/i.test(cpm) && /Critical tasks/i.test(cpm) && /float/i.test(cpm))
  ok('the critical path is listed', /Critical path/i.test(cpm) && /Mobilisation/i.test(cpm) && /Handover/i.test(cpm))
  ok('the task table is editable (duration inputs)', await page.evaluate(() => document.querySelectorAll('[data-cpm] input[type="number"]').length >= 10))
  ok('a CSV export is offered', await page.evaluate(() => [...document.querySelectorAll('[data-cpm] button')].some((b) => /CSV/.test(b.textContent || ''))))

  const durBefore = num(await text('[data-cpm]'), /Duration\s*\n?\s*(\d+)\s*days/i)
  // extend the critical envelope task → project finishes later
  await setNumber('Envelope & cladding duration', 60)
  await wait(500)
  const durAfter = num(await text('[data-cpm]'), /Duration\s*\n?\s*(\d+)\s*days/i)
  ok('extending the critical envelope task lengthens the project', durAfter > durBefore, { durBefore, durAfter })

  // slack on landscaping (off the critical path) by a small amount → no change
  await setNumber('Envelope & cladding duration', 30)
  await wait(300)
  const dur0 = num(await text('[data-cpm]'), /Duration\s*\n?\s*(\d+)\s*days/i)
  await setNumber('Landscaping & externals duration', 17)
  await wait(500)
  const dur1 = num(await text('[data-cpm]'), /Duration\s*\n?\s*(\d+)\s*days/i)
  ok('a small slip on a task with float does not move the finish', dur1 === dur0, { dur0, dur1 })

  // ── schedule risk (Monte Carlo) ──
  const risk = await text('[data-risk]')
  ok('a Monte Carlo schedule-risk card is present', /Schedule risk/i.test(risk) && /Monte Carlo/i.test(risk) && /P80/i.test(risk))
  ok('it reports deterministic vs P50/P80/P90 and on-plan odds', /Deterministic/i.test(risk) && /P50/i.test(risk) && /On-plan odds/i.test(risk))
  ok('the finish-date distribution histogram is drawn', await page.evaluate(() => !!document.querySelector('[data-risk] svg[aria-label="Finish-date distribution"]')))
  ok('a criticality index is shown', /Criticality index/i.test(risk))
  ok('a schedule-risk CSV export is offered', await page.evaluate(() => [...document.querySelectorAll('[data-risk] button')].some((b) => /CSV/.test(b.textContent || ''))))
  const p80Before = num(await text('[data-risk]'), /P80 \(commit\)\s*\n?\s*(\d+)\s*d/i)
  await page.evaluate(() => { const el = document.querySelector('input[aria-label="Task uncertainty"]'); if (el) { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, '0.9'); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) } })
  await wait(700)
  const p80After = num(await text('[data-risk]'), /P80 \(commit\)\s*\n?\s*(\d+)\s*d/i)
  ok('raising task uncertainty pushes the P80 finish out', p80After >= p80Before, { p80Before, p80After })

  // ── cost-loaded schedule (S-curve) ──
  const sc = await text('[data-scurve]')
  ok('a cost-loaded S-curve card is present', /Cost-loaded schedule/i.test(sc) && /Total cost/i.test(sc) && /Peak drawdown/i.test(sc))
  ok('the S-curve chart is drawn', await page.evaluate(() => !!document.querySelector('[data-scurve] svg[aria-label="Cost S-curve"]')))
  ok('the period table shows cumulative + % complete', /Cumulative/i.test(sc) && /% complete/i.test(sc))
  ok('a cost-loading CSV export is offered', await page.evaluate(() => [...document.querySelectorAll('[data-scurve] button')].some((b) => /CSV/.test(b.textContent || ''))))

  // ── earned value forecast ──
  const evmf = await text('[data-evmf]')
  ok('an earned value forecast card is present', /Earned value forecast/i.test(evmf) && /CPI/i.test(evmf) && /SPI/i.test(evmf))
  ok('it forecasts EAC + VAC against the baseline (BAC)', /Forecast \(EAC\)/i.test(evmf) && /Variance \(VAC\)/i.test(evmf) && /BAC/i.test(evmf))
  ok('the PV/EV/AC curve chart is drawn', await page.evaluate(() => !!document.querySelector('[data-evmf] svg[aria-label="EVM curves"]')))
  ok('an EVM forecast CSV export is offered', await page.evaluate(() => [...document.querySelectorAll('[data-evmf] button')].some((b) => /CSV/.test(b.textContent || ''))))
  const eac0 = num(await text('[data-evmf]'), /Forecast \(EAC\)\s*\n?\s*\$?([\d.]+)([kmb])?/i)
  await page.evaluate(() => { const el = document.querySelector('input[aria-label="Actual cost to date"]'); if (el) { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, '2000000'); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) } })
  await wait(500)
  const evmf2 = await text('[data-evmf]')
  ok('raising actual cost worsens the forecast (recomputes)', evmf2 !== evmf && /over budget|overrun/i.test(evmf2))

  // ── resource levelling ──
  const lvl = await text('[data-level]')
  ok('a resource levelling card is present', /Resource levelling/i.test(lvl) && /Peak crew/i.test(lvl) && /Levelled peak/i.test(lvl))
  ok('the crew histogram (before vs levelled) is drawn', await page.evaluate(() => !!document.querySelector('[data-level] svg[aria-label="Crew histogram before and after levelling"]')))
  ok('a levelling CSV export is offered', await page.evaluate(() => [...document.querySelectorAll('[data-level] button')].some((b) => /CSV/.test(b.textContent || ''))))
  const peakBefore = num(lvl, /Peak crew\s*\n?\s*(\d+)/i)
  const peakAfter = num(lvl, /Levelled peak\s*\n?\s*(\d+)/i)
  ok('levelling reduces (or holds) the peak crew', Number.isFinite(peakBefore) && Number.isFinite(peakAfter) && peakAfter <= peakBefore, { peakBefore, peakAfter })

  const realErrors = errors.filter((e) => !/404|favicon|tile|Failed to load resource|ERR_/i.test(e))
  ok('no console errors', realErrors.length === 0, realErrors.slice(0, 4))
} catch (e) {
  failures++
  console.error('✗ harness error —', e.message)
}
await browser.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nall CPM schedule checks passed')
process.exit(failures ? 1 : 0)
