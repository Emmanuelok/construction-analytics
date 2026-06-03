/* Headless verification of the building sun & shadow study.
 * Confirms: the component viewer mounts with shadow mapping + a sun-positioned
 * light; the __sun debug hook reflects the solar position (high summer sun casts
 * shadows, night sun is dimmed with shadows off); driving the controls changes the
 * sun. Run: node scripts/verify-sun.mjs (expects preview on $BASE). */
import puppeteer from 'puppeteer'

const BASE = process.env.BASE || 'http://localhost:4173/construction-analytics'
const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
})
let failures = 0
const ok = (n, c, extra) => { if (c) console.log(`✓ ${n}`); else { failures++; console.error(`✗ ${n}`, extra ?? '') } }

const page = await browser.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('aec-profile', JSON.stringify({ name: 'Test', role: 'Architect', disciplines: [], sectors: [], goals: [], experience: 'pro', onboarded: true }))
  sessionStorage.setItem('aec-onb-seen', '1')
})

try {
  await page.goto(BASE + '/project', { waitUntil: 'domcontentloaded', timeout: 30000 })
  // wait for the component building viewer (lazy) + its __sun hook to attach
  await page.waitForSelector('[aria-label^="3D building model with components"]', { timeout: 20000 })
  const readSun = () => page.evaluate(() => {
    const el = document.querySelector('[aria-label^="3D building model with components"]')
    return el ? { sun: el.__sun, components: el.__components } : null
  })
  // give the rAF loop + applySun a few frames
  await new Promise((r) => setTimeout(r, 1200))
  let state = await readSun()
  ok('component viewer mounted with __components + __sun hooks', !!state && !!state.sun && !!state.components, state)
  ok('builds real components (slabs, columns, glazing > 0)', state.components.slabs > 0 && state.components.columns > 0 && state.components.glazing > 0, state.components)

  // default = summer (Jun) ~1pm, shadows on → sun above horizon, casting shadows, light above ground
  ok('summer midday sun casts shadows (castShadow true)', state.sun.castShadow === true, state.sun)
  ok('sun light is above the ground (y > 0)', state.sun.y > 0, state.sun)
  ok('daytime intensity is bright (> 1)', state.sun.intensity > 1, state.sun)

  // read the on-screen sun readout (altitude/azimuth)
  const readoutDay = await page.evaluate(() => document.body.innerText.match(/Altitude\s+[-\d.]+°/)?.[0] || document.body.innerText)
  ok('sun readout shows an altitude', /Altitude\s+[-\d.]+°/.test(readoutDay), readoutDay)

  // Drive "Time (solar)" slider to midnight → sun below horizon, shadows drop, scene dims.
  const moved = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('span')].filter((s) => s.textContent?.trim().startsWith('Time (solar)'))
    const wrap = labels[0]?.closest('div')?.parentElement || labels[0]?.parentElement
    const input = wrap?.querySelector('input[type="range"]') || [...document.querySelectorAll('input[type="range"]')].pop()
    if (!input) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, '0')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  })
  ok('found + moved the Time (solar) slider', moved)
  await new Promise((r) => setTimeout(r, 800))
  state = await readSun()
  ok('midnight sun is below horizon → no shadows', state.sun.castShadow === false, state.sun)
  ok('night intensity is dim (< 0.2)', state.sun.intensity < 0.2, state.sun)
  const nightText = await page.evaluate(() => document.body.innerText)
  ok('night readout shown ("below the horizon")', /below the horizon/i.test(nightText))

  // Toggle shadows off (back at a daytime hour first via the slider) — verify the toggle controls castShadow.
  await page.evaluate(() => {
    const input = [...document.querySelectorAll('input[type="range"]')].pop()
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, '12'); input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await new Promise((r) => setTimeout(r, 400))
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Shadows (on|off)/.test(x.textContent || '')); b?.click() })
  await new Promise((r) => setTimeout(r, 500))
  state = await readSun()
  ok('Shadows-off toggle disables shadow casting at midday', state.sun.castShadow === false, state.sun)

  const realErrors = errors.filter((e) => !/404|favicon|tile|Failed to load resource/i.test(e))
  ok('no console errors', realErrors.length === 0, realErrors.slice(0, 4))
} catch (e) {
  failures++
  console.error('✗ harness error —', e.message)
}
await browser.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nall sun/shadow checks passed')
process.exit(failures ? 1 : 0)
