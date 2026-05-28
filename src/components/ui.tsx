import React from 'react'
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { ACCENT, type Accent } from '@/lib/nav'

/* ----------------------------------------------------------------------------
 * Card
 * ------------------------------------------------------------------------- */
export function Card({
  className,
  children,
  hover,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div className={cn('card', hover && 'card-hover', className)} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  icon: Icon,
  accent = 'blue',
  action,
  className,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  icon?: LucideIcon
  accent?: Accent
  action?: React.ReactNode
  className?: string
}) {
  const a = ACCENT[accent]
  return (
    <div className={cn('flex items-start justify-between gap-4 p-5', className)}>
      <div className="flex items-start gap-3">
        {Icon && (
          <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1', a.bg, a.ring)}>
            <Icon className={cn('h-[18px] w-[18px]', a.text)} />
          </span>
        )}
        <div>
          <h3 className="text-[15px] font-semibold text-slate-100">{title}</h3>
          {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * IconBadge
 * ------------------------------------------------------------------------- */
export function IconBadge({
  icon: Icon,
  accent = 'blue',
  size = 'md',
  className,
}: {
  icon: LucideIcon
  accent?: Accent
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const a = ACCENT[accent]
  const dims = size === 'lg' ? 'h-12 w-12 rounded-2xl' : size === 'sm' ? 'h-8 w-8 rounded-lg' : 'h-10 w-10 rounded-xl'
  const ic = size === 'lg' ? 'h-6 w-6' : size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'
  return (
    <span className={cn('grid shrink-0 place-items-center ring-1', dims, a.bg, a.ring, className)}>
      <Icon className={cn(ic, a.text)} />
    </span>
  )
}

/* ----------------------------------------------------------------------------
 * Badge
 * ------------------------------------------------------------------------- */
type BadgeVariant = 'brand' | 'success' | 'warn' | 'danger' | 'neutral' | 'violet' | 'cyan'
const BADGE: Record<BadgeVariant, string> = {
  brand: 'bg-brand-500/12 text-brand-300 ring-brand-500/25',
  success: 'bg-emerald-500/12 text-emerald-300 ring-emerald-500/25',
  warn: 'bg-amber-500/12 text-amber-300 ring-amber-500/25',
  danger: 'bg-rose-500/12 text-rose-300 ring-rose-500/25',
  neutral: 'bg-slate-500/12 text-slate-300 ring-slate-400/20',
  violet: 'bg-violet-500/12 text-violet-300 ring-violet-500/25',
  cyan: 'bg-cyan-500/12 text-cyan-300 ring-cyan-500/25',
}
export function Badge({
  children,
  variant = 'neutral',
  className,
  dot,
}: {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
  dot?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        BADGE[variant],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

/* ----------------------------------------------------------------------------
 * StatTile
 * ------------------------------------------------------------------------- */
export function StatTile({
  label,
  value,
  delta,
  deltaPositive,
  icon: Icon,
  accent = 'blue',
  sub,
  className,
}: {
  label: string
  value: React.ReactNode
  delta?: string
  deltaPositive?: boolean
  icon?: LucideIcon
  accent?: Accent
  sub?: string
  className?: string
}) {
  const a = ACCENT[accent]
  return (
    <Card className={cn('p-5', className)} hover>
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{label}</span>
        {Icon && <Icon className={cn('h-4 w-4', a.text)} />}
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className="text-2xl font-semibold tracking-tight text-slate-50 data-mono">{value}</span>
        {delta && (
          <span
            className={cn(
              'mb-1 inline-flex items-center gap-0.5 text-xs font-semibold',
              deltaPositive ? 'text-emerald-400' : 'text-rose-400',
            )}
          >
            {deltaPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {delta}
          </span>
        )}
      </div>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </Card>
  )
}

/* ----------------------------------------------------------------------------
 * ProgressBar
 * ------------------------------------------------------------------------- */
export function ProgressBar({
  value,
  accent = 'blue',
  className,
  showValue,
  height = 'md',
}: {
  value: number
  accent?: Accent
  className?: string
  showValue?: boolean
  height?: 'sm' | 'md'
}) {
  const a = ACCENT[accent]
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className={cn('relative w-full overflow-hidden rounded-full bg-elevated', height === 'sm' ? 'h-1.5' : 'h-2')}>
        <div
          className={cn('absolute inset-y-0 left-0 rounded-full bg-gradient-to-r', a.from, a.to)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showValue && <span className="w-10 shrink-0 text-right text-xs text-slate-400 data-mono">{Math.round(clamped)}%</span>}
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * RingProgress (SVG)
 * ------------------------------------------------------------------------- */
export function RingProgress({
  value,
  size = 72,
  stroke = 7,
  accent = 'blue',
  label,
}: {
  value: number
  size?: number
  stroke?: number
  accent?: Accent
  label?: React.ReactNode
}) {
  const a = ACCENT[accent]
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1b2540" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={a.hex}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (clamped / 100) * c}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        {label ?? <span className="text-sm font-semibold text-slate-100 data-mono">{Math.round(clamped)}%</span>}
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * SectionHeading
 * ------------------------------------------------------------------------- */
export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div>
        {eyebrow && <div className="section-label mb-2">{eyebrow}</div>}
        <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">{title}</h2>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-slate-400">{description}</p>}
      </div>
      {action}
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * PageHeader
 * ------------------------------------------------------------------------- */
export function PageHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
  accent = 'blue',
  actions,
}: {
  icon?: LucideIcon
  eyebrow?: string
  title: React.ReactNode
  description?: React.ReactNode
  accent?: Accent
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-5 border-b border-edge/60 pb-7">
      <div className="flex items-start gap-4">
        {Icon && <IconBadge icon={Icon} accent={accent} size="lg" />}
        <div>
          {eyebrow && <div className="section-label mb-1.5">{eyebrow}</div>}
          <h1 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-[28px]">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-slate-400">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * KeyValue / definition rows
 * ------------------------------------------------------------------------- */
export function KeyValue({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={cn('text-sm font-medium text-slate-200', mono && 'data-mono')}>{value}</span>
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * Tabs (controlled, lightweight)
 * ------------------------------------------------------------------------- */
export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: { id: string; label: string; icon?: LucideIcon }[]
  active: string
  onChange: (id: string) => void
  className?: string
}) {
  return (
    <div className={cn('inline-flex flex-wrap gap-1 rounded-xl border border-edge/70 bg-elevated/50 p-1', className)}>
      {tabs.map((t) => {
        const isActive = t.id === active
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
              isActive ? 'bg-brand-500/15 text-brand-200 shadow-sm ring-1 ring-brand-500/30' : 'text-slate-400 hover:text-slate-200',
            )}
          >
            {t.icon && <t.icon className="h-4 w-4" />}
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * Bullet / feature row
 * ------------------------------------------------------------------------- */
export function FeatureRow({
  icon: Icon,
  title,
  children,
  accent = 'blue',
}: {
  icon: LucideIcon
  title: string
  children?: React.ReactNode
  accent?: Accent
}) {
  return (
    <div className="flex gap-3.5">
      <IconBadge icon={Icon} accent={accent} size="sm" />
      <div>
        <p className="text-sm font-medium text-slate-200">{title}</p>
        {children && <p className="mt-0.5 text-sm text-slate-400">{children}</p>}
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * Sparkline (tiny inline SVG)
 * ------------------------------------------------------------------------- */
export function Sparkline({ data, accent = 'blue', width = 96, height = 28 }: { data: number[]; accent?: Accent; width?: number; height?: number }) {
  const a = ACCENT[accent]
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pts = data
    .map((d, i) => `${(i / (data.length - 1)) * width},${height - ((d - min) / range) * (height - 4) - 2}`)
    .join(' ')
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={a.hex} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
