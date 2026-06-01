import { useState } from 'react'
import { MessageSquare, Share2, Send, Check, Trash2, CheckCircle2, AtSign } from 'lucide-react'
import { ACCENT, type Accent } from '@/lib/nav'
import { cn } from '@/lib/cn'
import { shareUrl } from '@/lib/collab'
import { useCollab } from '@/store/collab'

/* A slim collaboration bar for any workbench: a comment thread (with @mentions
 * and resolve), and a one-click "copy share link" that deep-links the subject.
 * The page passes a stable subject key (e.g. 'cost-schedule' or a project id). */
export function CollabBar({ subject, accent = 'blue' }: { subject: string; accent?: Accent }) {
  const a = ACCENT[accent]
  const { thread, summary, post, remove, resolve, recordShare } = useCollab(subject)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [copied, setCopied] = useState(false)

  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  const link = shareUrl(window.location.origin, base, subject)

  const submit = () => { if (draft.trim()) { post(draft); setDraft('') } }
  const copy = async () => {
    try { await navigator.clipboard.writeText(link) } catch { /* clipboard blocked */ }
    recordShare()
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="rounded-2xl border border-edge/60 bg-surface/40 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium ring-1 ring-inset', a.bg, a.text, a.ring)}>
          <MessageSquare className="h-3.5 w-3.5" /> Collaborate
        </span>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"
        >
          <MessageSquare className="h-3.5 w-3.5" /> Comments
          {summary.total > 0 && (
            <span className={cn('grid h-4 min-w-[16px] place-items-center rounded-full px-1 text-[10px] font-bold text-white', summary.open > 0 ? 'bg-blue-500' : 'bg-slate-500')}>{summary.total}</span>
          )}
        </button>
        <button onClick={copy} aria-label="Copy share link" className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white">
          {copied ? <><Check className="h-3.5 w-3.5 text-emerald-300" /> Link copied</> : <><Share2 className="h-3.5 w-3.5" /> Share</>}
        </button>
        {summary.total > 0 && !open && (
          <span className="text-[11px] text-slate-500">{summary.open} open · {summary.participants} {summary.participants === 1 ? 'person' : 'people'}</span>
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-3">
          {thread.length === 0 ? (
            <p className="px-1 text-xs text-slate-500">No comments yet — start the thread. Use <span className="text-slate-300">@name</span> to mention a teammate.</p>
          ) : (
            <ul className="space-y-2">
              {thread.map((c) => (
                <li key={c.id} className={cn('rounded-xl border p-3', c.resolved ? 'border-edge/40 bg-elevated/20 opacity-70' : 'border-edge/60 bg-elevated/30')}>
                  <div className="flex items-center gap-2">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-violet-500 text-[9px] font-bold text-white">{c.authorName.slice(0, 2).toUpperCase()}</span>
                    <span className="text-xs font-semibold text-slate-200">{c.authorName}</span>
                    <span className="text-[10px] text-slate-500">{new Date(c.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                    {c.resolved && <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-300"><CheckCircle2 className="h-3 w-3" /> resolved</span>}
                    <div className="ml-auto flex items-center gap-1">
                      <button onClick={() => resolve(c.id)} aria-label={c.resolved ? 'Reopen comment' : 'Resolve comment'} className="text-slate-500 hover:text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => remove(c.id)} aria-label="Delete comment" className="text-slate-500 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{renderBody(c.body)}</p>
                  {c.mentions.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {c.mentions.map((m) => (
                        <span key={m} className="inline-flex items-center gap-0.5 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-300"><AtSign className="h-2.5 w-2.5" />{m}</span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }}
              rows={2}
              placeholder="Add a comment… @mention a teammate · ⌘↵ to post"
              aria-label="Add a comment"
              className="flex-1 resize-y rounded-xl border border-edge/70 bg-elevated/40 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none"
            />
            <button onClick={submit} disabled={!draft.trim()} aria-label="Post comment" className="btn-primary !px-3 !py-2 disabled:opacity-40"><Send className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </div>
  )
}

/* Highlight @mentions inline. */
function renderBody(body: string) {
  const parts = body.split(/(@[a-zA-Z0-9._-]{2,30})/g)
  return parts.map((p, i) => (p.startsWith('@') ? <span key={i} className="font-medium text-blue-300">{p}</span> : <span key={i}>{p}</span>))
}
