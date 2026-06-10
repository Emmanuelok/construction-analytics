/* Headless verification of the Room / Floor Studio on /building-explorer: opening a
 * floor in the studio (isolated + framed preview, floor takeoff, floor-wide re-finish),
 * and selecting a room (focused preview, re-programme the use → occupancy updates,
 * resize → area updates, render a PNG). Run: node scripts/verify-room.mjs */
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
// the studio preview is a second viewer scoped to [data-studio-preview]
const previewStudio = () => page.evaluate(() => document.querySelector('[data-studio-preview] [aria-label^="3D building model"]')?.__studio ?? null)
// read a takeoff stat value by its label (StudioStat data attributes)
const stat = (label) => page.evaluate((l) => document.querySelector(`[data-studio] [data-stat="${l}"]`)?.getAttribute('data-stat-value') ?? null, label)
const num = (s) => (s == null ? NaN : Number(String(s).replace(/[^0-9.]/g, '')))
const setSelect = (ariaLabel, value) => page.evaluate(({ a, v }) => {
  const el = document.querySelector(`select[aria-label="${a}"]`); if (!el) return false
  const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
  set.call(el, v); el.dispatchEvent(new Event('change', { bubbles: true })); return true
}, { a: ariaLabel, v: value })
const clickByText = (text) => page.evaluate((t) => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === t); if (b) { b.click(); return true } return false }, text)

try {
  await page.goto(BASE + '/building-explorer', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('[aria-label^="3D building model"]', { timeout: 25000 })
  await wait(1800)

  // ── Floor Studio: open a floor from the Levels list ──
  const opened = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Floor Studio/.test(x.getAttribute('aria-label') || '')); if (b) { b.click(); return true } return false })
  ok('a Floor Studio launcher exists on each level', opened)
  await page.waitForSelector('[data-studio-preview]', { timeout: 20000 })
  await wait(1600)
  const fs = await previewStudio()
  ok('floor studio preview isolates + frames the floor (focus region set)', !!fs && fs.focus && typeof fs.focus.level === 'number' && fs.focus.maxX > fs.focus.minX, fs)
  ok('floor takeoff shows occupancy + area + rooms', num(await stat('Occupancy')) >= 0 && num(await stat('Floor area')) > 0 && num(await stat('Rooms')) > 0)

  // floor-wide re-finish raises the indicative fit-out cost (standard → premium)
  const costBefore = num(await stat('Fit-out'))
  await setSelect('Re-finish all rooms on this floor', 'premium')
  await wait(700)
  const costAfter = num(await stat('Fit-out'))
  ok('floor-wide re-finish recomputes the fit-out cost (premium > standard)', costAfter > costBefore, { costBefore, costAfter })

  // render a PNG from the studio preview
  const png = await page.evaluate(() => document.querySelector('[data-studio-preview] [aria-label^="3D building model"]')?.__snapshot?.()?.slice(0, 22))
  ok('studio preview render snapshot returns a PNG data URL', png === 'data:image/png;base64,', png)

  // ── Room Studio: select a room in the plan ──
  const roomPicked = await page.evaluate(() => { const g = document.querySelector('[data-room]'); if (g) { g.dispatchEvent(new MouseEvent('click', { bubbles: true })); return g.getAttribute('data-room') } return null })
  ok('a room can be selected from the floor plan', !!roomPicked, roomPicked)
  await wait(1400)
  const rs = await previewStudio()
  ok('room studio preview isolates + frames the room (focus region set)', !!rs && rs.focus && typeof rs.focus.level === 'number' && rs.focus.maxX > rs.focus.minX, rs)
  const hasForm = await page.evaluate(() => /Modify space/i.test(document.querySelector('[data-studio]')?.innerText || ''))
  ok('room studio shows the Modify-space form', hasForm)

  // re-programme the use to a denser one → occupancy rises
  const occBefore = num(await stat('Occupancy'))
  await setSelect('Room use', 'meeting')
  await wait(700)
  const occAfter = num(await stat('Occupancy'))
  ok('re-programming the use updates occupancy (meeting denser than office)', occAfter > occBefore, { occBefore, occAfter })

  // resize bigger → floor area rises
  const areaBefore = num(await stat('Floor area'))
  await clickByText('Bigger')
  await wait(700)
  const areaAfter = num(await stat('Floor area'))
  ok('resizing the room bigger updates its area', areaAfter > areaBefore, { areaBefore, areaAfter })

  // close the studio
  await clickByText('Close')
  await wait(400)
  const closed = await page.evaluate(() => !document.querySelector('[data-studio]'))
  ok('closing the studio dismisses the panel', closed)

  const realErrors = errors.filter((e) => !/404|favicon|tile|Failed to load resource|ERR_/i.test(e))
  ok('no console errors', realErrors.length === 0, realErrors.slice(0, 4))
} catch (e) {
  failures++
  console.error('✗ harness error —', e.message)
}
await browser.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nall Room/Floor Studio checks passed')
process.exit(failures ? 1 : 0)
