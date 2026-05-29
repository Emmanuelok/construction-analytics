import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, ArrowRight, ArrowLeft, Check, X, Wand2 } from 'lucide-react'
import { useProfile } from '@/store/profile'
import {
  ROLES,
  DISCIPLINES,
  SECTORS,
  GOALS,
  type ExperienceLevel,
} from '@/lib/intelligence'
import { cn } from '@/lib/cn'

const EXPERIENCE: ExperienceLevel[] = ['Explorer', 'Practitioner', 'Expert']

function Chips({
  options,
  value,
  onToggle,
  multi = true,
}: {
  options: string[]
  value: string[]
  onToggle: (v: string) => void
  multi?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value.includes(o)
        return (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            className={cn(
              'rounded-full border px-3.5 py-2 text-sm font-medium transition-all',
              active
                ? 'border-brand-500/50 bg-brand-500/15 text-brand-100 shadow-[0_0_0_1px] shadow-brand-500/20'
                : 'border-edge/70 bg-elevated/40 text-slate-400 hover:border-slate-600 hover:text-slate-200',
            )}
          >
            {active && !multi && <Check className="mr-1 inline h-3.5 w-3.5" />}
            {o}
          </button>
        )
      })}
    </div>
  )
}

export function Onboarding({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, saveProfile } = useProfile()
  const [step, setStep] = useState(0)
  const [name, setName] = useState(profile.name)
  const [role, setRole] = useState(profile.role)
  const [disciplines, setDisciplines] = useState<string[]>(profile.disciplines)
  const [sectors, setSectors] = useState<string[]>(profile.sectors)
  const [goals, setGoals] = useState<string[]>(profile.goals)
  const [experience, setExperience] = useState<ExperienceLevel>(profile.experience)

  if (!open) return null

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  const STEPS = ['You', 'Your work', 'Your goals']
  const canNext = step === 0 ? !!role : true

  function finish() {
    saveProfile({ name, role, disciplines, sectors, goals, experience, onboarded: true })
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative my-8 w-full max-w-2xl overflow-hidden rounded-2xl border border-edge/70 bg-surface shadow-2xl">
        {/* header */}
        <div className="relative overflow-hidden border-b border-edge/60 px-6 py-5">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-500/15 via-violet-500/10 to-transparent" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 text-white">
                <Wand2 className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-50">Let's tailor the studio to you</h2>
                <p className="text-xs text-slate-400">A few quick choices — your home, recommendations and search adapt instantly.</p>
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-elevated hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          {/* stepper */}
          <div className="relative mt-4 flex gap-2">
            {STEPS.map((s, i) => (
              <div key={s} className="flex-1">
                <div className={cn('h-1 rounded-full', i <= step ? 'bg-brand-400' : 'bg-edge')} />
                <span className={cn('mt-1.5 block text-[11px]', i <= step ? 'text-slate-300' : 'text-slate-600')}>{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* body */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-6">
          {step === 0 && (
            <div className="space-y-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">What should we call you?</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-xl border border-edge/70 bg-elevated/50 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Your role <span className="text-rose-400">*</span>
                </label>
                <Chips options={ROLES} value={role ? [role] : []} onToggle={(v) => setRole(v === role ? '' : v)} multi={false} />
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Disciplines you work across</label>
                <Chips options={DISCIPLINES} value={disciplines} onToggle={(v) => toggle(disciplines, setDisciplines, v)} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Sectors you focus on</label>
                <Chips options={SECTORS} value={sectors} onToggle={(v) => toggle(sectors, setSectors, v)} />
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">What do you want to achieve here?</label>
                <Chips options={GOALS} value={goals} onToggle={(v) => toggle(goals, setGoals, v)} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Experience with AEC data</label>
                <div className="inline-flex rounded-xl border border-edge/70 bg-elevated/40 p-1">
                  {EXPERIENCE.map((e) => (
                    <button
                      key={e}
                      onClick={() => setExperience(e)}
                      className={cn(
                        'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
                        experience === e ? 'bg-brand-500/20 text-brand-100' : 'text-slate-400 hover:text-slate-200',
                      )}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between border-t border-edge/60 px-6 py-4">
          <button
            onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}
            className="btn-ghost"
          >
            {step === 0 ? 'Skip for now' : (<><ArrowLeft className="h-4 w-4" /> Back</>)}
          </button>
          {step < STEPS.length - 1 ? (
            <button onClick={() => canNext && setStep((s) => s + 1)} disabled={!canNext} className="btn-primary">
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={finish} className="btn-primary">
              <Sparkles className="h-4 w-4" /> Personalize my studio
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
