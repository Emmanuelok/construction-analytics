import { useEffect, useRef, useState } from 'react'
import { apsViewerScript, apsViewerCss } from '@/lib/aps'
import { viewerToken } from '@/lib/aps-client'

type AutodeskGlobal = { Viewing: Record<string, unknown> }
declare global { interface Window { Autodesk?: AutodeskGlobal } }

let sdkPromise: Promise<void> | null = null
/** Load the Autodesk Viewer SDK from APS's CDN once (no npm dependency). */
function loadViewerSdk(): Promise<void> {
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise<void>((resolve, reject) => {
    if (window.Autodesk?.Viewing) return resolve()
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = apsViewerCss; document.head.appendChild(css)
    const s = document.createElement('script'); s.src = apsViewerScript
    s.onload = () => resolve(); s.onerror = () => reject(new Error('Could not load the Autodesk Viewer SDK (network/CSP).'))
    document.head.appendChild(s)
  })
  return sdkPromise
}

/* Renders a translated APS model (by URN) in the Autodesk Viewer. Auth comes from
 * the server-minted Viewer token. Self-contained: shows an inline error if the SDK
 * or the model can't load. */
export function ForgeViewer({ urn, height = 480 }: { urn: string; height?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let viewer: { start: () => void; finish: () => void; loadDocumentNode: (d: unknown, n: unknown) => void } | null = null
    let disposed = false
    loadViewerSdk().then(() => {
      if (disposed || !ref.current) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Autodesk = (window.Autodesk as any)
      Autodesk.Viewing.Initializer(
        {
          env: 'AutodeskProduction2',
          api: 'streamingV2',
          getAccessToken: async (cb: (t: string, e: number) => void) => {
            try { const t = await viewerToken(); cb(t.access_token, t.expires_in) } catch (e) { setError(e instanceof Error ? e.message : 'Token failed') }
          },
        },
        () => {
          if (disposed || !ref.current) return
          viewer = new Autodesk.Viewing.GuiViewer3D(ref.current)
          viewer!.start()
          Autodesk.Viewing.Document.load(
            `urn:${urn}`,
            (doc: { getRoot: () => { getDefaultGeometry: () => unknown } }) => {
              if (disposed) return
              viewer!.loadDocumentNode(doc, doc.getRoot().getDefaultGeometry())
            },
            (code: unknown, msg: unknown) => setError(`Could not load the translated model (${String(msg || code)}).`),
          )
        },
      )
    }).catch((e) => setError(e instanceof Error ? e.message : 'Viewer failed to load'))
    return () => { disposed = true; try { viewer?.finish() } catch { /* ignore */ } }
  }, [urn])

  if (error) {
    return <div style={{ height }} className="grid place-items-center rounded-xl bg-base/60 p-4 text-center text-sm text-rose-300">{error}</div>
  }
  return <div ref={ref} style={{ height }} className="relative w-full overflow-hidden rounded-xl bg-black" role="application" aria-label="Autodesk model viewer" />
}
