/* Headless verification of direct-manipulation editing in the Building Explorer:
 * enter Edit mode, then move / delete / duplicate a column and resize a window —
 * confirming the live model (component counts) and inspector update, and Reset
 * restores the generated model. Run: node scripts/verify-edit.mjs */
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

const comps = () => page.evaluate(() => document.querySelector('[aria-label^="3D building model"]').__components)
const clickBtn = (re) => page.evaluate((rs) => { const b = [...document.querySelectorAll('button')].find((x) => new RegExp(rs).test((x.textContent || '').trim())); if (b) { b.click(); return true } return false }, re.source)
const clickTab = (name) => page.evaluate((n) => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim().startsWith(n + ' (')); b?.click() }, name)
const clickRow = () => page.evaluate(() => document.querySelector('tbody tr')?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
const inspectorVal = (label) => page.evaluate((lbl) => { const dt = [...document.querySelectorAll('dt')].find((d) => (d.textContent || '').trim() === lbl); return dt ? (dt.nextElementSibling?.textContent || '').trim() : null }, label)

try {
  await page.goto(BASE + '/building-explorer', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('[aria-label^="3D building model"]', { timeout: 20000 })
  await new Promise((r) => setTimeout(r, 1600))
  const base = await comps()
  ok('building loaded with columns + windows', base.columns > 0 && base.windows > 0, base)

  ok('Edit mode toggles on', await clickBtn(/^Edit$/))
  await new Promise((r) => setTimeout(r, 300))

  // select a column → move it
  await clickTab('Columns'); await new Promise((r) => setTimeout(r, 250)); await clickRow(); await new Promise((r) => setTimeout(r, 300))
  const x0 = await inspectorVal('X (E)')
  await clickBtn(/^X ▶$/); await new Promise((r) => setTimeout(r, 350))
  const x1 = await inspectorVal('X (E)')
  ok('move: nudging a column changes its X in the inspector', x0 != null && x1 != null && x0 !== x1, { x0, x1 })

  // delete it
  await clickBtn(/Delete/); await new Promise((r) => setTimeout(r, 400))
  ok('delete: column count drops by 1, live', (await comps()).columns === base.columns - 1, await comps())

  // duplicate a column
  await clickTab('Columns'); await new Promise((r) => setTimeout(r, 250)); await clickRow(); await new Promise((r) => setTimeout(r, 250))
  await clickBtn(/Duplicate/); await new Promise((r) => setTimeout(r, 400))
  ok('duplicate: column count restored (+1), live', (await comps()).columns === base.columns, await comps())

  // resize a window → its width updates in the inspector + schedule
  await clickTab('Windows'); await new Promise((r) => setTimeout(r, 250)); await clickRow(); await new Promise((r) => setTimeout(r, 300))
  const wd0 = await inspectorVal('Width')
  await clickBtn(/^Smaller$/); await new Promise((r) => setTimeout(r, 350))
  const wd1 = await inspectorVal('Width')
  ok('resize: shrinking a window reduces its width, live', wd0 != null && wd1 != null && parseFloat(wd1) < parseFloat(wd0), { wd0, wd1 })

  // reset restores the generated model
  await clickBtn(/^Reset/); await new Promise((r) => setTimeout(r, 500))
  const after = await comps()
  ok('reset: restores generated columns + windows', after.columns === base.columns && after.windows === base.windows, { base, after })

  const realErrors = errors.filter((e) => !/404|favicon|tile|Failed to load resource|ERR_/i.test(e))
  ok('no console errors', realErrors.length === 0, realErrors.slice(0, 4))
} catch (e) {
  failures++
  console.error('✗ harness error —', e.message)
}
await browser.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nall editor checks passed')
process.exit(failures ? 1 : 0)
