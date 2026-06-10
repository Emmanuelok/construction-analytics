import { Component, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

/* Last line of defence: a module crash renders a friendly recovery card instead of a
 * white screen, with the error preserved for support. State-light by design. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="grid min-h-[60vh] place-items-center p-6">
        <div className="max-w-md rounded-2xl border border-edge/60 bg-surface/80 p-6 text-center shadow-xl">
          <span className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 ring-1 ring-inset ring-amber-500/30"><AlertTriangle className="h-5 w-5 text-amber-300" /></span>
          <h2 className="text-base font-semibold text-slate-100">This module hit a snag</h2>
          <p className="mt-1 text-sm text-slate-400">Your data is safe — designs auto-save locally. Reload the module to carry on.</p>
          <p className="data-mono mt-2 truncate rounded bg-base/60 px-2 py-1 text-[11px] text-slate-500" title={String(this.state.error)}>{String(this.state.error)}</p>
          <button onClick={() => { this.setState({ error: null }); location.reload() }} className="btn-primary mt-4 inline-flex items-center gap-2"><RotateCcw className="h-4 w-4" /> Reload</button>
        </div>
      </div>
    )
  }
}
