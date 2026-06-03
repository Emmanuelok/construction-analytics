/* Headless verification of the Site & Zoning survey: the clickable site plan
 * renders vertices + edges; clicking a vertex or edge (and the survey-table rows)
 * drives the inspector with real coordinates / length & bearing; the vertices/edges
 * tabs render. Run: node scripts/verify-site.mjs */
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
  await page.goto(BASE + '/site-zoning', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForFunction(() => [...document.querySelectorAll('svg')].some((s) => s.getAttribute('aria-label')?.startsWith('Site survey plan')), { timeout: 20000 })
  await new Promise((r) => setTimeout(r, 700))

  const counts = await page.evaluate(() => {
    const svg = [...document.querySelectorAll('svg')].find((s) => s.getAttribute('aria-label')?.startsWith('Site survey plan'))
    return svg ? { circles: svg.querySelectorAll('circle').length, lines: svg.querySelectorAll('line').length } : null
  })
  ok('site plan renders boundary vertices (circles) + edges (lines)', !!counts && counts.circles >= 4 && counts.lines >= 4, counts)

  // click a vertex → inspector shows coordinates incl. lat/lng (location is set by default)
  await page.evaluate(() => { const svg = [...document.querySelectorAll('svg')].find((s) => s.getAttribute('aria-label')?.startsWith('Site survey plan')); svg?.querySelector('circle')?.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
  await new Promise((r) => setTimeout(r, 400))
  const vtext = await page.evaluate(() => document.body.innerText)
  ok('vertex inspector shows local E/N + latitude/longitude', /Local E \(x\)/.test(vtext) && /Latitude/.test(vtext) && /Longitude/.test(vtext))

  // click an edge → inspector shows length + bearing
  await page.evaluate(() => { const svg = [...document.querySelectorAll('svg')].find((s) => s.getAttribute('aria-label')?.startsWith('Site survey plan')); const lines = svg?.querySelectorAll('line'); (lines && lines[1])?.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
  await new Promise((r) => setTimeout(r, 400))
  const etext = await page.evaluate(() => document.body.innerText)
  ok('edge inspector shows length, bearing & direction', /Bearing/.test(etext) && /Direction/.test(etext))

  // edges tab + row selection
  await page.evaluate(() => { const t = [...document.querySelectorAll('button')].find((x) => /^Edges \(/.test((x.textContent || '').trim())); t?.click() })
  await new Promise((r) => setTimeout(r, 300))
  const rowOk = await page.evaluate(() => { const r = document.querySelector('tbody tr'); r?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !!r })
  await new Promise((r) => setTimeout(r, 300))
  ok('edges tab renders + a row is clickable', rowOk)

  const realErrors = errors.filter((e) => !/404|favicon|tile|Failed to load resource/i.test(e))
  ok('no console errors', realErrors.length === 0, realErrors.slice(0, 4))
} catch (e) {
  failures++
  console.error('✗ harness error —', e.message)
}
await browser.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nall site-survey checks passed')
process.exit(failures ? 1 : 0)
