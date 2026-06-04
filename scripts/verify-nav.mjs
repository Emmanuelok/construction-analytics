/* Headless verification of Revit-style navigation in the building viewer: orbit
 * (drag), pan (right-drag), zoom (wheel), and fit (F). Reads the viewer's __view
 * debug hook. Run: node scripts/verify-nav.mjs */
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
const view = () => page.evaluate(() => document.querySelector('[aria-label^="3D building model"]')?.__view ?? null)
const rect = () => page.evaluate(() => { const el = document.querySelector('[aria-label^="3D building model"]'); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height } })

try {
  await page.goto(BASE + '/building-explorer', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('[aria-label^="3D building model"]', { timeout: 20000 })
  await page.waitForFunction(() => !!document.querySelector('[aria-label^="3D building model"]')?.__view, { timeout: 10000 })
  await new Promise((r) => setTimeout(r, 1500))

  const v0 = await view(); const R = await rect()
  ok('viewer frames the building (sane radius)', v0 && v0.radius > 0 && v0.radius < 4000, v0)
  ok('canvas is large (>= 520px tall)', R.h >= 520, R)

  // orbit: left-drag changes azimuth
  await page.evaluate(({ x, y }) => { const el = document.querySelector('[aria-label^="3D building model"]').querySelector('canvas') || document.querySelector('[aria-label^="3D building model"]'); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: x, clientY: y })) }, R)
  await page.evaluate(({ x, y }) => { window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x + 120, clientY: y })) }, R)
  await page.evaluate(({ x, y }) => { window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x + 120, clientY: y })) }, R)
  await new Promise((r) => setTimeout(r, 200))
  const v1 = await view()
  ok('orbit: dragging changes the azimuth', Math.abs(v1.az - v0.az) > 0.3, { az0: v0.az, az1: v1.az })

  // pan: right-drag moves the target
  await page.evaluate(({ x, y }) => { const el = document.querySelector('[aria-label^="3D building model"]').querySelector('canvas') || document.querySelector('[aria-label^="3D building model"]'); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 2, clientX: x, clientY: y })) }, R)
  await page.evaluate(({ x, y }) => { window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x + 90, clientY: y + 60 })) }, R)
  await page.evaluate(({ x, y }) => { window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x + 90, clientY: y + 60 })) }, R)
  await new Promise((r) => setTimeout(r, 200))
  const v2 = await view()
  ok('pan: right-drag moves the camera target', Math.abs(v2.tx - v1.tx) + Math.abs(v2.ty - v1.ty) + Math.abs(v2.tz - v1.tz) > 0.5, { v1, v2 })

  // zoom: wheel changes radius
  await page.evaluate(({ x, y }) => { const el = document.querySelector('[aria-label^="3D building model"]').querySelector('canvas') || document.querySelector('[aria-label^="3D building model"]'); el.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 300, clientX: x, clientY: y })) }, R)
  await new Promise((r) => setTimeout(r, 150))
  const v3 = await view()
  ok('zoom: scrolling changes the radius', Math.abs(v3.radius - v2.radius) > 0.5, { r2: v2.radius, r3: v3.radius })

  // fit: pressing F re-frames (radius back near the initial fit, target re-centred)
  await page.evaluate(() => document.querySelector('[aria-label^="3D building model"]').dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'f' })))
  await new Promise((r) => setTimeout(r, 200))
  const v4 = await view()
  ok('fit: F re-frames the building (re-centres the target)', Math.abs(v4.tx) < 0.1 && Math.abs(v4.tz) < 0.1, v4)

  const realErrors = errors.filter((e) => !/404|favicon|tile|Failed to load resource|ERR_/i.test(e))
  ok('no console errors', realErrors.length === 0, realErrors.slice(0, 4))
} catch (e) {
  failures++
  console.error('✗ harness error —', e.message)
}
await browser.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nall navigation checks passed')
process.exit(failures ? 1 : 0)
