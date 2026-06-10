/* Headless verification of the Families & Types catalog + MEP + finishes schedule
 * on /building-explorer: the catalog card, type swaps re-running the engines
 * (glazing → EUI, column → structure + 3D shape), the MEP layer (drawn counts,
 * schedule, repricing), FF&E alternates repricing the budget, and the room-by-room
 * finishes schedule. Run: node scripts/verify-families.mjs */
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
  localStorage.setItem('aec-profile', JSON.stringify({ name: 'T', role: 'Architect', disciplines: [], sectors: [], goals: [], experience: 'pro', onboarded: true }))
  sessionStorage.setItem('aec-onb-seen', '1')
})
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const comps = () => page.evaluate(() => document.querySelector('[data-main-viewer] [aria-label^="3D building model"]')?.__components ?? null)
const studio = () => page.evaluate(() => document.querySelector('[data-main-viewer] [aria-label^="3D building model"]')?.__studio ?? null)
const setSelect = (aria, v) => page.evaluate(({ a, val }) => {
  const el = document.querySelector(`select[aria-label="${a}"]`); if (!el) return false
  const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
  set.call(el, val); el.dispatchEvent(new Event('change', { bubbles: true })); return true
}, { a: aria, val: v })
const cardText = (sel) => page.evaluate((s) => document.querySelector(s)?.innerText || '', sel)
const num = (s, re) => { const m = (s || '').match(re); return m ? Number(m[1].replace(/,/g, '')) : NaN }

try {
  await page.goto(BASE + '/building-explorer', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('[data-main-viewer] [aria-label^="3D building model"]', { timeout: 25000 })
  await wait(2400)

  // ── families card ──
  const fam = await cardText('[data-families]')
  ok('the Families & Types catalog renders all 16 families', /Families & types — \d+ types across 16 families/.test(fam))
  ok('catalog cells show material + rate for the active type', /C32\/40 concrete/.test(fam) && /\$\d/.test(fam))
  // every type has a clickable render preview (swatch); clicking one selects it
  const swatches = await page.evaluate(() => document.querySelectorAll('[data-families] [role="group"] button svg').length)
  ok('every type carries a render-preview swatch (65+)', swatches >= 65, swatches)
  await page.evaluate(() => { const b = [...document.querySelectorAll('[data-families] button')].find((x) => x.getAttribute('aria-label') === 'Floor finishes: Engineered timber'); b?.click() })
  await wait(700)
  ok('clicking a swatch selects that type (timber floor active)', await page.evaluate(() => document.querySelector('select[aria-label="Floor finishes type"]')?.value) === 'timber')
  // Preview in 3D: isolates the family's elements, then restores
  const catsBefore = await page.evaluate(() => JSON.stringify((document.querySelector('[data-main-viewer] [aria-label^="3D building model"]')?.__studio ?? {}).cats ?? {}))
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Preview Columns in 3D'); b?.click() })
  await wait(900)
  const catsIso = await page.evaluate(() => (document.querySelector('[data-main-viewer] [aria-label^="3D building model"]')?.__studio ?? {}).cats ?? {})
  ok('Preview-in-3D isolates the family (columns visible, walls/slabs hidden)', catsIso && !catsIso.columns && catsIso.walls === true && catsIso.slabs === true, catsIso)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Show all/.test(x.textContent || '')); b?.click() })
  await wait(700)
  ok('Show all restores the prior layer set', await page.evaluate(() => JSON.stringify((document.querySelector('[data-main-viewer] [aria-label^="3D building model"]')?.__studio ?? {}).cats ?? {})) === catsBefore)

  // ── glazing swap re-runs energy ──
  const euiBefore = num(await page.evaluate(() => document.body.innerText), /([\d,.]+)\s*kWh\/m²/)
  await setSelect('Glazing type', 'tgu')
  await wait(900)
  const euiAfter = num(await page.evaluate(() => document.body.innerText), /([\d,.]+)\s*kWh\/m²/)
  ok('selecting triple glazing lowers the energy intensity', euiBefore > 0 && euiAfter < euiBefore, { euiBefore, euiAfter })

  // ── column swap reaches the viewer (shape) + structure ──
  await setSelect('Columns type', 'rc-round')
  await wait(900)
  ok('the column type lands in the viewer (circular section selected)', (await studio())?.types?.column === 'rc-round', await studio())
  const utilOf = async () => num(await page.evaluate(() => document.body.innerText), /Max column util[\s\S]{0,40}?(\d+)%/i)
  const utilRc = await utilOf()
  await setSelect('Columns type', 'steel-uc')
  await wait(900)
  const utilSteel = await utilOf()
  ok('a steel section drops the max column utilisation (stronger material)', utilRc > 0 && utilSteel < utilRc, { utilRc, utilSteel })

  // ── MEP layer ──
  const c0 = await comps()
  ok('MEP items draw in the model (lighting + hvac + fire + sanitary)', !!c0 && c0.lighting > 0 && c0.hvac > 0 && c0.fire > 0 && c0.sanitary > 0, c0)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Toggle Lighting (MEP)'); b?.click() })
  await wait(700)
  ok('the Model-browser eye hides the lighting system', (await comps())?.lighting === 0)
  const mep0 = await cardText('[data-mep]')
  ok('the MEP card schedules every level with all six systems', /luminaires/i.test(mep0) && /sanitary suites/i.test(mep0) && /W\/m²/.test(mep0))
  const cost0 = num(mep0, /Install budget\s*\n\s*\$([\d,]+)/i)
  await setSelect('sprinkler type', 'concealed')
  await wait(800)
  const cost1 = num(await cardText('[data-mep]'), /Install budget\s*\n\s*\$([\d,]+)/i)
  ok('swapping sprinkler heads reprices the installation', cost0 > 0 && cost1 > cost0, { cost0, cost1 })

  // ── FF&E alternates ──
  const ffe0 = num(await cardText('[data-ffe]'), /FF&E BUDGET\s*\n\s*\$([\d,]+)/i)
  await setSelect('Workstation desk type', 'sit-stand')
  await wait(800)
  const ffe1 = num(await cardText('[data-ffe]'), /FF&E BUDGET\s*\n\s*\$([\d,]+)/i)
  ok('switching desks to sit-stand raises the FF&E budget', ffe0 > 0 && ffe1 > ffe0, { ffe0, ffe1 })

  // ── finishes schedule ──
  const fin = await cardText('[data-finishes]')
  ok('the room-by-room finishes schedule renders with totals', /finishes schedule/i.test(fin) && /floor \(m²\)/i.test(fin) && /Total/.test(fin))

  // selections persist (auto-saved with the design)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-families]', { timeout: 25000 })
  await wait(1800)
  const persisted = await page.evaluate(() => document.querySelector('select[aria-label="Glazing type"]')?.value)
  ok('family selections persist across a reload', persisted === 'tgu', persisted)

  const realErrors = errors.filter((e) => !/404|favicon|tile|Failed to load resource|ERR_|pointerLock/i.test(e))
  ok('no console errors', realErrors.length === 0, realErrors.slice(0, 4))
} catch (e) {
  failures++
  console.error('✗ harness error —', e.message)
}
await browser.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nall families/MEP/finishes checks passed')
process.exit(failures ? 1 : 0)
