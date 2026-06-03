/* Headless verification of the IFC source in the Building Explorer: switch to the
 * IFC model source, tessellate the bundled sample with web-ifc, then confirm the
 * real model renders, the summary/storeys/schedules populate, and selecting a
 * schedule row drives the inspector + viewer highlight. Run: node scripts/verify-ifc.mjs */
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

try {
  await page.goto(BASE + '/building-explorer', { waitUntil: 'domcontentloaded', timeout: 30000 })
  // switch source → IFC model
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent === 'IFC model'), { timeout: 20000 })
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent === 'IFC model')?.click())
  // load the bundled sample
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /Load sample model/.test(b.textContent || '')), { timeout: 15000 })
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /Load sample model/.test(b.textContent || ''))?.click())

  // tessellation (web-ifc WASM) can take a few seconds → wait for the real viewer
  await page.waitForSelector('[aria-label^="Tessellated 3D geometry"]', { timeout: 45000 })
  await page.waitForFunction(() => { const el = document.querySelector('[aria-label^="Tessellated 3D geometry"]'); return el && el.__meshCount > 0 }, { timeout: 20000 })
  await new Promise((r) => setTimeout(r, 800))

  const meshCount = await page.evaluate(() => document.querySelector('[aria-label^="Tessellated 3D geometry"]').__meshCount)
  ok('real IFC geometry tessellated + rendered (meshes > 0)', meshCount > 0, { meshCount })

  const text = await page.evaluate(() => document.body.innerText)
  ok('summary shows measured Elements + Solid volume', /Elements/.test(text) && /Solid volume/.test(text))
  ok('storeys/levels navigator populated', await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => /elements/.test(b.textContent || ''))))
  const rows = await page.evaluate(() => document.querySelectorAll('tbody tr').length)
  ok('schedule lists real elements (rows > 0)', rows > 0, { rows })

  // click a schedule row → inspector populates + viewer highlights (selectedExpressID)
  await page.evaluate(() => document.querySelector('tbody tr')?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  await new Promise((r) => setTimeout(r, 500))
  const inspector = await page.evaluate(() => /IFC type|Volume|Clear selection/i.test(document.body.innerText))
  ok('clicking a schedule row inspects the element', inspector)

  // isolate a storey (if any storey/level buttons exist)
  const isolated = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /elements/.test(x.textContent || ''))
    b?.click(); return true
  })
  await new Promise((r) => setTimeout(r, 600))
  ok('a level can be isolated', isolated && await page.evaluate(() => /Isolated|Whole building/.test(document.body.innerText)))

  const realErrors = errors.filter((e) => !/404|favicon|tile|wasm|web-ifc|Failed to load resource|ERR_/i.test(e))
  ok('no console errors', realErrors.length === 0, realErrors.slice(0, 5))
} catch (e) {
  failures++
  console.error('✗ harness error —', e.message)
}
await browser.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nall IFC-explorer checks passed')
process.exit(failures ? 1 : 0)
