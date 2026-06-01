/* Browser-only: hand web-ifc the URL of its WASM kernel. The `?url` import makes
 * Vite emit web-ifc.wasm as a hashed asset (served correctly under the app's base
 * path) and gives us the final URL — no manual copy into public/, no hard-coded
 * base. Passed to extractGeometry's `locateFile`. Never imported by Node tests
 * (tsx can't resolve the `?url` query); the test path uses `wasmPath` instead.
 *
 * The path is relative into node_modules rather than a bare `web-ifc/...` import
 * because web-ifc's package `exports` map only exposes the JS entry, so a deep
 * specifier won't resolve — a relative file path sidesteps that restriction. */
import wasmUrl from '../../node_modules/web-ifc/web-ifc.wasm?url'

/** Locate handler for IfcAPI.Init — map the kernel filename to the Vite asset. */
export function locateWasm(path: string, prefix: string): string {
  return path.endsWith('.wasm') ? wasmUrl : prefix + path
}
