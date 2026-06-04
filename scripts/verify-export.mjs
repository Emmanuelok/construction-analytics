/* Headless verification of model export: clicking OBJ / glTF in the Building
 * Explorer downloads a real .obj (grouped, valid) and a non-empty .glb.
 * Run: node scripts/verify-export.mjs */
import puppeteer from 'puppeteer'
import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.BASE || 'http://localhost:4173/construction-analytics'
const dl = mkdtempSync(join(tmpdir(), 'aec-dl-'))
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] })
let failures = 0
const ok = (n, c, extra) => { if (c) console.log(`✓ ${n}`); else { failures++; console.error(`✗ ${n}`, extra ?? '') } }
const page = await browser.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push(String(e)))
const client = await page.createCDPSession()
await client.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl, eventsEnabled: true })
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('aec-profile', JSON.stringify({ name: 'T', role: 'Architect', disciplines: [], sectors: [], goals: [], experience: 'pro', onboarded: true }))
  sessionStorage.setItem('aec-onb-seen', '1')
})
const waitFile = async (ext, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { const f = readdirSync(dl).find((x) => x.endsWith(ext) && !x.endsWith('.crdownload')); if (f) return join(dl, f); await new Promise((r) => setTimeout(r, 250)) } return null }

try {
  await page.goto(BASE + '/building-explorer', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('[aria-label^="3D building model"]', { timeout: 20000 })
  await new Promise((r) => setTimeout(r, 1500))

  ok('export buttons (IFC / OBJ / glTF / JSON) present', await page.evaluate(() => ['IFC', 'OBJ', 'glTF', 'JSON'].every((t) => [...document.querySelectorAll('button')].some((b) => (b.textContent || '').trim() === t))))

  // IFC4
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === 'IFC')?.click())
  const ifcPath = await waitFile('.ifc')
  ok('IFC file downloads', !!ifcPath, ifcPath)
  if (ifcPath) { const ifc = readFileSync(ifcPath, 'utf8'); ok('IFC is valid IFC4 with storeys + typed products (incl. IfcStair + IfcSpace)', /^ISO-10303-21;/.test(ifc) && /FILE_SCHEMA\(\('IFC4'\)\)/.test(ifc) && /IFCBUILDINGSTOREY\(/.test(ifc) && /IFCCOLUMN\(/.test(ifc) && /IFCWINDOW\(/.test(ifc) && /IFCSTAIR\(/.test(ifc) && /IFCSPACE\(/.test(ifc)) }

  // OBJ
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === 'OBJ')?.click())
  const objPath = await waitFile('.obj')
  ok('OBJ file downloads', !!objPath, objPath)
  if (objPath) { const obj = readFileSync(objPath, 'utf8'); ok('OBJ is a valid grouped mesh (v/f + trades incl. Partitions + InteriorDoors + Stairs)', /\nv /.test(obj) && /\nf /.test(obj) && /\ng Columns/.test(obj) && /\ng Windows/.test(obj) && /\ng Partitions/.test(obj) && /\ng InteriorDoors/.test(obj) && /\ng Stairs/.test(obj)) }

  // glTF (async — GLTFExporter)
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === 'glTF')?.click())
  const glbPath = await waitFile('.glb', 30000)
  ok('glTF (.glb) file downloads', !!glbPath, glbPath)
  if (glbPath) { const sz = statSync(glbPath).size; const head = readFileSync(glbPath).subarray(0, 4).toString('ascii'); ok('glb is non-empty + has the glTF magic header', sz > 1000 && head === 'glTF', { sz, head }) }

  const realErrors = errors.filter((e) => !/404|favicon|tile|Failed to load resource|ERR_/i.test(e))
  ok('no console errors', realErrors.length === 0, realErrors.slice(0, 4))
} catch (e) {
  failures++
  console.error('✗ harness error —', e.message)
}
await browser.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nall export checks passed')
process.exit(failures ? 1 : 0)
