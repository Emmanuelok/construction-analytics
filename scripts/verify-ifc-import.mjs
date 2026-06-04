/* Headless verification of IFC import → editable model: in the Building Explorer,
 * switch to the IFC source, load the sample model, click "Edit as model", and confirm
 * the uploaded IFC is rationalized into the editable parametric model — the 3D viewer
 * mounts, the import banner + schedules show real elements, and an element can be
 * deleted (the model is genuinely editable). Run: node scripts/verify-ifc-import.mjs */
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
const clickText = (txt) => page.evaluate((t) => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim().includes(t)); if (b) { b.click(); return true } return false }, txt)
const hasText = (re) => page.evaluate((src) => new RegExp(src).test(document.body.innerText), re.source)

try {
  await page.goto(BASE + '/building-explorer', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('[aria-label^="3D building model"]', { timeout: 20000 })

  // switch to the IFC source + load the sample IFC
  ok('switched to the IFC model source', await clickText('IFC model'))
  await new Promise((r) => setTimeout(r, 400))
  ok('loaded the sample IFC', await clickText('Load sample model'))

  // wait for tessellation → the "Edit as model" button appears
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /Edit as model/.test(b.textContent || '')), { timeout: 40000 })
  ok('IFC tessellated; "Edit as model" offered', true)

  // rationalize the IFC into the editable model
  ok('clicked "Edit as model"', await clickText('Edit as model'))
  await page.waitForSelector('[aria-label^="3D building model"]', { timeout: 20000 })
  await new Promise((r) => setTimeout(r, 1200))

  ok('the import banner shows we are editing the imported model', await hasText(/Editing imported model/))
  ok('the imported model rendered components in 3D', await page.evaluate(() => {
    const c = document.querySelector('[aria-label^="3D building model"]')?.__components
    return !!c && (c.columns + c.windows + c.slabs) > 0
  }))

  // schedules carry the imported elements; the editor can delete one
  await page.evaluate(() => { const t = [...document.querySelectorAll('button')].find((x) => /^Columns \(/.test((x.textContent || '').trim())); t?.click() })
  await new Promise((r) => setTimeout(r, 300))
  const rows0 = await page.evaluate(() => document.querySelectorAll('tbody tr').length)
  ok('imported model produces a Columns schedule with rows', rows0 > 0, { rows0 })

  // select the first column row, enable Edit, delete it
  await page.evaluate(() => document.querySelector('tbody tr')?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  await new Promise((r) => setTimeout(r, 300))
  await clickText('Edit')
  await new Promise((r) => setTimeout(r, 200))
  ok('clicked Delete on the selected imported element', await clickText('Delete'))
  await new Promise((r) => setTimeout(r, 400))
  const rows1 = await page.evaluate(() => { const t = [...document.querySelectorAll('button')].find((x) => /^Columns \(/.test((x.textContent || '').trim())); return t ? Number((t.textContent.match(/\((\d+)\)/) || [])[1]) : -1 })
  ok('deleting an imported element updates the schedule (count −1)', rows1 === rows0 - 1, { rows0, rows1 })

  // the inspector carries the original IFC name + type for an imported element
  await page.evaluate(() => document.querySelector('tbody tr')?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  await new Promise((r) => setTimeout(r, 300))
  ok('inspector shows the original IFC source (name · type)', await hasText(/IFC source/))

  // persistence: reload keeps the imported model (IndexedDB)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[aria-label^="3D building model"]', { timeout: 20000 })
  await new Promise((r) => setTimeout(r, 1300))
  ok('the imported model persists across a reload (IndexedDB)', await hasText(/Editing imported model/))

  // back to the generated model + discard the persisted import
  ok('can return to the generated model', await clickText('Back to generated'))
  await new Promise((r) => setTimeout(r, 500))
  ok('generated model parameters return', await hasText(/Model parameters/))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[aria-label^="3D building model"]', { timeout: 20000 })
  await new Promise((r) => setTimeout(r, 1000))
  ok('discarding the import clears it permanently (gone after reload)', !(await hasText(/Editing imported model/)) && (await hasText(/Model parameters/)))

  const realErrors = errors.filter((e) => !/404|favicon|tile|Failed to load resource|ERR_/i.test(e))
  ok('no console errors', realErrors.length === 0, realErrors.slice(0, 4))
} catch (e) {
  failures++
  console.error('✗ harness error —', e.message)
}
await browser.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nall IFC-import checks passed')
process.exit(failures ? 1 : 0)
