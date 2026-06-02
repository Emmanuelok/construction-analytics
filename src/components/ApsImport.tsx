import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Building2, Upload, Loader2, AlertTriangle, KeyRound, ExternalLink, CheckCircle2, X } from 'lucide-react'
import { Card, CardHeader, Badge } from '@/components/ui'
import { apsEnabled, uploadAndTranslate, type ApsStep } from '@/lib/aps-client'
import { isTranslatable } from '@/lib/aps'

const ForgeViewer = lazy(() => import('@/components/ForgeViewer').then((m) => ({ default: m.ForgeViewer })))

/* Connector for native CAD/BIM (.rvt, .dwg, .nwd, …) via Autodesk Platform
 * Services: upload → translate to SVF2 → view in the Autodesk Viewer. Gracefully
 * shows setup steps until APS_CLIENT_ID/SECRET are configured on the server. */
export function ApsImport() {
  const [status, setStatus] = useState<'checking' | 'off' | 'ready'>('checking')
  useEffect(() => { let live = true; apsEnabled().then((e) => { if (live) setStatus(e ? 'ready' : 'off') }); return () => { live = false } }, [])

  const fileRef = useRef<HTMLInputElement>(null)
  const [urn, setUrn] = useState<string | null>(null)
  const [name, setName] = useState<string>('')
  const [step, setStep] = useState<ApsStep | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    if (!isTranslatable(f.name)) { setError(`.${f.name.split('.').pop()} isn't a translatable format. Try .rvt, .dwg, .nwd, .ifc…`); return }
    setError(null); setUrn(null); setName(f.name); setBusy(true); setStep({ phase: 'Starting…', percent: 0 })
    try { setUrn(await uploadAndTranslate(f, setStep)) }
    catch (err) { setError(err instanceof Error ? err.message : 'Translation failed') }
    finally { setBusy(false) }
  }

  return (
    <Card>
      <CardHeader
        icon={Building2}
        accent="rose"
        title="Native CAD / BIM — Revit · AutoCAD · Navisworks"
        subtitle="Upload .rvt / .dwg / .nwd / .ifc and Autodesk Platform Services translates it for an in-browser viewer."
        action={
          status === 'ready'
            ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="success" dot>APS connected</Badge>
                <button onClick={() => fileRef.current?.click()} className="btn-primary" disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload model
                </button>
                {urn && <button onClick={() => { setUrn(null); setName('') }} className="btn-ghost"><X className="h-4 w-4" /> Clear</button>}
                <input ref={fileRef} type="file" accept=".rvt,.rfa,.dwg,.dwf,.nwd,.nwc,.ifc,.dgn,.3dm,.step,.stp,.iam,.ipt,.sldprt,.sldasm,.fbx" className="hidden" onChange={onFile} />
              </div>
            )
            : status === 'off' ? <Badge variant="neutral" dot>Not connected</Badge> : <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
        }
      />

      {status === 'off' && (
        <div className="space-y-4 border-t border-edge/50 p-5">
          <p className="text-sm leading-relaxed text-slate-300">
            Native Revit/AutoCAD files are proprietary and can't be read in the browser directly. Connect <span className="font-medium text-slate-100">Autodesk Platform Services</span> (free dev tier) and the studio will translate uploads server-side, then view + measure them here.
          </p>
          <ol className="space-y-2 text-sm text-slate-300">
            <li className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-rose-500/15 text-[11px] font-semibold text-rose-300">1</span> Create an app at <a href="https://aps.autodesk.com/myapps" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-rose-300 hover:underline">aps.autodesk.com/myapps <ExternalLink className="h-3 w-3" /></a> to get a Client ID + Secret.</li>
            <li className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-rose-500/15 text-[11px] font-semibold text-rose-300">2</span> Set <code className="rounded bg-elevated/60 px-1 text-slate-200">APS_CLIENT_ID</code> and <code className="rounded bg-elevated/60 px-1 text-slate-200">APS_CLIENT_SECRET</code> in your deployment's environment.</li>
            <li className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-rose-500/15 text-[11px] font-semibold text-rose-300">3</span> Redeploy — this panel turns on, and you can drop a <code className="rounded bg-elevated/60 px-1 text-slate-200">.rvt</code> here to translate &amp; view.</li>
          </ol>
          <p className="flex items-center gap-2 rounded-lg bg-elevated/40 px-3 py-2 text-xs text-slate-400">
            <KeyRound className="h-3.5 w-3.5 shrink-0" /> Secrets stay on the server (only a short-lived viewer token reaches the browser). Meanwhile, <span className="text-slate-300">export IFC or glTF/OBJ</span> from Revit and use the importers above — no setup needed.
          </p>
        </div>
      )}

      {status === 'ready' && (
        <div className="border-t border-edge/50">
          {error && <p className="flex items-center gap-2 px-5 py-3 text-sm text-rose-300"><AlertTriangle className="h-4 w-4" /> {error}</p>}
          {busy && step && (
            <div className="px-5 py-4">
              <div className="mb-1.5 flex items-center justify-between text-sm"><span className="text-slate-300">{step.phase}</span><span className="data-mono text-slate-400">{Math.round(step.percent)}%</span></div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-elevated/60"><div className="h-full rounded-full bg-rose-400 transition-all" style={{ width: `${step.percent}%` }} /></div>
              <p className="mt-2 text-[11px] text-slate-500">Translating {name} on Autodesk's cloud — large models can take a few minutes.</p>
            </div>
          )}
          {urn && !busy && (
            <div>
              <div className="flex items-center gap-2 border-b border-edge/60 bg-elevated/30 px-4 py-2.5 text-sm font-medium text-slate-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" /> {name} <Badge variant="success">translated</Badge>
              </div>
              <Suspense fallback={<div style={{ height: 480 }} className="grid place-items-center text-sm text-slate-500">Loading Autodesk Viewer…</div>}>
                <ForgeViewer urn={urn} height={480} />
              </Suspense>
              <p className="border-t border-edge/60 px-4 py-2 text-[11px] text-slate-500">Full Autodesk Viewer — orbit, section, measure, isolate, and browse the model tree &amp; properties. Properties/quantities can be pulled via the Model Derivative API.</p>
            </div>
          )}
          {!urn && !busy && !error && (
            <div className="px-5 py-8 text-center text-sm text-slate-500">APS is connected. Click <span className="text-slate-300">Upload model</span> and drop a native <span className="text-slate-300">.rvt / .dwg / .nwd / .ifc</span> to translate and view it.</div>
          )}
        </div>
      )}
    </Card>
  )
}
