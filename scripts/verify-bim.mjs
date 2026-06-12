/* Headless verification of the BIM Intelligence revamp on /bim: parse the geometry
 * sample → storeys tile populated (was 0), the plain-language explainer + health
 * check render with a grade and "why it matters" copy, the composition translates
 * raw classes into groups (with a raw toggle), the audit CSV is offered, and the
 * Building Explorer hand-off link exists. Run: node scripts/verify-bim.mjs */
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
  localStorage.setItem('aec-profile', JSON.stringify({ name: 'T', role: 'BIM manager', disciplines: [], sectors: [], goals: [], experience: 'pro', onboarded: true }))
  sessionStorage.setItem('aec-onb-seen', '1')
})
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const text = (sel) => page.evaluate((s) => document.querySelector(s)?.innerText || '', sel)

try {
  await page.goto(BASE + '/bim', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await wait(1200)
  ok('the page explains itself in plain language', /universal BIM format|plain language/i.test(await page.evaluate(() => document.body.innerText)))

  // parse the geometry sample
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Sample with geometry/.test(x.textContent || '')); b?.click() })
  await wait(2500)
  const body = await page.evaluate(() => document.body.innerText)
  ok('the sample parses with a real spatial structure (4 storeys, was 0)', /Storeys\s*\n\s*4/.test(body), body.match(/Storeys[\s\S]{0,12}/)?.[0])
  ok('tiles read in plain language (records / building elements)', /Records in the file/i.test(body) && /Building elements/i.test(body))

  // explainer strip
  const exp = await text('[data-bim-explainer]')
  ok('the “how to read an IFC” explainer renders', /database, not a picture/i.test(exp) && /spatial tree/i.test(exp))

  // health check
  const health = await text('[data-bim-health]')
  ok('the model-health check grades the file', /Model health — \d+\/100/.test(health) && /Grade [A-E]/.test(health))
  ok('findings pass the good checks on the fixed sample', /Spatial structure present/i.test(health) && /placed in storeys/i.test(health) && /real 3D geometry/i.test(health))
  ok('types, psets and spaces pass on the generated sample', /follow named types/i.test(health) && /Property sets attached/i.test(health) && /spaces/i.test(health))
  ok('what it lacks is reported honestly, with plain “why it matters” copy', /No embedded quantities|No materials/i.test(health) && /Why it matters:/.test(health))
  ok('the audit CSV export is offered', await page.evaluate(() => !!document.querySelector('[data-bim-health] button')))

  // the 3D model is a real structure now — wait for web-ifc to tessellate it
  await page.waitForFunction(() => /Tessellated geometry/.test(document.body.innerText), { timeout: 90000 })
  const solids = await page.evaluate(() => { const m = document.body.innerText.match(/Tessellated geometry · ([\d,]+) solids/); return m ? Number(m[1].replace(/,/g, '')) : 0 })
  ok('web-ifc tessellates a complete structure (hundreds of solids, not a mock-up)', solids > 250, solids)

  // ── the geometry workbench on the real model ──
  const viewer = () => page.evaluate(() => document.querySelector('[data-bim-viewer] [role="application"]')?.parentElement ? (document.querySelector('[data-bim-viewer] [role="application"]')).__viewer ?? null : null)
  const meshCount = async () => (await viewer())?.meshCount ?? 0
  const base = await meshCount()
  ok('the viewer reports its mesh count via the state hook', base > 250, base)
  // visual style
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === 'xray'); b?.click() })
  await wait(500)
  ok('visual styles apply to the real geometry (x-ray)', (await viewer())?.style === 'xray')
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === 'realistic'); b?.click() })
  await wait(300)
  // storey isolation
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^Level 2$/.test((x.textContent || '').trim())); b?.click() })
  await wait(700)
  const iso = await meshCount()
  ok('storey chips isolate one level (mesh count drops)', iso > 20 && iso < base, { base, iso })
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === 'All'); b?.click() })
  await wait(600)
  // class layer toggle
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^window \d+$/.test((x.textContent || '').trim().replace(/\s+/g, ' '))); b?.click() })
  await wait(600)
  const noWin = await meshCount()
  ok('class chips hide a layer (windows off)', noWin < base, { base, noWin })
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^window \d+$/.test((x.textContent || '').trim().replace(/\s+/g, ' '))); b?.click() })
  await wait(400)
  // fly-through
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Fly-through/.test(x.textContent || '')); b?.click() })
  await wait(800)
  const w0 = (await viewer())?.walk
  ok('the fly-through enters at eye height inside the model', !!w0 && w0.active === true && w0.y > 0.5, w0)
  await page.keyboard.down('w'); await wait(700); await page.keyboard.up('w')
  const w1 = (await viewer())?.walk
  ok('WASD moves the walker through the structure', !!w1 && (Math.abs(w1.x - w0.x) > 0.05 || Math.abs(w1.z - w0.z) > 0.05), { w0, w1 })
  await page.keyboard.press('e'); await wait(400)
  ok('E rides up a floor', ((await viewer())?.walk?.floor ?? 0) === 1)
  await page.keyboard.press('Escape'); await wait(500)
  ok('Esc exits the fly-through', ((await viewer())?.walk?.active ?? true) === false)
  // takeoff + clash cards
  const take = await text('[data-bim-takeoff]')
  ok('the geometry takeoff measures the anatomy per class', /Slab/.test(take) && /Column/.test(take) && /Window/.test(take) && /CSV/.test(take))
  const clash = await text('[data-bim-clash]')
  ok('the geometric clash check runs on the real meshes (clean model = clear)', /Geometric clash check/.test(clash) && /coordinated|clear/i.test(clash) && /suppressed/i.test(clash))
  ok('the clash check uses the triangle-accurate narrow phase + offers BCF', /triangle-accurate narrow phase/i.test(clash) && /Hard\b/.test(clash) && /BCF opens the issue list/i.test(clash))
  // render PNG hook exists
  ok('a render snapshot is available from the viewer', await page.evaluate(() => typeof document.querySelector('[data-bim-viewer] [role="application"]')?.__snapshot === 'function'))

  // composition
  const compT = await text('[data-bim-composition]')
  ok('records translate into relatable groups', /Geometry plumbing/i.test(compT) && /Building elements/i.test(compT) && /Relationships/i.test(compT))
  ok('plain labels replace raw classes (Points, not IFCCARTESIANPOINT)', /Points \(coordinates\)/i.test(compT) && !/IFCCARTESIANPOINT/.test(compT))
  await page.evaluate(() => { const b = [...document.querySelectorAll('[data-bim-composition] button')].find((x) => /raw IFC class names/i.test(x.textContent || '')); b?.click() })
  await wait(400)
  ok('the raw-class toggle reveals the pro view', /IFCCARTESIANPOINT/.test(await text('[data-bim-composition]')))
  ok('the Building Explorer hand-off is linked', await page.evaluate(() => !!document.querySelector('[data-bim-composition] a[href*="building-explorer"]')))

  // the clash workbench below still computes
  ok('the clash workbench renders with a live health score', /Model health/.test(body) && /Open clashes/.test(body) && /Resolution rate/.test(body))

  const realErrors = errors.filter((e) => !/404|favicon|tile|Failed to load resource|ERR_|pointerLock/i.test(e))
  ok('no console errors', realErrors.length === 0, realErrors.slice(0, 4))
} catch (e) {
  failures++
  console.error('✗ harness error —', e.message)
}
await browser.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nall BIM Intelligence checks passed')
process.exit(failures ? 1 : 0)
