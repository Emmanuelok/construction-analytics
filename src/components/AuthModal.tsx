import { useEffect, useState } from 'react'
import { X, Loader2, Mail, Lock, User, ShieldCheck, Sparkles } from 'lucide-react'
import { useAuth } from '@/store/auth'
import { cn } from '@/lib/cn'

export function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { signIn, signUp, mode } = useAuth()
  const [tab, setTab] = useState<'in' | 'up'>('in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setError(null)
      setInfo(null)
      setBusy(false)
      setPassword('')
    }
  }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    const res = tab === 'in' ? await signIn(email, password) : await signUp(email, password, name)
    setBusy(false)
    if (res.error) setError(res.error)
    else if (res.info) setInfo(res.info)
    else onClose()
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-edge/70 bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-edge/60 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{tab === 'in' ? 'Welcome back' : 'Create your account'}</h2>
              <p className="text-[11px] text-slate-500">AEC Data &amp; Intelligence Studio</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-elevated hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1 p-1.5">
          {(['in', 'up'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null); setInfo(null) }}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                tab === t ? 'bg-elevated text-white' : 'text-slate-400 hover:text-slate-200',
              )}
            >
              {t === 'in' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3 px-5 pb-5 pt-1">
          {tab === 'up' && (
            <Field icon={User} label="Name">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Architect" className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none" autoComplete="name" />
            </Field>
          )}
          <Field icon={Mail} label="Email">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@studio.com" className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none" autoComplete="email" />
          </Field>
          <Field icon={Lock} label="Password">
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none" autoComplete={tab === 'in' ? 'current-password' : 'new-password'} />
          </Field>

          {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}
          {info && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">{info}</p>}

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {tab === 'in' ? 'Sign in' : 'Create account'}
          </button>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-teal-400" />
            {mode === 'supabase' ? 'Secured by Supabase Auth · encrypted at rest' : 'Demo mode — connect a backend for real accounts'}
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-400">{label}</span>
      <span className="flex items-center gap-2 rounded-xl border border-edge/70 bg-elevated/50 px-3 py-2 focus-within:border-brand-500/50">
        <Icon className="h-4 w-4 text-slate-500" />
        {children}
      </span>
    </label>
  )
}
