/* Headless verification of the walkthrough + FF&E + fixings + DXF workbench on
 * /building-explorer: furniture renders & toggles, first-person walk (enter, WASD
 * move, floor up, Esc out), the FF&E + hardware takeoff cards, and the DXF drawing
 * workbench (sample plan, layer takeoff, revise, CSV). Run: node scripts/verify-walk.mjs */
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
  localStorage.setItem('aec-profile', JSON.stringify({ name: 'T', role: 'Architect', disciplines: [], sectors: [], goals: [], experience: 'pro', onboarded: true }))
  sessionStorage.setItem('aec-onb-seen', '1')
})
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const comps = () => page.evaluate(() => document.querySelector('[data-main-viewer] [aria-label^="3D building model"]')?.__components ?? null)
const walkState = () => page.evaluate(() => document.querySelector('[data-main-viewer] [aria-label^="3D building model"]')?.__walk ?? null)
const clickByText = (t) => page.evaluate((x) => { const b = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === x); if (b) { b.click(); return true } return false }, t)

try {
  await page.goto(BASE + '/building-explorer', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('[data-main-viewer] [aria-label^="3D building model"]', { timeout: 25000 })
  await wait(2200)

  // ── FF&E renders + toggles ──
  const c0 = await comps()
  ok('furniture renders in the 3D model (FF&E instanced)', !!c0 && c0.furniture > 0, c0)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Toggle Furnishings (FF&E)'); b?.click() })
  await wait(600)
  ok('the Model-browser eye hides the furnishings layer', (await comps())?.furniture === 0)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Toggle Furnishings (FF&E)'); b?.click() })
  await wait(400)

  // ── first-person walkthrough ──
  ok('walk state hook starts inactive', (await walkState())?.active === false, await walkState())
  await clickByText('Walkthrough')
  await wait(900)
  const w0 = await walkState()
  ok('Walkthrough enters first person at eye height on the ground floor', !!w0 && w0.active === true && w0.level === 0 && w0.y > 0, w0)
  const hud = await page.evaluate(() => document.body.innerText)
  ok('the walkthrough HUD shows the controls', /WASD/.test(hud) && /Exit \(Esc\)/.test(hud))
  await page.keyboard.down('w'); await wait(700); await page.keyboard.up('w')
  const w1 = await walkState()
  ok('W walks forward (position changes, still on the slab)', !!w1 && (Math.abs(w1.x - w0.x) > 0.01 || Math.abs(w1.z - w0.z) > 0.01), { from: w0, to: w1 })
  await page.keyboard.press('e'); await wait(500)
  const w2 = await walkState()
  ok('E rides up one floor (level + eye height rise)', !!w2 && w2.level === 1 && w2.y > w1.y, w2)
  await page.keyboard.press('q'); await wait(400)
  ok('Q comes back down', (await walkState())?.level === 0)
  await page.keyboard.press('Escape'); await wait(500)
  ok('Esc exits the walkthrough (orbit restored)', (await walkState())?.active === false)

  // ── FF&E + fixings cards ──
  const ffe = await page.evaluate(() => document.querySelector('[data-ffe]')?.innerText || '')
  ok('FF&E card prices the furnishings (items + budget + workstations)', /FF&E ITEMS/i.test(ffe) && /FF&E BUDGET/i.test(ffe) && /Workstation desk/.test(ffe))
  const fix = await page.evaluate(() => document.querySelector('[data-fixings]')?.innerText || '')
  ok('fixings card counts the nails (and screws, bolts, mass)', /down to the nails/i.test(fix) && /Skirting nails/.test(fix) && /NAILS/i.test(fix))
  const nailQty = await page.evaluate(() => { const t = document.querySelector('[data-fixings]')?.innerText || ''; const m = t.match(/NAILS\s*\n\s*([\d,]+)/i); return m ? Number(m[1].replace(/,/g, '')) : 0 })
  ok('the nail count is a real quantity', nailQty > 100, nailQty)

  // ── DXF drawing workbench ──
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === 'Drawings'); b?.click() })
  await wait(900)
  await clickByText('Load the sample plan')
  await wait(700)
  const dxf = await page.evaluate(() => document.body.innerText)
  ok('the sample DXF loads with layers + takeoff', /A-WALL/.test(dxf) && /S-COL/.test(dxf) && /Drawn length/i.test(dxf))
  const entBefore = await page.evaluate(() => { const m = (document.body.innerText.match(/ENTITIES\s*\n\s*(\d+)/i)); return m ? Number(m[1]) : -1 })
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Delete layer G-GRID'); b?.click() })
  await wait(500)
  const entAfter = await page.evaluate(() => { const m = (document.body.innerText.match(/ENTITIES\s*\n\s*(\d+)/i)); return m ? Number(m[1]) : -1 })
  ok('deleting a layer revises the drawing (4 gridlines gone)', entBefore > 0 && entAfter === entBefore - 4, { entBefore, entAfter })
  const svgEnts = await page.evaluate(() => document.querySelectorAll('svg[aria-label^="DXF drawing"] line, svg[aria-label^="DXF drawing"] circle, svg[aria-label^="DXF drawing"] polygon, svg[aria-label^="DXF drawing"] path, svg[aria-label^="DXF drawing"] text').length)
  ok('the drawing renders as vectors (SVG entities)', svgEnts > 20, svgEnts)
  ok('the entity-schedule CSV export is offered', await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => /CSV/.test(b.textContent || ''))))

  const realErrors = errors.filter((e) => !/404|favicon|tile|Failed to load resource|ERR_|pointerLock|PointerLock/i.test(e))
  ok('no console errors', realErrors.length === 0, realErrors.slice(0, 4))
} catch (e) {
  failures++
  console.error('✗ harness error —', e.message)
}
await browser.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nall walkthrough/FF&E/fixings/DXF checks passed')
process.exit(failures ? 1 : 0)
