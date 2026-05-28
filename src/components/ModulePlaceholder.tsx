import { PageHeader } from '@/components/ui'
import { Card } from '@/components/ui'
import { NAV } from '@/lib/nav'
import { Loader2 } from 'lucide-react'

/** Temporary shell shown while a module is being implemented. */
export default function ModulePlaceholder({ path }: { path: string }) {
  const item = NAV.find((n) => n.path === path) ?? NAV[0]
  return (
    <div className="space-y-8">
      <PageHeader icon={item.icon} eyebrow={item.group} title={item.label} description={item.blurb} accent={item.accent} />
      <Card className="grid place-items-center p-16 text-center">
        <Loader2 className="h-7 w-7 animate-spin text-brand-400" />
        <p className="mt-4 text-sm text-slate-400">This engine is being wired into the studio…</p>
      </Card>
    </div>
  )
}
