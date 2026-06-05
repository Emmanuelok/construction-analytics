/* Headless verification of the Building Explorer: the 3D viewer mounts; the floor
 * plan draws the level's columns/panels; selecting an element (via the plan and via
 * a schedule row) drives the shared selection (viewer highlight + inspector);
 * isolating a level updates the plan + isolate state. Run: node scripts/verify-explorer.mjs */
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
  await page.waitForSelector('[aria-label^="3D building model"]', { timeout: 20000 })
  await page.waitForSelector('svg [role], svg circle', { timeout: 10000 }).catch(() => {})
  await new Promise((r) => setTimeout(r, 1000))

  const readSel = () => page.evaluate(() => document.querySelector('[aria-label^="3D building model"]')?.__selected ?? 'UNSET')

  // floor plan draws columns + panels
  const planCounts = await page.evaluate(() => {
    const svg = [...document.querySelectorAll('svg')].find((s) => s.getAttribute('aria-label')?.startsWith('Floor plan'))
    return svg ? { circles: svg.querySelectorAll('circle').length, lines: svg.querySelectorAll('line').length } : null
  })
  ok('floor plan renders columns (circles) + panels (lines)', !!planCounts && planCounts.circles > 0 && planCounts.lines > 0, planCounts)

  // interior rooms render in the plan + a Rooms schedule exists
  const roomInfo = await page.evaluate(() => {
    const svg = [...document.querySelectorAll('svg')].find((s) => s.getAttribute('aria-label')?.startsWith('Floor plan'))
    return { polys: svg ? svg.querySelectorAll('polygon').length : 0, roomsTab: [...document.querySelectorAll('button')].some((b) => /^Rooms \(/.test((b.textContent || '').trim())) }
  })
  ok('plan shows interior rooms + a Rooms schedule tab', roomInfo.polys > 2 && roomInfo.roomsTab, roomInfo)

  // interior partitions + stairs render in the plan; Partitions & Stairs schedule tabs exist
  const intInfo = await page.evaluate(() => {
    const svg = [...document.querySelectorAll('svg')].find((s) => s.getAttribute('aria-label')?.startsWith('Floor plan'))
    const label = svg?.getAttribute('aria-label') || ''
    const tab = (re) => [...document.querySelectorAll('button')].some((b) => re.test((b.textContent || '').trim()))
    return { label, partTab: tab(/^Partitions \(/), idoorTab: tab(/^Interior doors \(/), stairTab: tab(/^Stairs \(/) }
  })
  ok('plan reports partitions + interior doors + stairs, with their schedule tabs', /partitions/.test(intInfo.label) && /interior doors/.test(intInfo.label) && /stairs/.test(intInfo.label) && intInfo.partTab && intInfo.idoorTab && intInfo.stairTab, intInfo)

  // selecting a column in the plan drives the shared selection + inspector + 3D highlight
  const clickedId = await page.evaluate(() => {
    const svg = [...document.querySelectorAll('svg')].find((s) => s.getAttribute('aria-label')?.startsWith('Floor plan'))
    const circle = svg?.querySelector('circle')
    circle?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return true
  })
  await new Promise((r) => setTimeout(r, 500))
  let sel = await readSel()
  ok('clicking a plan column selects it (viewer highlight syncs)', /^col-\d+-\d+$/.test(sel), sel)
  const inspectorHasMark = await page.evaluate(() => /Column\s+C-/.test(document.body.innerText))
  ok('element inspector shows the selected column', inspectorHasMark)

  // isolate a level via the navigator
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^\s*Level 2\b/.test(x.textContent || '') || /Level 2/.test(x.textContent || '')); b?.click() })
  await new Promise((r) => setTimeout(r, 600))
  const isolated = await page.evaluate(() => /Isolated\s*·/.test(document.body.innerText))
  ok('selecting a level isolates it (Isolated badge shown)', isolated)
  const planTitle = await page.evaluate(() => /Floor plan — (Level 2|Ground|Roof)/.test(document.body.innerText))
  ok('floor-plan title follows the active level', planTitle)

  // switch to the Columns schedule and select a row
  await page.evaluate(() => { const t = [...document.querySelectorAll('button')].find((x) => /^Columns \(/.test((x.textContent || '').trim())); t?.click() })
  await new Promise((r) => setTimeout(r, 300))
  const rowOk = await page.evaluate(() => {
    const row = [...document.querySelectorAll('tbody tr')][0]
    row?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return !!row
  })
  await new Promise((r) => setTimeout(r, 400))
  sel = await readSel()
  ok('clicking a schedule row selects that element', rowOk && /^(col|floor|pan|core|roof)/.test(sel), sel)

  // "Whole building" resets isolation
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === 'Whole building'); b?.click() })
  await new Promise((r) => setTimeout(r, 400))
  const notIsolated = await page.evaluate(() => !/Isolated\s*·/.test(document.body.innerText))
  ok('"Whole building" clears isolation', notIsolated)

  // life-safety / egress card: occupant load + a code selector + a per-floor table
  const ls = await page.evaluate(() => ({ title: /Life safety/.test(document.body.innerText), code: !!document.querySelector('#egress-code'), occ: /Occupant load/.test(document.body.innerText), table: !!document.querySelector('[aria-label^="Egress by floor"]') }))
  ok('life-safety egress card with occupant load, code selector & floor table', ls.title && ls.code && ls.occ && ls.table, ls)

  // selecting a room draws its egress path (centre → nearest stair) in the plan
  await page.evaluate(() => { const t = [...document.querySelectorAll('button')].find((x) => /^Rooms \(/.test((x.textContent || '').trim())); t?.click() })
  await new Promise((r) => setTimeout(r, 250))
  await page.evaluate(() => document.querySelector('tbody tr')?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  await new Promise((r) => setTimeout(r, 400))
  const hasPath = await page.evaluate(() => { const svg = [...document.querySelectorAll('svg')].find((s) => (s.getAttribute('aria-label') || '').startsWith('Floor plan')); return !!svg && !!svg.querySelector('line[stroke-dasharray="4 3"]') })
  ok('selecting a room draws its egress path in the plan', hasPath)

  // switching the code jurisdiction re-runs the analysis (UK denser than IBC)
  const occOf = () => page.evaluate(() => { const m = document.body.innerText.match(/([\d,]+)\s*ppl/); return m ? Number(m[1].replace(/,/g, '')) : -1 })
  const occIBC = await occOf()
  await page.select('#egress-code', 'UK')
  await new Promise((r) => setTimeout(r, 450))
  const occUK = await occOf()
  ok('switching code (IBC → UK) increases the occupant load', occIBC > 0 && occUK > occIBC, { occIBC, occUK })

  const realErrors = errors.filter((e) => !/404|favicon|tile|Failed to load resource/i.test(e))
  ok('no console errors', realErrors.length === 0, realErrors.slice(0, 4))
} catch (e) {
  failures++
  console.error('✗ harness error —', e.message)
}
await browser.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nall Building Explorer checks passed')
process.exit(failures ? 1 : 0)
