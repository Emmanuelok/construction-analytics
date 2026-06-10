/* Headless verification of the studio tools merged into Building Explorer: the model
 * browser (per-category eye toggles), Revit-style visual styles, the section box and
 * the PNG render snapshot — all on /building-explorer. Run: node scripts/verify-studio.mjs */
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
const studio = () => page.evaluate(() => document.querySelector('[aria-label^="3D building model"]')?.__studio ?? null)

try {
  await page.goto(BASE + '/building-explorer', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('[aria-label^="3D building model"]', { timeout: 25000 })
  await new Promise((r) => setTimeout(r, 1800))

  const comps = await page.evaluate(() => document.querySelector('[aria-label^="3D building model"]')?.__components)
  ok('the full anatomy renders (substructure + finishes counted)', !!comps && comps.foundations > 0 && comps.ceilings > 0 && comps.finishes > 0 && comps.columns > 0, comps)

  // model browser: toggling a category hides it in the viewer
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Toggle Columns'); b?.click() })
  await new Promise((r) => setTimeout(r, 500))
  const afterToggle = await studio()
  ok('browser eye toggle hides a category (cats.columns)', !!afterToggle && afterToggle.cats && afterToggle.cats.columns === true, afterToggle)

  // visual styles
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === 'Wireframe'); b?.click() })
  await new Promise((r) => setTimeout(r, 400))
  ok('Wireframe visual style applies', (await studio())?.style === 'wire', await studio())
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === 'X-ray'); b?.click() })
  await new Promise((r) => setTimeout(r, 400))
  ok('X-ray visual style applies', (await studio())?.style === 'xray', await studio())

  // section box
  await page.evaluate(() => {
    const inp = document.querySelector('input[aria-label="Section height"]')
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    set.call(inp, '40'); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await new Promise((r) => setTimeout(r, 500))
  const clipped = await studio()
  ok('section box cuts the model (clipY set)', !!clipped && clipped.clipY != null && clipped.clipY > 0, clipped)

  // render snapshot produces a real PNG
  const png = await page.evaluate(() => { const el = document.querySelector('[aria-label^="3D building model"]'); return el?.__snapshot?.()?.slice(0, 22) })
  ok('render snapshot returns a PNG data URL', png === 'data:image/png;base64,', png)

  const realErrors = errors.filter((e) => !/404|favicon|tile|Failed to load resource|ERR_/i.test(e))
  ok('no console errors', realErrors.length === 0, realErrors.slice(0, 4))
} catch (e) {
  failures++
  console.error('✗ harness error —', e.message)
}
await browser.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nall studio-tool checks passed')
process.exit(failures ? 1 : 0)
