/* Headless verification of undo/redo + persistence in the Building Explorer:
 * delete a column, undo/redo it, then reload the page and confirm the edit
 * survived (auto-saved to the project). Run: node scripts/verify-persist.mjs */
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
const cols = () => page.evaluate(() => document.querySelector('[aria-label^="3D building model"]').__components.columns)
const click = (re) => page.evaluate((rs) => { const b = [...document.querySelectorAll('button')].find((x) => new RegExp(rs).test((x.textContent || '').trim())); b?.click(); return !!b }, re.source)
const clickTitle = (t) => page.evaluate((tt) => { const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('title') || '').startsWith(tt)); b?.click(); return !!b }, t)
const waitViewer = async () => { await page.waitForSelector('[aria-label^="3D building model"]', { timeout: 20000 }); await page.waitForFunction(() => !!document.querySelector('[aria-label^="3D building model"]')?.__components, { timeout: 15000 }); await new Promise((r) => setTimeout(r, 1400)) }

try {
  await page.goto(BASE + '/building-explorer', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await waitViewer()
  const N = await cols()
  ok('viewer has columns', N > 0, { N })

  // delete a column
  await click(/^Edit$/); await new Promise((r) => setTimeout(r, 250))
  await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => /^Columns \(/.test((x.textContent || '').trim()))?.click())
  await new Promise((r) => setTimeout(r, 250))
  await page.evaluate(() => document.querySelector('tbody tr')?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  await new Promise((r) => setTimeout(r, 250))
  await click(/Delete/); await new Promise((r) => setTimeout(r, 350))
  ok('delete drops a column', (await cols()) === N - 1)
  ok('auto-saved badge shows the edit count', await page.evaluate(() => /Auto-saved[\s\S]*edit/.test(document.body.innerText)))

  // undo / redo (header buttons)
  await clickTitle('Undo'); await new Promise((r) => setTimeout(r, 300))
  ok('undo restores the column', (await cols()) === N)
  await clickTitle('Redo'); await new Promise((r) => setTimeout(r, 300))
  ok('redo re-applies the delete', (await cols()) === N - 1)

  // reload → edit persisted
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitViewer()
  ok('edit survives a page reload (auto-saved to the project)', (await cols()) === N - 1, { after: await cols(), N })

  const realErrors = errors.filter((e) => !/404|favicon|tile|Failed to load resource|ERR_/i.test(e))
  ok('no console errors', realErrors.length === 0, realErrors.slice(0, 4))
} catch (e) {
  failures++
  console.error('✗ harness error —', e.message)
}
await browser.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nall persistence checks passed')
process.exit(failures ? 1 : 0)
