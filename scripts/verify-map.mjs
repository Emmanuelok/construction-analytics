/* Headless verification of the editable Site Map: it mounts; switching to Edit
 * mode renders a draggable handle per boundary vertex; Draw mode collects clicked
 * points; the mode/vertex/draw state is exposed for inspection. Tiles + address
 * search need network (skipped). Run: node scripts/verify-map.mjs */
import puppeteer from 'puppeteer'

const BASE = process.env.BASE || 'http://localhost:4173/construction-analytics'
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] })
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
  await page.goto(BASE + '/site-zoning', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('[aria-label^="Editable site map"]', { timeout: 20000 })
  await new Promise((r) => setTimeout(r, 900))
  const read = () => page.evaluate(() => document.querySelector('[aria-label^="Editable site map"]')?.__sitemap ?? null)

  let st = await read()
  ok('editable map mounts with a boundary (default 4-vertex parcel)', !!st && st.mode === 'move' && st.vertices >= 4, st)
  ok('toolbar exposes Move / Edit / Draw', await page.evaluate(() => ['Move', 'Edit vertices', 'Draw new'].every((t) => [...document.querySelectorAll('button')].some((b) => (b.textContent || '').includes(t)))))

  // Edit vertices → a draggable handle per vertex
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Edit vertices/.test(x.textContent || '')); b?.click() })
  await new Promise((r) => setTimeout(r, 500))
  st = await read()
  const handles = await page.evaluate(() => document.querySelectorAll('.leaflet-marker-icon').length)
  ok('Edit mode renders a draggable handle per boundary vertex', st?.mode === 'edit' && handles >= 4, { st, handles })

  // Draw new → clicking the map collects boundary points
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Draw new/.test(x.textContent || '')); b?.click() })
  await new Promise((r) => setTimeout(r, 300))
  await page.evaluate(() => {
    const c = document.querySelector('.leaflet-container'); const r = c.getBoundingClientRect()
    for (const [dx, dy] of [[-60, -40], [60, -40], [60, 40], [-60, 40]]) c.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + r.width / 2 + dx, clientY: r.top + r.height / 2 + dy }))
  })
  await new Promise((r) => setTimeout(r, 400))
  st = await read()
  ok('Draw mode collects clicked boundary points', st?.mode === 'draw' && st.draw >= 1, st)
  ok('Finish button reflects the drawn point count', await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => /Finish \(\d+\)/.test(b.textContent || ''))))

  const realErrors = errors.filter((e) => !/404|favicon|tile|nominatim|Failed to load resource|ERR_/i.test(e))
  ok('no console errors', realErrors.length === 0, realErrors.slice(0, 4))
} catch (e) {
  failures++
  console.error('✗ harness error —', e.message)
}
await browser.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nall editable-map checks passed')
process.exit(failures ? 1 : 0)
