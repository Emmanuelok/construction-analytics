import { cn } from '@/lib/cn'

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('h-7 w-7', className)} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5b97fb" />
          <stop offset="0.5" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      <path d="M16 2 3 9v14l13 7 13-7V9L16 2Z" stroke="url(#logo-grad)" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M16 2v28M3 9l13 7 13-7M3 23l13-7 13 7" stroke="url(#logo-grad)" strokeWidth="1.3" strokeLinejoin="round" opacity="0.85" />
      <circle cx="16" cy="16" r="2.4" fill="url(#logo-grad)" />
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <Logo />
      <div className="leading-none">
        <div className="text-[15px] font-bold tracking-tight text-slate-50">
          AEC<span className="text-gradient-brand"> Studio</span>
        </div>
        <div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
          Data & Intelligence
        </div>
      </div>
    </div>
  )
}
