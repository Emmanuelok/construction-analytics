/* Headless verification of the Connections hub export path: in Studio engines, pick
 * export_building, generate an IFC, and confirm the hub returns a real, downloadable
 * model file. This is the "pull the generated model programmatically" surface — the
 * same runTool the MCP server + APS publish use. Run: node scripts/verify-connections.mjs */
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
  await page.goto(BASE + '/connections', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForFunction(() => /Studio engines/.test(document.body.innerText), { timeout: 20000 })

  // the Studio engines card exposes export_building in its tool picker
  const hasExport = await page.evaluate(() => [...document.querySelectorAll('select option')].some((o) => o.value === 'export_building'))
  ok('Studio engines lists the export_building tool', hasExport)

  // select export_building on the first (Studio engines) tool picker
  await page.evaluate(() => {
    const sel = document.querySelector('select')
    if (sel) { sel.value = 'export_building'; sel.dispatchEvent(new Event('change', { bubbles: true })) }
  })
  await new Promise((r) => setTimeout(r, 400))

  // fill the form inputs (gfa, storeys, format) — match by the label text
  const setField = (name, value) => page.evaluate((n, v) => {
    const lab = [...document.querySelectorAll('label')].find((l) => (l.querySelector('span')?.textContent || '').trim().startsWith(n))
    const inp = lab?.querySelector('input,select,textarea')
    if (!inp) return false
    const proto = inp.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(inp, v)
    inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  }, name, value)
  ok('filled GFA', await setField('gfa', '40000'))
  await setField('storeys', '6')
  await setField('format', 'ifc')

  // Run the tool
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /\bRun\b/.test(x.textContent || '')); b?.click() })
  await page.waitForFunction(() => /ISO-10303-21;/.test(document.body.innerText), { timeout: 15000 })
  ok('export_building returned a real IFC4 model in the hub', true)

  const dl = await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => /Download IFC/i.test(b.textContent || '')))
  ok('a Download IFC button is offered for the generated file', dl)
  // the result panel reports it as a real file (name + byte count); full content downloads
  const fileLine = await page.evaluate(() => /\.ifc · [\d,]+ bytes/.test(document.body.innerText))
  ok('the hub reports a real model file (filename + byte size)', fileLine)

  const realErrors = errors.filter((e) => !/404|favicon|tile|Failed to load resource|ERR_|aps-data|\/api\/mcp/i.test(e))
  ok('no console errors', realErrors.length === 0, realErrors.slice(0, 4))
} catch (e) {
  failures++
  console.error('✗ harness error —', e.message)
}
await browser.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nall Connections export checks passed')
process.exit(failures ? 1 : 0)
